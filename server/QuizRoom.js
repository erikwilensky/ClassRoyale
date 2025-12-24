import { Room } from "colyseus";
import { Schema, MapSchema, ArraySchema } from "@colyseus/schema";
import { verifyToken } from "./auth/auth.js";
import { getPlayerUnlockedCards } from "./services/xpService.js";
import { db } from "./db/database.js";
import { CardSystem } from "./systems/cardSystem.js";
import { ScoringSystem } from "./systems/scoringSystem.js";
import { canPerformAction, isRoundFrozen } from "./systems/moderationGate.js";
import { logDebug } from "./utils/log.js";
import { CARDS, CARD_CATALOG_V1_BY_ID } from "./config/cards.js";

// Suggestion state schema
class SuggestionState extends Schema {
    text = "";
    suggesterId = "";
    timestamp = 0;
}

// Team state schema
class TeamState extends Schema {
    writer = ""; // sessionId of writer
    writerPlayerId = ""; // playerId of writer (for reconnect handling)
    suggesters = new ArraySchema(); // Array of sessionIds
    answer = "";
    locked = false;
    suggestions = new ArraySchema(); // Array of SuggestionState
    gold = 0;
    name = ""; // Team name from lobby
    // Chapter 16: Team deck (4 slots)
    deckSlots = new ArraySchema(); // Array of 4: cardId or null
    deckLocked = false;
    teamCardPool = new ArraySchema(); // Array of card IDs (union of all team members' unlocked cards)
}

// Quiz state schema
class QuizState extends Schema {
    questionText = "";
    timeRemaining = 0;
    roundState = "ROUND_WAITING"; // Explicit state: ROUND_WAITING, ROUND_ACTIVE, ROUND_REVIEW, ROUND_ENDED
    timerEnabled = false;          // Timer toggle
    teams = new MapSchema(); // Map<teamId, TeamState>
    gold = new MapSchema(); // Map<teamId, number>
    activeEffects = new MapSchema(); // Map<targetTeamId, EffectState>
}

export class QuizRoom extends Room {
    timerInterval = null;
    minTeamSize = 2;
    maxTeamSize = 4;
    
    // Writer rotation tracking
    writerRotationIndices = new Map(); // teamId -> current rotation index
    
    // Chapter 16: Match lifecycle
    matchStarted = false; // Set to true when Round 1 starts, reset on match reset
    
    // Chapter 11.5: System modules
    cardSystem = null;
    scoringSystem = null;
    
    // Scoring state (managed by scoringSystem, but kept here for backward compatibility)
    scores = {
        teams: new Map(),  // teamId -> roundPoints (match score, not evaluation score)
        perPlayer: new Map(),  // playerId -> { roundScores: [], totalEvaluationScore: 0 }
        roundScores: new Map(),  // roundNumber -> { teamId: evaluationScore }
        roundNumber: 0,
        matchOver: false,
        winner: null  // teamId of winner
    };
    
    // Track answer ownership for individual scoring
    answers = new Map();  // roundNumber -> Map<teamId, { text, writerId, suggesterIds: [] }>
    
    // Chapter 12: Moderation state (ephemeral, resets on round/match end)
    moderationState = {
        mutedPlayers: new Set(),      // playerId
        frozenTeams: new Set(),        // teamId
        roundFrozen: false
    };

    onCreate(options) {
        this.setState(new QuizState());
        this.maxClients = 50;

        // Chapter 11.5: Initialize system modules
        this.cardSystem = new CardSystem(this);
        this.scoringSystem = new ScoringSystem(this);
        
        // Initialize scoring state (via scoringSystem)
        this.scoringSystem.initializeScores();
        this.answers = new Map();

        // Initialize card rules (via cardSystem)
        this.cardSystem.initializeRules();

        // If teams provided from lobby, initialize them
        if (options.teams && options.players) {
            this.initializeTeamsFromLobby(options.teams, options.players);
        }

        // Team management messages
        this.onMessage("createTeam", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (client.metadata.role !== "student") return;

            const teamName = (message.teamName || `Team${Date.now()}`).trim().toUpperCase();
            const teamId = teamName;

            // Check if team already exists
            if (this.state.teams.has(teamId)) {
                client.send("ERROR", { message: "Team name already taken" });
                return;
            }

            // Create new team
            const team = new TeamState();
            team.writer = client.sessionId;
            team.answer = "";
            team.locked = false;
            team.gold = 0;
            // Chapter 16: Initialize deck slots (4 empty slots)
            team.deckSlots = new ArraySchema(null, null, null, null);
            team.deckLocked = false;
            team.teamCardPool = new ArraySchema();
            this.state.teams.set(teamId, team);
            this.state.gold.set(teamId, 0);

            // Delay sending TEAM_JOINED to allow client to register handlers
            setTimeout(async () => {
                // Chapter 16: Update team card pool when team is created
                await this.updateTeamCardPool(teamId);
                client.send("TEAM_JOINED", {
                    teamId,
                    isWriter: true,
                    writer: client.sessionId,
                    suggesters: [],
                    currentAnswer: "",
                    teamName: teamId // Team name is the teamId for manually created teams
                });
                this.broadcastTeamUpdate();
                this.broadcastAvailableTeams();
            }, 100);
        });

        this.onMessage("joinTeam", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (client.metadata.role !== "student") return;

            const teamId = message.teamId;
            const team = this.state.teams.get(teamId);

            if (!team) {
                client.send("ERROR", { message: "Team not found" });
                return;
            }

            // Check if already in a team
            for (const [tId, t] of this.state.teams.entries()) {
                if (t.writer === client.sessionId || t.suggesters.findIndex(s => s === client.sessionId) >= 0) {
                    client.send("ERROR", { message: "Already in a team" });
                    return;
                }
            }

            // Check team size
            const currentSize = 1 + team.suggesters.length;
            if (currentSize >= this.maxTeamSize) {
                client.send("ERROR", { message: "Team is full" });
                return;
            }

            // Add as suggester (prevent duplicates)
            if (team.suggesters.findIndex(s => s === client.sessionId) < 0) {
                team.suggesters.push(client.sessionId);
            }

            // Delay sending TEAM_JOINED to allow client to register handlers
            setTimeout(async () => {
                // Chapter 16: Update team card pool when member joins
                await this.updateTeamCardPool(teamId);
                client.send("TEAM_JOINED", {
                    teamId,
                    isWriter: false,
                    writer: team.writer,
                    suggesters: Array.from(team.suggesters),
                    currentAnswer: team.answer,
                    teamName: team.name || teamId
                });
            }, 100);

            this.broadcastTeamUpdate();
            this.broadcastAvailableTeams();
        });

        this.onMessage("leaveTeam", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (client.metadata.role !== "student") return;

            for (const [teamId, team] of this.state.teams.entries()) {
                if (team.writer === client.sessionId) {
                    // Writer is leaving - remove team if round not active, or transfer writer role
                    if (this.state.roundState === "ROUND_ACTIVE" && team.locked) {
                        client.send("ERROR", { message: "Cannot leave team during active round" });
                        return;
                    }

                    // If suggesters exist, transfer writer role to first suggester
                    if (team.suggesters.length > 0) {
                        const newWriter = team.suggesters[0];
                        team.writer = newWriter;
                        team.suggesters.splice(0, 1);

                        // Notify new writer
                        const newWriterClient = this.clients.find(c => c.sessionId === newWriter);
                        if (newWriterClient) {
                            newWriterClient.send("WRITER_TRANSFERRED", {
                                teamId,
                                oldWriter: client.sessionId,
                                newWriter
                            });
                        }
                    } else {
                        // No suggesters - delete team
                        this.state.teams.delete(teamId);
                        this.state.gold.delete(teamId);
                    }
                } else {
                    // Remove from suggesters
                    const suggesterIndex = team.suggesters.findIndex(s => s === client.sessionId);
                    if (suggesterIndex >= 0) {
                        team.suggesters.splice(suggesterIndex, 1);

                        // If team becomes empty, delete it
                        if (team.suggesters.length === 0 && this.state.roundState !== "ROUND_ACTIVE") {
                            this.state.teams.delete(teamId);
                            this.state.gold.delete(teamId);
                        }
                    } else {
                        continue;
                    }
                }

                client.send("TEAM_LEFT", {});
                // Chapter 16: Update team card pool when member leaves (if team still exists)
                if (this.state.teams.has(teamId)) {
                    this.updateTeamCardPool(teamId);
                }
                this.broadcastTeamUpdate();
                this.broadcastAvailableTeams();
                return;
            }
        });

        this.onMessage("transferWriter", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (client.metadata.role !== "student") return;

            const newWriterId = message.newWriterId;
            const team = Array.from(this.state.teams.values()).find(
                t => t.writer === client.sessionId
            );

            if (!team) return;

            const teamId = Array.from(this.state.teams.entries()).find(
                ([_, t]) => t === team
            )[0];

            // Verify newWriterId is a suggester
            const suggesterIndex = team.suggesters.findIndex(s => s === newWriterId);
            if (suggesterIndex < 0) return;

            // Transfer writer role
            const oldWriter = team.writer;
            team.writer = newWriterId;
            team.suggesters.splice(suggesterIndex, 1);
            team.suggesters.push(oldWriter);

            // Broadcast to team members
            this.broadcastToTeam(teamId, "WRITER_TRANSFERRED", {
                teamId,
                oldWriter,
                newWriter: newWriterId
            });

            // Chapter 16: Update team card pool when writer transfers
            this.updateTeamCardPool(teamId);
            this.broadcastTeamUpdate();
        });

        // Suggestion system
        this.onMessage("suggestion", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (client.metadata.role !== "student") return;

            const team = this.findTeamByMember(client.sessionId);
            const teamId = team ? Array.from(this.state.teams.entries()).find(([_, t]) => t === team)?.[0] : null;
            
            // Card Catalog v1: Check if spectator suggestions are enabled
            let isSpectator = false;
            if (!team || team.writer === client.sessionId) {
                // Check if this is a spectator (not in team but spectator mode enabled)
                if (!team) {
                    // Check all teams for spectator mode
                    for (const [tId, t] of this.state.teams.entries()) {
                        const spectatorMode = this.cardSystem.spectatorSuggestersEnabled.get(tId);
                        if (spectatorMode && Date.now() < spectatorMode.expiresAt) {
                            // This client can send suggestions to this team
                            team = t;
                            teamId = tId;
                            isSpectator = true;
                            break;
                        }
                    }
                }
                if (!team || (!isSpectator && team.writer === client.sessionId)) {
                    return; // Writers don't send suggestions (unless spectator)
                }
            }

            if (!teamId || team.locked || this.state.roundState !== "ROUND_ACTIVE") return;

            // Chapter 13: Use centralized moderation gate
            const canPerform = canPerformAction(this, {
                playerId: client.metadata.playerId,
                teamId: teamId,
                action: "suggestion"
            });
            if (!canPerform.ok) {
                return; // Silent failure
            }

            // Card Catalog v1: Check for suggestion char limit
            const charLimit = this.cardSystem.getSuggestionCharLimit(teamId);
            if (charLimit && message.text.length > charLimit) {
                console.log(`[QuizRoom] Suggestion rejected: exceeds char limit (${message.text.length} > ${charLimit})`);
                client.send("ERROR", { message: `Suggestion too long. Maximum ${charLimit} characters allowed.` });
                return;
            }

            // Card Catalog v1: Check for suggestion muting/delaying effects
            const writerEffect = this.state.activeEffects.get(teamId);
            if (writerEffect && writerEffect.effectType === "SUGGESTION_MUTE_RECEIVE") {
                // Check if effect is still active
                if (Date.now() < writerEffect.expiresAt) {
                    const durationSeconds = writerEffect.effectParams.durationSeconds || 10;
                    const elapsed = (Date.now() - writerEffect.timestamp) / 1000;
                    if (elapsed < durationSeconds) {
                        console.log(`[QuizRoom] Suggestion blocked by SUGGESTION_MUTE_RECEIVE for team ${teamId}`);
                        return; // Block suggestion silently
                    }
                }
            }

            const suggestion = new SuggestionState();
            suggestion.text = message.text;
            suggestion.suggesterId = client.sessionId;
            suggestion.timestamp = Date.now();

            // Card Catalog v1: Check for suggestion delay
            if (writerEffect && writerEffect.effectType === "SUGGESTION_DELAY") {
                const delaySeconds = writerEffect.effectParams.delaySeconds || 2;
                const delayMs = delaySeconds * 1000;
                
                // Store suggestion with delay
                setTimeout(() => {
                    // Check if writer still exists and round is still active
                    const currentTeam = this.state.teams.get(teamId);
                    if (!currentTeam || this.state.roundState !== "ROUND_ACTIVE") return;
                    
                    // Add suggestion after delay
                    currentTeam.suggestions.push(suggestion);
                    
                    // Send to writer after delay
                    const writerClient = this.clients.find(c => c.sessionId === currentTeam.writer);
                    if (writerClient) {
                        writerClient.send("SUGGESTION", {
                            text: suggestion.text,
                            suggesterId: suggestion.suggesterId,
                            timestamp: suggestion.timestamp
                        });
                    }
                    
                    this.broadcastTeamUpdate();
                    console.log(`[QuizRoom] Delayed suggestion delivered to team ${teamId} after ${delaySeconds} seconds`);
                }, delayMs);
                
                console.log(`[QuizRoom] Suggestion delayed by ${delaySeconds} seconds for team ${teamId}`);
                return; // Don't process immediately
            }

            team.suggestions.push(suggestion);

            // Award gold (+1) and XP (+1) for suggestion
            team.gold += 1;
            this.state.gold.set(teamId, team.gold);
            this.scoringSystem.addXPToCache(client.metadata.playerId, 1, "suggestionSubmitted");

            // Broadcast gold update
            this.broadcastGoldUpdate();

            // Card Catalog v1: Check for priority channel mode
            const priorityMode = this.cardSystem.suggestionPriorityMode.get(teamId);
            if (priorityMode && Date.now() < priorityMode.expiresAt) {
                // Only send top N suggesters' messages
                // Group suggestions by suggester
                const suggesterCounts = new Map();
                for (const s of team.suggestions) {
                    suggesterCounts.set(s.suggesterId, (suggesterCounts.get(s.suggesterId) || 0) + 1);
                }
                // Sort by count (descending) and take top N
                const topSuggesters = Array.from(suggesterCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, priorityMode.topCount)
                    .map(([id]) => id);
                
                // Only send if this suggester is in top N
                if (!topSuggesters.includes(suggestion.suggesterId)) {
                    console.log(`[QuizRoom] Suggestion filtered by priority channel (not in top ${priorityMode.topCount})`);
                    return; // Don't send to writer
                }
            }

            // Send suggestion to writer
            const writerClient = this.clients.find(c => c.sessionId === team.writer);
            if (writerClient) {
                writerClient.send("SUGGESTION", {
                    text: suggestion.text,
                    suggesterId: suggestion.suggesterId,
                    timestamp: suggestion.timestamp
                });
            }

            this.broadcastTeamUpdate();
        });

        this.onMessage("insertSuggestion", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (client.metadata.role !== "student") return;

            const team = Array.from(this.state.teams.values()).find(
                t => t.writer === client.sessionId
            );
            if (!team || team.locked || this.state.roundState !== "ROUND_ACTIVE") return;

            const teamId = Array.from(this.state.teams.entries()).find(([_, t]) => t === team)[0];

            // Chapter 13: Use centralized moderation gate
            const canPerform = canPerformAction(this, {
                playerId: client.metadata.playerId,
                teamId: teamId,
                action: "insertSuggestion"
            });
            if (!canPerform.ok) {
                return; // Silent failure
            }

            // Find suggestion by suggesterId and timestamp
            const suggesterId = message.suggesterId;
            const timestamp = message.timestamp || 0;
            const suggestionIndex = team.suggestions.findIndex(
                s => s.suggesterId === suggesterId && Number(s.timestamp) === Number(timestamp)
            );

            if (suggestionIndex < 0) {
                client.send("ERROR", { message: "Suggestion not found" });
                return;
            }

            const suggestion = team.suggestions[suggestionIndex];
            team.suggestions.splice(suggestionIndex, 1);

            // Insert into answer
            const index = message.index !== undefined ? message.index : -1;
            if (index >= 0 && index < team.answer.length) {
                team.answer = team.answer.slice(0, index) + suggestion.text + team.answer.slice(index);
            } else {
                team.answer = team.answer + (team.answer ? " " : "") + suggestion.text;
            }

            // Award XP (+2) for inserting suggestion
            this.scoringSystem.addXPToCache(client.metadata.playerId, 2, "suggestionInserted");

            // Broadcast answer update to team
            this.broadcastToTeam(teamId, "ANSWER_UPDATE", {
                teamId,
                answer: team.answer
            });

            this.broadcastTeamUpdate();
        });

        this.onMessage("updateAnswer", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (client.metadata.role !== "student") return;

            const team = Array.from(this.state.teams.values()).find(
                t => t.writer === client.sessionId
            );
            if (!team || team.locked || this.state.roundState !== "ROUND_ACTIVE") return;

            const teamId = Array.from(this.state.teams.entries()).find(([_, t]) => t === team)[0];

            // Chapter 13: Use centralized moderation gate
            const canPerform = canPerformAction(this, {
                playerId: client.metadata.playerId,
                teamId: teamId,
                action: "updateAnswer"
            });
            if (!canPerform.ok) {
                return; // Silent failure
            }

            team.answer = message.answer || "";
            this.broadcastTeamUpdate();
        });

        this.onMessage("lockAnswer", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (client.metadata.role !== "student") return;

            // Find team by writer - use playerId if available (handles reconnects), otherwise fall back to sessionId
            let team = null;
            let teamId = null;
            const playerId = client.metadata.playerId;
            
            for (const [tId, t] of this.state.teams.entries()) {
                // Check if this client is the writer by sessionId OR by playerId (handles reconnects)
                const isWriterBySession = t.writer === client.sessionId;
                const isWriterByPlayerId = playerId && t.writerPlayerId === playerId;
                
                if (isWriterBySession || isWriterByPlayerId) {
                    team = t;
                    teamId = tId;
                    // If we found by playerId but sessionId doesn't match, update it
                    if (isWriterByPlayerId && t.writer !== client.sessionId) {
                        console.log(`[QuizRoom] lockAnswer: Updating writer sessionId from ${t.writer} to ${client.sessionId} (reconnect)`);
                        t.writer = client.sessionId;
                    }
                    break;
                }
            }
            
            console.log(`[QuizRoom] lockAnswer: client.sessionId=${client.sessionId}, playerId=${playerId}, found team=${!!team}, teamId=${teamId}, locked=${team?.locked}, roundState=${this.state.roundState}`);
            
            if (!team) {
                console.log(`[QuizRoom] lockAnswer rejected: team not found for writer. sessionId=${client.sessionId}, playerId=${playerId}`);
                // Log all teams for debugging
                for (const [tId, t] of this.state.teams.entries()) {
                    console.log(`[QuizRoom] lockAnswer: Team ${tId} - writer=${t.writer}, writerPlayerId=${t.writerPlayerId}`);
                }
                client.send("ERROR", { message: "You are not the writer for any team" });
                return;
            }

            // Chapter 13: Use centralized moderation gate
            const canPerform = canPerformAction(this, {
                playerId: playerId,
                teamId: teamId,
                action: "lockAnswer"
            });
            if (!canPerform.ok) {
                return; // Silent failure
            }

            if (team.locked) {
                console.log(`[QuizRoom] lockAnswer rejected: team already locked`);
                client.send("ERROR", { message: "Answer already locked" });
                return;
            }
            if (this.state.roundState !== "ROUND_ACTIVE") {
                console.log(`[QuizRoom] lockAnswer rejected: round not active (state: ${this.state.roundState})`);
                client.send("ERROR", { message: "Round is not active" });
                return;
            }

            const answerText = message.answer || "";
            console.log(`[QuizRoom] lockAnswer: Setting answer for team ${teamId}: "${answerText}"`);
            team.answer = answerText;
            team.locked = true;

            this.broadcast("LOCK", { teamId });

            this.broadcastTeamUpdate();
            
            // Check if all teams are locked - if so, end round immediately
            this.checkAndEndRound();
        });

        // Chapter 11.5: Card system - delegate to cardSystem
        this.onMessage("castCard", (client, message) => {
            this.cardSystem.handleCastCard(client, message);
        });

        // Card Catalog v1: Client choice handlers
        this.onMessage("WRITER_CHOICE_RESPONSE", (client, message) => {
            if (client.metadata.isDisplay || client.metadata.role !== "student") return;
            const { teamId, chosenSessionId } = message;
            const team = this.state.teams.get(teamId);
            if (!team || team.writer !== client.sessionId) {
                client.send("ERROR", { message: "Only the current writer can choose" });
                return;
            }
            // Execute swap with chosen sessionId
            this.swapWriter(teamId, chosenSessionId, null, false, null);
        });

        this.onMessage("DECK_CARD_CHOICE_RESPONSE", (client, message) => {
            if (client.metadata.isDisplay || client.metadata.role !== "student") return;
            const { teamId, cardIndex } = message;
            const team = this.state.teams.get(teamId);
            if (!team || !team.deckSlots) return;
            
            const deckArray = Array.from(team.deckSlots);
            if (cardIndex < 0 || cardIndex >= deckArray.length || deckArray[cardIndex] === null) {
                client.send("ERROR", { message: "Invalid card selection" });
                return;
            }
            
            const chosenCard = deckArray[cardIndex];
            deckArray.splice(cardIndex, 1);
            deckArray.unshift(chosenCard);
            
            team.deckSlots.clear();
            deckArray.forEach(card => team.deckSlots.push(card));
            
            this.broadcastTeamUpdate();
            console.log(`[QuizRoom] Card ${chosenCard} moved to top of deck for team ${teamId}`);
        });

        this.onMessage("DECK_SLOT_SWAP_RESPONSE", (client, message) => {
            if (client.metadata.isDisplay || client.metadata.role !== "student") return;
            const { teamId, slotIndex1, slotIndex2 } = message;
            const team = this.state.teams.get(teamId);
            if (!team || !team.deckSlots) return;
            
            if (slotIndex1 < 0 || slotIndex1 >= 4 || slotIndex2 < 0 || slotIndex2 >= 4 || slotIndex1 === slotIndex2) {
                client.send("ERROR", { message: "Invalid slot indices" });
                return;
            }
            
            const deckArray = Array.from(team.deckSlots);
            [deckArray[slotIndex1], deckArray[slotIndex2]] = [deckArray[slotIndex2], deckArray[slotIndex1]];
            
            team.deckSlots.clear();
            deckArray.forEach(card => team.deckSlots.push(card));
            
            this.broadcastTeamUpdate();
            console.log(`[QuizRoom] Swapped deck slots ${slotIndex1} and ${slotIndex2} for team ${teamId}`);
        });

        this.onMessage("SUGGESTER_HIGHLIGHT_RESPONSE", (client, message) => {
            if (client.metadata.isDisplay || client.metadata.role !== "student") return;
            const { teamId, suggesterId, durationSeconds } = message;
            const team = this.state.teams.get(teamId);
            if (!team || team.writer !== client.sessionId) {
                client.send("ERROR", { message: "Only the current writer can choose" });
                return;
            }
            
            const expiresAt = Date.now() + ((durationSeconds || 15) * 1000);
            this.cardSystem.highlightedSuggesters.set(teamId, { suggesterId, expiresAt });
            console.log(`[QuizRoom] Suggester ${suggesterId} highlighted for team ${teamId}`);
        });

        // Chapter 16: Team deck editing
        this.onMessage("SET_TEAM_DECK_SLOT", async (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (client.metadata.role !== "student") {
                client.send("ERROR", { message: "Only students can edit team decks." });
                return;
            }

            const { slotIndex, cardId } = message;

            // Find team for this client
            const { team, casterTeamId } = this.cardSystem.findTeamForClient(client);
            if (!team) {
                client.send("ERROR", { message: "You are not in a team" });
                return;
            }

            // Authorization: any team member can edit
            // (already verified by finding team)

            // Guards
            if (this.matchStarted || team.deckLocked) {
                client.send("ERROR", { message: "Deck is locked. Cannot edit deck after match starts." });
                return;
            }

            if (slotIndex < 0 || slotIndex > 3) {
                client.send("ERROR", { message: "Invalid slot index. Must be 0-3." });
                return;
            }

            // If cardId is provided, validate it
            if (cardId !== null && cardId !== undefined && cardId !== "") {
                // Card must exist in config (check both legacy CARDS and new catalog)
                const cardExists = CARDS[cardId] || CARD_CATALOG_V1_BY_ID[cardId];
                if (!cardExists) {
                    client.send("ERROR", { message: "Invalid card ID" });
                    return;
                }

                // Card must be in team's card pool
                // Check both catalog ID and legacy ID (teamCardPool may contain either)
                const isInPool = team.teamCardPool.includes(cardId);
                let legacyId = null;
                let catalogId = null;
                if (!isInPool) {
                    // Try converting catalog ID to legacy ID
                    const { getLegacyIdFromCatalogId, getCatalogIdFromLegacyId } = await import("./config/cards.catalog.v1.js");
                    legacyId = getLegacyIdFromCatalogId(cardId);
                    catalogId = getCatalogIdFromLegacyId(cardId);
                    
                    // Check if pool has legacy version of this catalog card
                    const hasLegacyVersion = legacyId && team.teamCardPool.includes(legacyId);
                    // Check if pool has catalog version of this legacy card
                    const hasCatalogVersion = catalogId && team.teamCardPool.includes(catalogId);
                    
                    if (!hasLegacyVersion && !hasCatalogVersion) {
                        console.log(`[QuizRoom] Card ${cardId} not in pool. Pool:`, Array.from(team.teamCardPool));
                        console.log(`[QuizRoom] Card validation - cardId: ${cardId}, legacyId: ${legacyId}, catalogId: ${catalogId}`);
                        console.log(`[QuizRoom] Pool check - hasLegacy: ${hasLegacyVersion}, hasCatalog: ${hasCatalogVersion}`);
                        client.send("ERROR", { message: "Card not available in team card pool" });
                        return;
                    }
                    // If we found a match via conversion, use the matched ID for the rest of validation
                    if (hasLegacyVersion) {
                        // The pool has the legacy version, so we'll allow it
                        console.log(`[QuizRoom] Card ${cardId} matched via legacy ID ${legacyId}`);
                    } else if (hasCatalogVersion) {
                        // The pool has the catalog version, so we'll allow it
                        console.log(`[QuizRoom] Card ${cardId} matched via catalog ID ${catalogId}`);
                    }
                }

                // Card must not be disabled for this match
                if (this.cardSystem.matchCardRules.disabledCards.has(cardId)) {
                    client.send("ERROR", { message: "This card is disabled for this match" });
                    return;
                }

                // Prevent duplicates in deck slots
                for (let i = 0; i < team.deckSlots.length; i++) {
                    if (i !== slotIndex && team.deckSlots[i] === cardId) {
                        client.send("ERROR", { message: "Card already in deck. Each card can only be used once." });
                        return;
                    }
                }
            }

            // Apply change
            team.deckSlots[slotIndex] = cardId || null;
            this.broadcastTeamUpdate();
            console.log(`[QuizRoom] Team ${casterTeamId} deck slot ${slotIndex} set to ${cardId || "empty"}`);
        });

        // Round management - Chapter 8: Round Lifecycle
        this.onMessage("SET_QUESTION", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (!client.metadata || client.metadata.role !== "teacher") {
                client.send("ERROR", { message: "Only teachers can set questions" });
                return;
            }

            // Only allow setting question in ROUND_WAITING or ROUND_ENDED states
            if (this.state.roundState !== "ROUND_WAITING" && this.state.roundState !== "ROUND_ENDED") {
                client.send("ERROR", { message: "Cannot set question during active or review round" });
                return;
            }

            if (!message.text || message.text.trim().length === 0) {
                client.send("ERROR", { message: "Question text cannot be empty" });
                return;
            }

            this.state.questionText = message.text.trim();
            this.broadcast("QUESTION_UPDATE", {
                question: this.state.questionText
            });

            console.log("[QuizRoom] Question set by teacher");
        });

        this.onMessage("START_ROUND", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (!client.metadata || client.metadata.role !== "teacher") {
                client.send("ERROR", { message: "Only teachers can start rounds" });
                return;
            }

            // Prevent starting new round if match is over
            if (this.scores.matchOver) {
                console.log("[QuizRoom] Cannot start new round: match is over");
                client.send("ERROR", { message: "Cannot start new round: match has already ended" });
                return;
            }

            // Validate question exists
            if (!this.state.questionText || this.state.questionText.trim().length === 0) {
                client.send("ERROR", { message: "Please set a question before starting the round" });
                return;
            }

            // Only allow starting from ROUND_WAITING state
            if (this.state.roundState !== "ROUND_WAITING") {
                client.send("ERROR", { message: `Cannot start round from ${this.state.roundState} state` });
                return;
            }

            // Increment round number
            this.scores.roundNumber += 1;

            // Rotate writers
            this.rotateWriters();

            // Clear old answers and effects
            this.state.activeEffects.clear();
            for (const team of this.state.teams.values()) {
                team.answer = "";
                team.locked = false;
                team.suggestions.clear();
                // Initialize gold: 5 per team
                team.gold = 5;
                const teamId = Array.from(this.state.teams.entries()).find(([_, t]) => t === team)[0];
                this.state.gold.set(teamId, 5);
            }

            // Transition to ROUND_ACTIVE
            this.state.roundState = "ROUND_ACTIVE";
            
            // Chapter 16: Lock decks when match starts (Round 1)
            if (this.scores.roundNumber === 1 && !this.matchStarted) {
                this.matchStarted = true;
                // Lock all team decks
                for (const team of this.state.teams.values()) {
                    team.deckLocked = true;
                }
                console.log("[QuizRoom] Match started - decks locked");
                // Broadcast team update so clients know decks are locked
                this.broadcastTeamUpdate();
            }
            
            // Set timer duration if provided (optional)
            if (message.duration !== undefined) {
                this.state.timeRemaining = message.duration;
            }

            this.broadcastGoldUpdate();
            this.broadcast("ROUND_STATE_UPDATE", {
                state: this.state.roundState,
                roundNumber: this.scores.roundNumber
            });
            this.broadcast("ROUND_STARTED", {
                question: this.state.questionText,
                duration: this.state.timeRemaining
            });

            // Start timer if enabled
            if (this.state.timerEnabled) {
                this.startTimer();
            }
            this.checkAndEndRound();

            console.log(`[QuizRoom] Round ${this.scores.roundNumber} started`);
        });

        this.onMessage("END_ROUND", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (!client.metadata || client.metadata.role !== "teacher") {
                client.send("ERROR", { message: "Only teachers can end rounds" });
                return;
            }

            // Only allow ending from ROUND_ACTIVE state
            if (this.state.roundState !== "ROUND_ACTIVE") {
                client.send("ERROR", { message: `Cannot end round from ${this.state.roundState} state` });
                return;
            }

            // Stop timer if running
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }

            // Transition to ROUND_REVIEW and collect answers
            this.state.roundState = "ROUND_REVIEW";
            this.endRound();

            console.log(`[QuizRoom] Round ${this.scores.roundNumber} ended by teacher`);
        });

        this.onMessage("NEXT_ROUND", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (!client.metadata || client.metadata.role !== "teacher") {
                client.send("ERROR", { message: "Only teachers can advance to next round" });
                return;
            }

            // Only allow from ROUND_ENDED state
            if (this.state.roundState !== "ROUND_ENDED") {
                client.send("ERROR", { message: `Cannot advance to next round from ${this.state.roundState} state` });
                return;
            }

            // Transition to ROUND_WAITING
            this.state.roundState = "ROUND_WAITING";
            this.state.questionText = ""; // Clear question text

            // Broadcast state update
            this.broadcast("ROUND_STATE_UPDATE", {
                state: this.state.roundState,
                roundNumber: this.scores.roundNumber
            });
            
            // Broadcast question update with empty string to clear UI
            this.broadcast("QUESTION_UPDATE", {
                question: ""
            });

            console.log("[QuizRoom] Advanced to next round (ROUND_WAITING)");
        });

        this.onMessage("ENABLE_TIMER", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (!client.metadata || client.metadata.role !== "teacher") {
                client.send("ERROR", { message: "Only teachers can enable timer" });
                return;
            }

            const duration = message.duration || 60;
            this.state.timerEnabled = true;
            this.state.timeRemaining = duration;

            // If round is active, start timer immediately
            if (this.state.roundState === "ROUND_ACTIVE") {
                this.startTimer();
            }

            this.broadcast("TIMER_UPDATE", {
                timeRemaining: this.state.timeRemaining,
                enabled: true
            });

            console.log(`[QuizRoom] Timer enabled with duration ${duration}`);
        });

        this.onMessage("DISABLE_TIMER", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (!client.metadata || client.metadata.role !== "teacher") {
                client.send("ERROR", { message: "Only teachers can disable timer" });
                return;
            }

            this.state.timerEnabled = false;

            // Stop timer if running
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }

            this.broadcast("TIMER_UPDATE", {
                timeRemaining: this.state.timeRemaining,
                enabled: false
            });

            console.log("[QuizRoom] Timer disabled");
        });

        // Legacy handler for backward compatibility (can be removed later)
        this.onMessage("startRound", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (!client.metadata || client.metadata.role !== "teacher") return;

            // Prevent starting new round if match is over
            if (this.scores.matchOver) {
                console.log("[QuizRoom] Cannot start new round: match is over");
                client.send("ERROR", { message: "Cannot start new round: match has already ended" });
                return;
            }

            // Set question if provided
            if (message.question) {
                this.state.questionText = message.question;
                this.broadcast("QUESTION_UPDATE", {
                    question: this.state.questionText
                });
            }

            // Convert to new START_ROUND format
            if (this.state.roundState === "ROUND_WAITING" && this.state.questionText) {
                // Increment round number
                this.scores.roundNumber += 1;

                // Rotate writers
                this.rotateWriters();

                // Clear old answers and effects
                this.state.activeEffects.clear();
                for (const team of this.state.teams.values()) {
                    team.answer = "";
                    team.locked = false;
                    team.suggestions.clear();
                    team.gold = 5;
                    const teamId = Array.from(this.state.teams.entries()).find(([_, t]) => t === team)[0];
                    this.state.gold.set(teamId, 5);
                }

                // Transition to ROUND_ACTIVE
                this.state.roundState = "ROUND_ACTIVE";
                if (message.duration !== undefined) {
                    this.state.timeRemaining = message.duration;
                }

                this.broadcastGoldUpdate();
                this.broadcast("ROUND_STATE_UPDATE", {
                    state: this.state.roundState,
                    roundNumber: this.scores.roundNumber
                });
                this.broadcast("ROUND_STARTED", {
                    question: this.state.questionText,
                    duration: this.state.timeRemaining
                });

                // Start timer if enabled
                if (this.state.timerEnabled) {
                    this.startTimer();
                }
                this.checkAndEndRound();
            }
        });

        // Team settings
        this.onMessage("setTeamSettings", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (!client.metadata || client.metadata.role !== "teacher") return;

            if (message.minTeamSize !== undefined) {
                this.minTeamSize = Math.max(1, message.minTeamSize);
            }
            if (message.maxTeamSize !== undefined) {
                this.maxTeamSize = Math.max(1, message.maxTeamSize);
            }

            this.broadcast("TEAM_SETTINGS_UPDATE", {
                minTeamSize: this.minTeamSize,
                maxTeamSize: this.maxTeamSize
            });

            this.broadcastAvailableTeams();
        });

        // Match settings
        this.onMessage("setMatchSettings", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (!client.metadata || client.metadata.role !== "teacher") return;
            if (this.scores.matchOver) return; // Can't change settings after match ends

            if (message.roundsToWin !== undefined) {
                MATCH_SETTINGS.roundsToWin = Math.max(1, message.roundsToWin);
            }
            if (message.maxRounds !== undefined) {
                MATCH_SETTINGS.maxRounds = message.maxRounds === null ? null : Math.max(1, message.maxRounds);
            }

            this.broadcast("MATCH_SETTINGS_UPDATE", {
                roundsToWin: MATCH_SETTINGS.roundsToWin,
                maxRounds: MATCH_SETTINGS.maxRounds
            });

            console.log(`[QuizRoom] Match settings updated: roundsToWin=${MATCH_SETTINGS.roundsToWin}, maxRounds=${MATCH_SETTINGS.maxRounds}`);
        });

        // End match manually
        this.onMessage("endMatch", (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (!client.metadata || client.metadata.role !== "teacher") return;
            if (this.scores.matchOver) return; // Match already over

            // Determine winner by current round points
            let winnerTeamId = null;
            let maxPoints = -1;
            for (const [teamId, roundPoints] of this.scores.teams.entries()) {
                if (roundPoints > maxPoints) {
                    maxPoints = roundPoints;
                    winnerTeamId = teamId;
                }
            }
            // If tie, no winner (or could use first team, but null is safer)
            if (maxPoints === 0) winnerTeamId = null;

            this.scores.matchOver = true;
            this.scores.winner = winnerTeamId;
            this.state.roundState = "ROUND_ENDED"; // Match ended - set final state

            // Award XP and broadcast MATCH_OVER
            this.scoringSystem.awardScoringXP(null, true);
            this.scoringSystem.flushAllXP();

            const finalScoresObj = {};
            for (const [teamId, points] of this.scores.teams.entries()) {
                finalScoresObj[teamId] = points;
            }
            
            const finalPerPlayerObj = {};
            for (const [playerId, data] of this.scores.perPlayer.entries()) {
                finalPerPlayerObj[playerId] = {
                    roundScores: data.roundScores,
                    totalEvaluationScore: data.totalEvaluationScore
                };
            }
            
            // Find MVP (highest totalEvaluationScore)
            let mvp = null;
            let maxScore = -1;
            for (const [playerId, data] of this.scores.perPlayer.entries()) {
                if (data.totalEvaluationScore > maxScore) {
                    maxScore = data.totalEvaluationScore;
                    mvp = playerId;
                }
            }
            
            this.broadcast("MATCH_OVER", {
                winner: winnerTeamId,
                finalScores: {
                    teams: finalScoresObj,
                    perPlayer: finalPerPlayerObj
                },
                mvp: mvp
            });

            // Chapter 12: Reset moderation state when match ends
            this.resetModerationState();

            console.log(`[QuizRoom] Match ended manually. Winner: ${winnerTeamId}`);
        });

        // Reset match to start a new match
        this.onMessage("RESET_MATCH", async (client, message) => {
            if (client.metadata.isDisplay) {
                client.send("ERROR", { message: "Display clients cannot perform this action." });
                return;
            }
            if (!client.metadata || client.metadata.role !== "teacher") {
                client.send("ERROR", { message: "Only teachers can reset matches" });
                return;
            }

            // Reset match state
            this.scores.matchOver = false;
            this.scores.winner = null;
            this.scores.roundNumber = 0;
            this.scores.teams.clear();
            this.scores.perPlayer.clear();
            this.scores.roundScores.clear();
            this.answers.clear();
            
            // Chapter 16: Reset match lifecycle and deck state
            this.matchStarted = false;
            for (const team of this.state.teams.values()) {
                // Reset deck slots to empty
                team.deckSlots = new ArraySchema(null, null, null, null);
                team.deckLocked = false;
                team.teamCardPool = new ArraySchema();
            }
            
            // Reset round state
            this.state.roundState = "ROUND_WAITING";
            this.state.questionText = "";
            this.state.timeRemaining = 0;
            this.state.timerEnabled = false;
            this.state.activeEffects.clear();

            // Chapter 11.5: reset match-level card rules - delegate to cardSystem
            this.cardSystem.resetRules();
            
            // Chapter 12: Reset moderation state on match reset
            this.resetModerationState();
            
            // Auto-load teacher's default card settings if available
            if (client.metadata && client.metadata.playerId) {
                try {
                    const { getTeacherDefaultSettings } = await import("./services/teacherCardSettings.js");
                    const defaults = getTeacherDefaultSettings(client.metadata.playerId);
                    if (defaults && (defaults.disabledCards.length > 0 || Object.keys(defaults.goldCostModifiers).length > 0)) {
                        console.log(`[QuizRoom] Auto-loading default card settings for teacher ${client.metadata.playerId}`);
                        // Apply defaults
                        for (const cardId of defaults.disabledCards) {
                            try {
                                this.cardSystem.disableCard(cardId);
                            } catch (error) {
                                console.warn(`[QuizRoom] Failed to disable card ${cardId}:`, error.message);
                            }
                        }
                        for (const [cardId, multiplier] of Object.entries(defaults.goldCostModifiers)) {
                            try {
                                this.cardSystem.setCostModifier(cardId, multiplier);
                            } catch (error) {
                                console.warn(`[QuizRoom] Failed to set modifier for ${cardId}:`, error.message);
                            }
                        }
                        // Broadcast the update
                        this.cardSystem.broadcastRulesUpdate();
                        console.log(`[QuizRoom] Default card settings auto-loaded`);
                    }
                } catch (error) {
                    console.warn(`[QuizRoom] Failed to auto-load default card settings:`, error.message);
                }
            }
            
            // Reset team answers and gold
            for (const [teamId, team] of this.state.teams.entries()) {
                team.answer = "";
                team.locked = false;
                team.suggestions.clear();
                team.gold = 5; // Reset to initial gold
                this.state.gold.set(teamId, 5);
            }

            // Broadcast reset state
            this.broadcast("MATCH_RESET", {
                message: "Match has been reset. Ready for a new match."
            });
            
            // Broadcast round state update
            this.broadcast("ROUND_STATE_UPDATE", {
                state: this.state.roundState,
                roundNumber: this.scores.roundNumber
            });
            
            // Broadcast question update (empty)
            this.broadcast("QUESTION_UPDATE", {
                question: ""
            });
            
            // Broadcast team update
            this.broadcastTeamUpdate();
            
            console.log(`[QuizRoom] Match reset by teacher`);
        });

        // Chapter 11.5: Effect expiration check (every second) - delegate to cardSystem
        setInterval(() => {
            this.cardSystem.checkEffectExpiration();
        }, 1000);
    }

    // Chapter 11.5: broadcast current match-level card rules - delegate to cardSystem
    broadcastCardRulesUpdate() {
        this.cardSystem.broadcastRulesUpdate();
    }

    onJoin(client, options) {
        const role = options.role || "student";
        client.metadata = { role };
        
        logDebug(`[QuizRoom] Client joined: role=${role}, sessionId=${client.sessionId}`);
        
        // Chapter 9: Handle display role
        if (role === "display") {
            client.metadata.isDisplay = true;
            // Display clients don't need playerId, team assignments, or XP
            // They just receive state updates
            logDebug(`[QuizRoom] Display client joined, initial state sync: roundState=${this.state.roundState}, teams=${this.state.teams.size}`);
        } else {
            // Verify JWT token if provided (for non-display clients)
            if (options.token) {
                const decoded = verifyToken(options.token);
                if (decoded) {
                    client.metadata.playerId = decoded.playerId;
                    client.metadata.isTeacher = decoded.isTeacher || false;

                    // Load unlocked cards (if not teacher)
                    if (!client.metadata.isTeacher) {
                        const unlockedCards = getPlayerUnlockedCards(decoded.playerId);
                        client.metadata.unlockedCards = unlockedCards;
                        // XP cache will be initialized automatically when XP is first awarded
                    }
                }
            }
        }

        // If teams initialized from lobby, assign player to their team (skip for display)
        if (this.teamAssignments && client.metadata.playerId && !client.metadata.isDisplay) {
            const playerId = client.metadata.playerId;
            // #region agent log
            console.log(`[QuizRoom] onJoin: Looking for player assignment for playerId: ${playerId}`);
            console.log(`[QuizRoom] onJoin: playerAssignments Map has ${this.playerAssignments?.size || 0} entries`);
            console.log(`[QuizRoom] onJoin: playerAssignments keys:`, this.playerAssignments ? Array.from(this.playerAssignments.keys()) : 'null');
            console.log(`[QuizRoom] onJoin: matchOver=${this.scores.matchOver}, roundState=${this.state.roundState}`);
            // #endregion
            const playerAssignment = this.playerAssignments?.get(playerId);
            // #region agent log
            console.log(`[QuizRoom] onJoin: Found playerAssignment:`, playerAssignment);
            // #endregion
            
            if (playerAssignment) {
                const teamId = playerAssignment.teamId;
                let team = this.state.teams.get(teamId);
                console.log(`[QuizRoom] onJoin: Team ${teamId} exists:`, !!team);
                
                // If team doesn't exist but we have team assignment data, recreate it
                if (!team && this.teamAssignments && this.teamAssignments.has(teamId)) {
                    console.log(`[QuizRoom] onJoin: Team ${teamId} was deleted, recreating from teamAssignments`);
                    const teamData = this.teamAssignments.get(teamId);
                    team = new TeamState();
                    team.writer = "";  // Will be set below
                    team.writerPlayerId = teamData.writerId || "";
                    team.answer = "";
                    team.locked = false;
                    team.gold = this.state.gold.get(teamId) || 0; // Preserve gold if it exists
                    team.name = teamData.name || teamId;
                    this.state.teams.set(teamId, team);
                    if (!this.state.gold.has(teamId)) {
                        this.state.gold.set(teamId, team.gold);
                    }
                }
                
                if (team) {
                    // Use writerPlayerId to track writer by playerId, not sessionId
                    // This handles reconnects properly
                    
                    // Check if this player is the designated writer (by writerPlayerId from lobby)
                    const isDesignatedWriter = team.writerPlayerId === playerId || playerAssignment.isWriter;
                    
                    if (isDesignatedWriter) {
                        // Update writer to this client's sessionId
                        team.writer = client.sessionId;
                        team.writerPlayerId = playerId;
                    } else {
                        // This player is a suggester
                        // Clean up any stale sessionIds (not in connected clients)
                        const connectedSessionIds = new Set(this.clients.map(c => c.sessionId));
                        const validSuggesters = [];
                        for (const s of team.suggesters) {
                            if (connectedSessionIds.has(s) && s !== client.sessionId) {
                                validSuggesters.push(s);
                            }
                        }
                        team.suggesters.clear();
                        validSuggesters.forEach(s => team.suggesters.push(s));
                        
                        // Add this player as suggester
                        team.suggesters.push(client.sessionId);
                    }
                    
                    // Delay sending TEAM_JOINED to allow client to register handlers
                    // This prevents the race condition where message arrives before handler is ready
                    setTimeout(async () => {
                        // Chapter 16: Update team card pool when player joins from lobby
                        await this.updateTeamCardPool(teamId);
                        client.send("TEAM_JOINED", {
                            teamId,
                            isWriter: team.writer === client.sessionId,
                            writer: team.writer,
                            suggesters: Array.from(team.suggesters),
                            currentAnswer: team.answer,
                            teamName: team.name || teamId
                        });
                        this.broadcastTeamUpdate();
                    }, 100);
                    
                } else {
                    console.error(`[QuizRoom] Team ${teamId} not found in state.teams`);
                }
            } else {
                console.error(`[QuizRoom] Player ${playerId} not found in playerAssignments`);
            }
        } else if (!client.metadata.isTeacher && !client.metadata.isDisplay) {
            // Student joined without team assignments - this shouldn't happen from lobby
            console.warn(`[QuizRoom] Student ${client.metadata.playerId} joined without team assignments`);
        }

        // If teacher joins, send them current teams immediately and room ID
        if (client.metadata.isTeacher) {
            // Send room ID to teacher so they can store it for display
            // In Colyseus, room ID is available as this.roomId
            const roomId = this.roomId || this.id;
            if (roomId) {
                client.send("ROOM_ID", { roomId: roomId });
                console.log(`[QuizRoom] Sent room ID to teacher: ${roomId}`);
            } else {
                console.warn("[QuizRoom] Room ID not available when teacher joined");
            }
            setTimeout(() => {
                this.sendTeamUpdateToClient(client);
            }, 100);
        }
        
        // Chapter 9/11: If display client joins, send them current teams and card rules
        // Use same delay as initial state to ensure handlers are registered
        if (client.metadata.isDisplay) {
            setTimeout(() => {
                this.sendTeamUpdateToClient(client);
                // Also send initial card rules so display is in sync
                if (this.matchCardRules) {
                    client.send("CARD_RULES_UPDATE", {
                        disabledCards: Array.from(this.matchCardRules.disabledCards || []),
                        goldCostModifiers: { ...(this.matchCardRules.goldCostModifiers || {}) }
                    });
                }
            }, 300);
        }

        // Delay sending initial state to allow client to register handlers
        // Increased delay for display clients to ensure handlers are registered
        // Use longer delay for display to ensure all handlers are registered
        const delay = client.metadata.isDisplay ? 300 : 150;
        setTimeout(() => {
            // Chapter 9: Send initial state to display clients
            if (client.metadata.isDisplay) {
                // Send round state
                client.send("ROUND_STATE_UPDATE", {
                    state: this.state.roundState || "ROUND_WAITING",
                    roundNumber: this.scores.roundNumber
                });
                
                // Send current question
                if (this.state.questionText) {
                    client.send("QUESTION_UPDATE", {
                        question: this.state.questionText
                    });
                }
                
                // Send timer state
                client.send("TIMER_UPDATE", {
                    timeRemaining: this.state.timeRemaining,
                    enabled: this.state.timerEnabled
                });
                
                // Send gold update
                const goldData = {};
                for (const [teamId, gold] of this.state.gold.entries()) {
                    goldData[teamId] = gold;
                }
                client.send("GOLD_UPDATE", { gold: goldData });
                
                // If match is over, send MATCH_OVER
                if (this.scores.matchOver) {
                    const finalScoresObj = {};
                    for (const [teamId, points] of this.scores.teams.entries()) {
                        finalScoresObj[teamId] = points;
                    }
                    
                    const finalPerPlayerObj = {};
                    for (const [playerId, data] of this.scores.perPlayer.entries()) {
                        finalPerPlayerObj[playerId] = {
                            roundScores: data.roundScores,
                            totalEvaluationScore: data.totalEvaluationScore
                        };
                    }
                    
                    // Find MVP
                    let mvp = null;
                    let maxScore = -1;
                    for (const [playerId, data] of this.scores.perPlayer.entries()) {
                        if (data.totalEvaluationScore > maxScore) {
                            maxScore = data.totalEvaluationScore;
                            mvp = playerId;
                        }
                    }
                    
                    client.send("MATCH_OVER", {
                        winner: this.scores.winner,
                        finalScores: {
                            teams: finalScoresObj,
                            perPlayer: finalPerPlayerObj
                        },
                        mvp: mvp
                    });
                }
                
                // Send current round score if available
                if (this.scores.roundNumber > 0) {
                    const roundPointsObj = {};
                    for (const [teamId, points] of this.scores.teams.entries()) {
                        roundPointsObj[teamId] = points;
                    }
                    
                    client.send("ROUND_SCORE", {
                        roundNumber: this.scores.roundNumber,
                        roundPoints: { teams: roundPointsObj },
                        matchOver: this.scores.matchOver
                    });
                }
                
                // Send current match scores even if roundNumber is 0 (teams might exist)
                const currentScoresObj = {};
                for (const [teamId, points] of this.scores.teams.entries()) {
                    currentScoresObj[teamId] = points;
                }
                if (Object.keys(currentScoresObj).length > 0) {
                    client.send("ROUND_SCORE", {
                        roundNumber: this.scores.roundNumber,
                        roundPoints: { teams: currentScoresObj },
                        matchOver: this.scores.matchOver
                    });
                }
                
                return; // Don't process normal client flow for display
            }
            
            // If match is already over, send MATCH_OVER FIRST (before other messages)
            // This ensures the client knows the match is over and can display match results
            if (this.scores.matchOver) {
                // #region agent log
                console.log(`[QuizRoom] Match is over, sending MATCH_OVER to client ${client.sessionId} (role: ${client.metadata?.role || 'unknown'}). Winner: ${this.scores.winner}`);
                // #endregion
                
                const finalScoresObj = {};
                for (const [teamId, points] of this.scores.teams.entries()) {
                    finalScoresObj[teamId] = points;
                }
                
                const finalPerPlayerObj = {};
                for (const [playerId, data] of this.scores.perPlayer.entries()) {
                    finalPerPlayerObj[playerId] = {
                        roundScores: data.roundScores,
                        totalEvaluationScore: data.totalEvaluationScore
                    };
                }
                
                // Find MVP (highest totalEvaluationScore)
                let mvp = null;
                let maxScore = -1;
                for (const [playerId, data] of this.scores.perPlayer.entries()) {
                    if (data.totalEvaluationScore > maxScore) {
                        maxScore = data.totalEvaluationScore;
                        mvp = playerId;
                    }
                }
                
                client.send("MATCH_OVER", {
                    winner: this.scores.winner,
                    finalScores: {
                        teams: finalScoresObj,
                        perPlayer: finalPerPlayerObj
                    },
                    mvp: mvp
                });
                
                // #region agent log
                console.log(`[QuizRoom] MATCH_OVER sent to client ${client.sessionId}`);
                // #endregion
            } else {
                // #region agent log
                console.log(`[QuizRoom] Match not over (matchOver=${this.scores.matchOver}), not sending MATCH_OVER to client ${client.sessionId}`);
                // #endregion
                
                // Only send round state and other messages if match is NOT over
                // Send round state FIRST (before other messages) so handler can register it
                client.send("ROUND_STATE_UPDATE", {
                    state: this.state.roundState || "ROUND_WAITING",
                    roundNumber: this.scores.roundNumber
                });
                
                // Send current state
                if (this.state.roundState === "ROUND_ACTIVE") {
                    client.send("ROUND_STARTED", {
                        question: this.state.questionText,
                        duration: this.state.timeRemaining
                    });
                }

                // Send team settings
                client.send("TEAM_SETTINGS_UPDATE", {
                    minTeamSize: this.minTeamSize,
                    maxTeamSize: this.maxTeamSize
                });

                // Chapter 12: Send initial moderation state
                this.broadcastModerationUpdate();

                this.broadcastAvailableTeams();
            }
        }, 150);
    }

    onLeave(client, abandoned) {
        // Remove from teams
        for (const [teamId, team] of this.state.teams.entries()) {
            if (team.writer === client.sessionId) {
                if (team.suggesters.length > 0 && this.state.roundState !== "ROUND_ACTIVE") {
                    // Transfer writer role
                    const newWriter = team.suggesters[0];
                    team.writer = newWriter;
                    team.suggesters.splice(0, 1);
                } else if (this.state.roundState !== "ROUND_ACTIVE") {
                    // Delete empty team
                    this.state.teams.delete(teamId);
                    this.state.gold.delete(teamId);
                }
            } else {
                const suggesterIndex = team.suggesters.findIndex(s => s === client.sessionId);
                if (suggesterIndex >= 0) {
                    team.suggesters.splice(suggesterIndex, 1);
                    if (team.suggesters.length === 0 && this.state.roundState !== "ROUND_ACTIVE") {
                        this.state.teams.delete(teamId);
                        this.state.gold.delete(teamId);
                    }
                }
            }
        }

        // Clear XP cache if player left (delegate to scoringSystem)
        if (client.metadata && client.metadata.playerId) {
            // XP cache is managed by scoringSystem - no need to manually delete
            // The scoringSystem will handle cleanup when XP is flushed
        }

        if (this.clients.length === 0 && this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        this.broadcastTeamUpdate();
        this.broadcastAvailableTeams();
    }

    initializeTeamsFromLobby(teamsData, playersData) {
        // teamsData: { teamId: { playerIds: [], writerId: null } }
        // playersData: { playerId: { teamId, displayName, isWriter } }
        
        // Store team assignment mapping for use in onJoin
        this.teamAssignments = new Map();
        
        for (const [teamId, teamData] of Object.entries(teamsData)) {
            const team = new TeamState();
            team.writer = "";  // Will be set when players join
            team.writerPlayerId = teamData.writerId || ""; // Store the designated writer's playerId
            team.answer = "";
            team.locked = false;
            team.gold = 0;
            team.name = teamData.name || teamId; // Store team name from lobby
            // Chapter 16: Initialize deck slots (4 empty slots)
            team.deckSlots = new ArraySchema(null, null, null, null);
            team.deckLocked = false;
            team.teamCardPool = new ArraySchema();
            this.state.teams.set(teamId, team);
            this.state.gold.set(teamId, 0);
            
            // Store team assignment mapping
            this.teamAssignments.set(teamId, teamData);
            
            // Initialize writer rotation index to 0 (first writer from lobby is index 0)
            this.writerRotationIndices.set(teamId, 0);
        }
        
        // Store player assignments for lookup
        this.playerAssignments = new Map();
        for (const [playerId, playerData] of Object.entries(playersData)) {
            this.playerAssignments.set(playerId, playerData);
        }
        
        console.log(`[QuizRoom] Initialized ${this.teamAssignments.size} teams from lobby`);
    }

    onDispose() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    startTimer() {
        // Only start timer if enabled and round is active
        if (!this.state.timerEnabled || this.state.roundState !== "ROUND_ACTIVE") {
            return;
        }

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        this.timerInterval = setInterval(() => {
            // Stop if round is no longer active or timer disabled
            if (this.state.roundState !== "ROUND_ACTIVE" || !this.state.timerEnabled) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                return;
            }

            // Chapter 13: Pause timer if round is frozen (use moderation gate)
            if (isRoundFrozen(this)) {
                return; // Don't decrement timer when round is frozen - timer stays constant
            }

            // Card Catalog v1: Check for timer pause (per team - for now check all teams)
            // Note: Timer is global, so we check if ANY team has pause active
            let isPaused = false;
            for (const [teamId] of this.state.teams.entries()) {
                if (this.cardSystem.isTimerPaused(teamId)) {
                    isPaused = true;
                    break;
                }
            }
            if (isPaused) {
                return; // Don't decrement when paused
            }

            // Card Catalog v1: Check for timer start delay
            let isDelayed = false;
            for (const [teamId] of this.state.teams.entries()) {
                if (this.cardSystem.isTimerStartDelayed(teamId)) {
                    isDelayed = true;
                    break;
                }
            }
            if (isDelayed) {
                return; // Don't start counting down until delay expires
            }

            // Card Catalog v1: Apply rate multipliers (check all teams, use highest multiplier)
            let maxMultiplier = 1.0;
            for (const [teamId] of this.state.teams.entries()) {
                const multiplier = this.cardSystem.getTimerRateMultiplier(teamId);
                if (multiplier > maxMultiplier) {
                    maxMultiplier = multiplier;
                }
            }
            
            // Decrement by multiplier (e.g., 1.25x means subtract 1.25 seconds per tick)
            const decrement = 1.0 * maxMultiplier;
            this.state.timeRemaining = Math.max(0, this.state.timeRemaining - decrement);

            this.broadcast("TIMER_UPDATE", {
                timeRemaining: this.state.timeRemaining,
                enabled: this.state.timerEnabled
            });

            // Card Catalog v1: Check for scheduled swaps
            for (const [teamId, scheduled] of this.cardSystem.scheduledSwaps.entries()) {
                if (Date.now() >= scheduled.swapAt) {
                    // Execute scheduled swap
                    const team = this.state.teams.get(teamId);
                    if (team && team.suggesters.length > 0) {
                        // Swap with random suggester
                        const randomIndex = Math.floor(Math.random() * team.suggesters.length);
                        const newWriter = team.suggesters[randomIndex];
                        this.swapWriter(teamId, newWriter, null, false, null);
                        this.cardSystem.scheduledSwaps.delete(teamId);
                        console.log(`[QuizRoom] Scheduled swap executed for team ${teamId}`);
                    }
                }
            }

            // Auto-end round when timer reaches 0 (only if timer is enabled)
            if (this.state.timeRemaining <= 0 && this.state.timerEnabled) {
                // Card Catalog v1: Check for overtime clause before ending
                let overtimeApplied = false;
                for (const [teamId, team] of this.state.teams.entries()) {
                    const usedRounds = this.cardSystem.overtimeClauseUsed.get(teamId);
                    const currentRound = this.scores.roundNumber;
                    if (!usedRounds || !usedRounds.has(currentRound)) {
                        // Find active overtime clause effect
                        const activeEffect = this.state.activeEffects.get(teamId);
                        if (activeEffect && activeEffect.effectType === "TIMER_OVERTIME_CLAUSE") {
                            const safetySeconds = activeEffect.effectParams.safetySeconds || 5;
                            this.state.timeRemaining = safetySeconds;
                            if (!usedRounds) {
                                this.cardSystem.overtimeClauseUsed.set(teamId, new Set());
                            }
                            this.cardSystem.overtimeClauseUsed.get(teamId).add(currentRound);
                            overtimeApplied = true;
                            this.broadcast("TIMER_UPDATE", {
                                timeRemaining: this.state.timeRemaining,
                                enabled: this.state.timerEnabled
                            });
                            console.log(`[QuizRoom] Overtime clause applied for team ${teamId}, timer set to ${safetySeconds} seconds`);
                            break;
                        }
                    }
                }
                
                if (!overtimeApplied) {
                    // Transition to ROUND_REVIEW and end round
                    this.state.roundState = "ROUND_REVIEW";
                    this.endRound();
                }
            }
        }, 1000);
    }

    checkAndEndRound() {
        if (this.state.roundState !== "ROUND_ACTIVE") return;

        // Check if all teams have locked answers
        let allTeamsLocked = true;
        for (const team of this.state.teams.values()) {
            if (!team.locked) {
                allTeamsLocked = false;
                break;
            }
        }

        if (allTeamsLocked && this.state.teams.size > 0) {
            // Set timer to 0 and end round immediately
            this.state.timeRemaining = 0;
            this.broadcast("TIMER_UPDATE", {
                timeRemaining: 0,
                enabled: this.state.timerEnabled
            });
            // Transition to ROUND_REVIEW and end round
            this.state.roundState = "ROUND_REVIEW";
            this.endRound();
        }
    }

    async endRound() {
        // Card Catalog v1: Calculate and award gold interest before ending round
        for (const [teamId, team] of this.state.teams.entries()) {
            const interest = this.cardSystem.goldInterest.get(teamId);
            if (interest) {
                const unspentGold = team.gold;
                const interestGain = Math.min(interest.maxGain, Math.floor(unspentGold / interest.rate));
                if (interestGain > 0) {
                    team.gold += interestGain;
                    this.state.gold.set(teamId, team.gold);
                    console.log(`[QuizRoom] Gold interest: +${interestGain} gold for team ${teamId} (unspent: ${unspentGold}, rate: ${interest.rate})`);
                }
            }
        }
        this.broadcastGoldUpdate();
        if (this.state.roundState !== "ROUND_ACTIVE" && this.state.roundState !== "ROUND_REVIEW") {
            // Already ended or not in correct state
            return;
        }

        // If called from END_ROUND handler, state is already ROUND_REVIEW
        // If called from timer or checkAndEndRound, need to transition
        if (this.state.roundState === "ROUND_ACTIVE") {
            this.state.roundState = "ROUND_REVIEW";
        }

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        this.state.activeEffects.clear();

        // Chapter 12: Reset moderation state on round end
        this.resetModerationState();

        // Chapter 11.5: Collect answers and award participation XP - delegate to scoringSystem
        const roundAnswers = this.scoringSystem.collectAnswers();
        
        // Build answers object for ROUND_DATA message
        const answersObj = {};
        for (const [teamId, answerData] of roundAnswers.entries()) {
            answersObj[teamId] = {
                text: answerData.text,
                writerId: answerData.writerId,
                suggesterIds: answerData.suggesterIds
            };
        }

        // Broadcast ROUND_DATA message (answers only, no scores)
        // Teacher will submit scores externally via /api/score/submit
        this.broadcast("ROUND_DATA", {
            roundNumber: this.scores.roundNumber,
            question: this.state.questionText,
            answers: answersObj,
            teamIds: Array.from(this.state.teams.keys())
        });

        // Award participation XP (+5) to all active players
        this.scoringSystem.awardParticipationXP();

        // Flush all XP
        this.scoringSystem.flushAllXP();

        // Build answers array for ROUND_ENDED (backward compatibility)
        const teamsArray = [];
        const answersArray = [];

        for (const [teamId, team] of this.state.teams.entries()) {
            // Get writer client to get display name
            const writerClient = this.clients.find(c => c.sessionId === team.writer);
            let writerName = team.writer; // Default to sessionId
            if (writerClient?.metadata?.playerId) {
                // Try to get displayName from database
                const player = db.prepare("SELECT displayName FROM players WHERE id = ?").get(writerClient.metadata.playerId);
                writerName = player?.displayName || writerClient.metadata.playerId;
            }
            
            // Log team answer for debugging
            console.log(`[QuizRoom] endRound - Team ${teamId}: answer="${team.answer}", locked=${team.locked}, answer length=${team.answer?.length || 0}`);
            
            teamsArray.push({
                teamId,
                name: team.name || teamId, // Include team name
                writer: team.writer,
                writerName: writerName, // Add writer display name
                suggesters: Array.from(team.suggesters),
                answer: team.answer || "", // Ensure answer is always a string
                locked: team.locked,
                gold: team.gold
            });

            // Include answer even if empty (so teacher can see which teams didn't answer)
            // But only add to answersArray if there's actual content
            if (team.answer && team.answer.trim().length > 0) {
                answersArray.push({
                    clientId: teamId,
                    text: team.answer,
                    teamId,
                    writer: writerName
                });
            }
        }

        // Broadcast ROUND_STATE_UPDATE (state is already ROUND_REVIEW)
        this.broadcast("ROUND_STATE_UPDATE", {
            state: this.state.roundState,
            roundNumber: this.scores.roundNumber
        });

        console.log("[QuizRoom] endRound - Broadcasting ROUND_ENDED");
        console.log("[QuizRoom] endRound - teamsArray length:", teamsArray.length);
        console.log("[QuizRoom] endRound - answersArray length:", answersArray.length);
        console.log("[QuizRoom] endRound - teamsArray:", JSON.stringify(teamsArray, null, 2));
        
        this.broadcast("ROUND_ENDED", {
            teams: teamsArray,
            answers: answersArray
        });

        this.broadcastTeamUpdate();

        console.log("[QuizRoom] Round ended. Answers collected:");
        teamsArray.forEach(team => {
            if (team.answer) {
                console.log(`  ${team.teamId}: ${team.answer}`);
            } else {
                console.log(`  ${team.teamId}: (no answer)`);
            }
        });
    }

    // Chapter 11.5: Wrapper method - delegate to cardSystem
    checkEffectExpiration() {
        this.cardSystem.checkEffectExpiration();
    }

    findTeamByMember(sessionId) {
        for (const team of this.state.teams.values()) {
            if (team.writer === sessionId) return team;
            if (team.suggesters.findIndex(s => s === sessionId) >= 0) return team;
        }
        return null;
    }

    getTeamMemberPlayerIds(teamId) {
        // Get all team members (writer + suggesters) by playerId
        const team = this.state.teams.get(teamId);
        if (!team) return [];

        const memberIds = new Set();
        
        // Add writer
        if (team.writerPlayerId) {
            memberIds.add(team.writerPlayerId);
        } else if (team.writer) {
            // Fallback: find playerId from sessionId
            const writerClient = this.clients.find(c => c.sessionId === team.writer);
            if (writerClient?.metadata?.playerId) {
                memberIds.add(writerClient.metadata.playerId);
            }
        }
        
        // Add suggesters
        for (const suggesterSessionId of team.suggesters) {
            const suggesterClient = this.clients.find(c => c.sessionId === suggesterSessionId);
            if (suggesterClient?.metadata?.playerId) {
                memberIds.add(suggesterClient.metadata.playerId);
            }
        }
        
        // Return sorted array for consistent rotation order
        return Array.from(memberIds).sort();
    }

    /**
     * Swap writer for a team (called from card effects)
     * @param {string} teamId - Team ID
     * @param {string} mode - Swap mode: "swapWithRandomSuggester", "roulette"
     * @param {number|null} durationSeconds - Duration in seconds, or null for rest of round
     * @param {boolean} revert - Whether to revert after duration
     * @param {EffectState} effect - The effect that triggered this swap
     */
    swapWriter(teamId, mode, durationSeconds, revert, effect) {
        const team = this.state.teams.get(teamId);
        if (!team) {
            console.warn(`[QuizRoom] swapWriter: Team ${teamId} not found`);
            return;
        }
        
        // Card Catalog v1: Check for writer lock
        if (this.cardSystem.isWriterLocked(teamId)) {
            console.log(`[QuizRoom] swapWriter: Blocked by writer lock for team ${teamId}`);
            return;
        }

        // Check for immunity
        const immunityEffect = this.state.activeEffects.get(teamId);
        if (immunityEffect && immunityEffect.effectType === "IMMUNITY") {
            const blocksTypes = immunityEffect.effectParams.blocksEffectTypes || [];
            if (blocksTypes.includes("WRITER_SWAP") || blocksTypes.includes("WRITER_ROULETTE") || blocksTypes.includes("WRITER_DOUBLE_SWAP")) {
                console.log(`[QuizRoom] swapWriter blocked by IMMUNITY for team ${teamId}`);
                return;
            }
        }

        const oldWriter = team.writer;
        const oldWriterPlayerId = team.writerPlayerId;
        let newWriter = null;
        let newWriterPlayerId = null;

        // Handle mode as sessionId if it's a direct swap (from WRITER_CHOOSE)
        if (mode && typeof mode === "string" && mode.length > 0 && mode !== "swapWithRandomSuggester" && mode !== "randomSuggester" && mode !== "roulette") {
            // This is a direct sessionId swap
            const newWriterSessionId = mode;
            const newWriterClient = this.clients.find(c => c.sessionId === newWriterSessionId);
            if (!newWriterClient) {
                console.warn(`[QuizRoom] swapWriter: New writer sessionId ${newWriterSessionId} not found`);
                return;
            }
            
            team.writer = newWriterSessionId;
            if (newWriterClient.metadata?.playerId) {
                team.writerPlayerId = newWriterClient.metadata.playerId;
            }
            
            // Remove new writer from suggesters
            const newWriterIndex = team.suggesters.indexOf(newWriterSessionId);
            if (newWriterIndex >= 0) {
                team.suggesters.splice(newWriterIndex, 1);
            }
            
            // Add old writer to suggesters
            if (oldWriter && oldWriter !== newWriterSessionId) {
                team.suggesters.push(oldWriter);
            }
            
            this.broadcast("WRITER_ROTATED", {
                teamId,
                writer: team.writer,
                writerPlayerId: team.writerPlayerId
            });
            this.updateTeamCardPool(teamId);
            this.broadcastTeamUpdate();
            console.log(`[QuizRoom] swapWriter: Direct swap for team ${teamId}, old: ${oldWriter}, new: ${newWriterSessionId}`);
            return;
        }

        if (mode === "swapWithRandomSuggester" || mode === "randomSuggester") {
            // Swap with random suggester
            if (!team.suggesters || team.suggesters.length === 0) {
                console.warn(`[QuizRoom] swapWriter: No suggesters available for team ${teamId}`);
                return;
            }
            const randomIndex = Math.floor(Math.random() * team.suggesters.length);
            newWriter = team.suggesters[randomIndex];
            team.suggesters.splice(randomIndex, 1);
            team.suggesters.push(oldWriter);
        } else if (mode === "roulette") {
            // Swap with random teammate (excluding current writer)
            const allMembers = [];
            if (team.writerPlayerId) {
                const writerClient = this.clients.find(c => c.metadata?.playerId === team.writerPlayerId);
                if (writerClient) allMembers.push({ sessionId: writerClient.sessionId, playerId: team.writerPlayerId });
            }
            team.suggesters.forEach(sessionId => {
                const suggesterClient = this.clients.find(c => c.sessionId === sessionId);
                if (suggesterClient && suggesterClient.metadata?.playerId) {
                    allMembers.push({ sessionId, playerId: suggesterClient.metadata.playerId });
                }
            });
            
            // Exclude current writer
            const availableMembers = allMembers.filter(m => m.sessionId !== oldWriter);
            if (availableMembers.length === 0) {
                console.warn(`[QuizRoom] swapWriter: No available teammates for roulette swap`);
                return;
            }
            
            const randomMember = availableMembers[Math.floor(Math.random() * availableMembers.length)];
            newWriter = randomMember.sessionId;
            newWriterPlayerId = randomMember.playerId;
            
            // Update suggesters array
            const oldWriterIndex = team.suggesters.indexOf(oldWriter);
            if (oldWriterIndex >= 0) {
                team.suggesters.splice(oldWriterIndex, 1);
            }
            team.suggesters.push(oldWriter);
        } else {
            console.warn(`[QuizRoom] swapWriter: Unknown mode ${mode}`);
            return;
        }

        // Update writer
        team.writer = newWriter;
        if (newWriterPlayerId) {
            team.writerPlayerId = newWriterPlayerId;
        } else {
            // Try to find playerId from client
            const newWriterClient = this.clients.find(c => c.sessionId === newWriter);
            if (newWriterClient && newWriterClient.metadata?.playerId) {
                team.writerPlayerId = newWriterClient.metadata.playerId;
            }
        }

        // Broadcast writer swap
        this.broadcast("WRITER_ROTATED", {
            teamId,
            writer: team.writer,
            writerPlayerId: team.writerPlayerId
        });

        // Update team card pool
        this.updateTeamCardPool(teamId);
        this.broadcastTeamUpdate();

        console.log(`[QuizRoom] swapWriter: Swapped writer for team ${teamId}, old: ${oldWriter}, new: ${newWriter}, mode: ${mode}`);

        // Handle revert if needed
        if (revert && durationSeconds) {
            setTimeout(() => {
                // Revert swap
                team.writer = oldWriter;
                team.writerPlayerId = oldWriterPlayerId;
                
                // Update suggesters
                const newWriterIndex = team.suggesters.indexOf(newWriter);
                if (newWriterIndex >= 0) {
                    team.suggesters.splice(newWriterIndex, 1);
                }
                team.suggesters.push(newWriter);
                
                this.broadcast("WRITER_ROTATED", {
                    teamId,
                    writer: team.writer,
                    writerPlayerId: team.writerPlayerId
                });
                this.updateTeamCardPool(teamId);
                this.broadcastTeamUpdate();
                console.log(`[QuizRoom] swapWriter: Reverted swap for team ${teamId}`);
            }, durationSeconds * 1000);
        }
    }

    rotateWriters() {
        // Rotate writer for each team
        for (const [teamId, team] of this.state.teams.entries()) {
            const memberIds = this.getTeamMemberPlayerIds(teamId);
            
            if (memberIds.length === 0) {
                console.warn(`[QuizRoom] No members found for team ${teamId}, skipping rotation`);
                continue;
            }
            
            // Get current rotation index (default to 0)
            let currentIndex = this.writerRotationIndices.get(teamId) || 0;
            
            // Special handling for single-person teams: they should always be the writer
            if (memberIds.length === 1) {
                const singlePersonId = memberIds[0];
                const singlePersonClient = this.clients.find(c => 
                    c.metadata?.playerId === singlePersonId
                );
                if (singlePersonClient) {
                    team.writer = singlePersonClient.sessionId;
                    team.writerPlayerId = singlePersonId;
                    team.suggesters.clear(); // Single person has no suggesters
                    this.writerRotationIndices.set(teamId, 0);
                    
                    // Broadcast writer rotation
                    this.broadcast("WRITER_ROTATED", {
                        teamId,
                        writer: team.writer,
                        writerPlayerId: team.writerPlayerId
                    });
                    
                    console.log(`[QuizRoom] Single-person team ${teamId}: ${singlePersonId} is writer`);
                }
                continue;
            }
            
            // Select next player in rotation (circular)
            const nextIndex = (currentIndex + 1) % memberIds.length;
            const nextWriterPlayerId = memberIds[nextIndex];
            
            // Find client by playerId (handle reconnects)
            const nextWriterClient = this.clients.find(c => 
                c.metadata?.playerId === nextWriterPlayerId
            );
            
            if (!nextWriterClient) {
                console.warn(`[QuizRoom] Writer playerId ${nextWriterPlayerId} not found in connected clients for team ${teamId}`);
                // Try next player in rotation
                const fallbackIndex = (nextIndex + 1) % memberIds.length;
                const fallbackPlayerId = memberIds[fallbackIndex];
                const fallbackClient = this.clients.find(c => 
                    c.metadata?.playerId === fallbackPlayerId
                );
                if (fallbackClient) {
                    team.writer = fallbackClient.sessionId;
                    team.writerPlayerId = fallbackPlayerId;
                    this.writerRotationIndices.set(teamId, fallbackIndex);
                }
                continue;
            }
            
            // Update writer
            const oldWriter = team.writer;
            team.writer = nextWriterClient.sessionId;
            team.writerPlayerId = nextWriterPlayerId;
            
            // Update suggesters list
            const connectedSessionIds = new Set(this.clients.map(c => c.sessionId));
            const newSuggesters = [];
            
            // Add old writer to suggesters if they're still connected
            if (oldWriter && connectedSessionIds.has(oldWriter) && oldWriter !== nextWriterClient.sessionId) {
                newSuggesters.push(oldWriter);
            }
            
            // Add all other team members as suggesters
            for (const memberId of memberIds) {
                if (memberId === nextWriterPlayerId) continue; // Skip new writer
                
                const memberClient = this.clients.find(c => 
                    c.metadata?.playerId === memberId && 
                    c.sessionId !== nextWriterClient.sessionId
                );
                if (memberClient && connectedSessionIds.has(memberClient.sessionId)) {
                    newSuggesters.push(memberClient.sessionId);
                }
            }
            
            team.suggesters.clear();
            newSuggesters.forEach(s => team.suggesters.push(s));
            
            // Update rotation index
            this.writerRotationIndices.set(teamId, nextIndex);
            
            // Broadcast writer rotation
            this.broadcast("WRITER_ROTATED", {
                teamId,
                writer: team.writer,
                writerPlayerId: team.writerPlayerId
            });
            
            console.log(`[QuizRoom] Rotated writer for team ${teamId}: ${nextWriterPlayerId} (index ${nextIndex}/${memberIds.length - 1})`);
        }
    }

    broadcastToTeam(teamId, type, message) {
        const team = this.state.teams.get(teamId);
        if (!team) return;

        const teamClients = this.clients.filter(c => 
            c.sessionId === team.writer || team.suggesters.findIndex(s => s === c.sessionId) >= 0
        );

        teamClients.forEach(client => {
            client.send(type, message);
        });
    }

    // Broadcast current match-level card rules to all connected clients
    broadcastCardRulesUpdate() {
        if (!this.matchCardRules) {
            return;
        }
        this.broadcast("CARD_RULES_UPDATE", {
            disabledCards: Array.from(this.matchCardRules.disabledCards || []),
            goldCostModifiers: { ...(this.matchCardRules.goldCostModifiers || {}) }
        });
    }

    // Broadcast full team state and current card rules to all non-display clients
    /**
     * Chapter 16: Compute team card pool (union of all team members' unlocked cards)
     */
    async computeTeamCardPool(teamId) {
        const team = this.state.teams.get(teamId);
        if (!team) {
            console.warn(`[QuizRoom] computeTeamCardPool: team ${teamId} not found`);
            return [];
        }

        // Collect all playerIds for this team
        const playerIds = new Set();
        
        // Get writer playerId
        if (team.writerPlayerId) {
            playerIds.add(team.writerPlayerId);
        } else if (team.writer) {
            const writerClient = this.clients.find(c => c.sessionId === team.writer);
            if (writerClient?.metadata?.playerId) {
                playerIds.add(writerClient.metadata.playerId);
            }
        }

        // Get suggester playerIds
        for (const suggesterSessionId of team.suggesters) {
            const suggesterClient = this.clients.find(c => c.sessionId === suggesterSessionId);
            if (suggesterClient?.metadata?.playerId) {
                playerIds.add(suggesterClient.metadata.playerId);
            }
        }

        // Union all unlocked cards
        const cardPoolSet = new Set();
        const { getLegacyIdFromCatalogId, getCatalogIdFromLegacyId } = await import("./config/cards.catalog.v1.js");
        
        for (const playerId of playerIds) {
            const unlockedCards = getPlayerUnlockedCards(playerId);
            for (const cardId of unlockedCards) {
                // Filter against authoritative card config (check both legacy and catalog)
                if (CARDS[cardId] || CARD_CATALOG_V1_BY_ID[cardId]) {
                    cardPoolSet.add(cardId);
                    
                    // Also add the corresponding catalog/legacy version for compatibility
                    if (CARDS[cardId]) {
                        // This is a legacy ID, also add catalog version if it exists
                        const catalogVersion = getCatalogIdFromLegacyId(cardId);
                        if (catalogVersion && CARD_CATALOG_V1_BY_ID[catalogVersion]) {
                            cardPoolSet.add(catalogVersion);
                        }
                    } else if (CARD_CATALOG_V1_BY_ID[cardId]) {
                        // This is a catalog ID, also add legacy version if it exists
                        const legacyVersion = getLegacyIdFromCatalogId(cardId);
                        if (legacyVersion && CARDS[legacyVersion]) {
                            cardPoolSet.add(legacyVersion);
                        }
                    }
                }
            }
        }

        return Array.from(cardPoolSet);
    }

    /**
     * Chapter 16: Recompute and update team card pool, then broadcast
     */
    async updateTeamCardPool(teamId) {
        const team = this.state.teams.get(teamId);
        if (!team) return;

        const pool = await this.computeTeamCardPool(teamId);
        team.teamCardPool = new ArraySchema(...pool);
        this.broadcastTeamUpdate();
        console.log(`[QuizRoom] Updated card pool for team ${teamId}: ${pool.length} cards`);
    }

    broadcastTeamUpdate() {
        const teamsData = {};
        for (const [teamId, team] of this.state.teams.entries()) {
            // Get writerPlayerId from team state or by looking up the writer client
            let writerPlayerId = team.writerPlayerId || "";
            if (!writerPlayerId && team.writer) {
                const writerClient = this.clients.find(c => c.sessionId === team.writer);
                if (writerClient && writerClient.metadata && writerClient.metadata.playerId) {
                    writerPlayerId = writerClient.metadata.playerId;
                }
            }
            
            // Get playerIds for suggesters
            const suggesterPlayerIds = [];
            for (const suggesterSessionId of team.suggesters) {
                const suggesterClient = this.clients.find(c => c.sessionId === suggesterSessionId);
                if (suggesterClient && suggesterClient.metadata && suggesterClient.metadata.playerId) {
                    suggesterPlayerIds.push({
                        sessionId: suggesterSessionId,
                        playerId: suggesterClient.metadata.playerId
                    });
                }
            }
            
            teamsData[teamId] = {
                teamId: teamId,
                name: team.name || teamId, // Include team name
                writer: team.writer,
                writerPlayerId: writerPlayerId, // Chapter 12: Include playerId for moderation
                suggesters: Array.from(team.suggesters),
                suggesterPlayerIds: suggesterPlayerIds, // Chapter 12: Include playerIds for suggesters
                answer: team.answer,
                locked: team.locked,
                gold: team.gold,
                suggestions: Array.from(team.suggestions).map(s => ({
                    text: s.text,
                    suggesterId: s.suggesterId,
                    timestamp: s.timestamp
                })),
                // Chapter 16: Include deck state
                deckSlots: Array.from(team.deckSlots || []),
                deckLocked: team.deckLocked || false,
                teamCardPool: Array.from(team.teamCardPool || [])
            };
        }

        this.broadcast("TEAM_UPDATE", { teams: teamsData });

        // Also broadcast current card rules so all clients stay in sync
        this.cardSystem.broadcastRulesUpdate();
    }
    
    sendTeamUpdateToClient(client) {
        // Send team update to a specific client (useful for teacher on join)
        const teamsData = {};
        for (const [teamId, team] of this.state.teams.entries()) {
            // Get writerPlayerId from team state or by looking up the writer client
            let writerPlayerId = team.writerPlayerId || "";
            if (!writerPlayerId && team.writer) {
                const writerClient = this.clients.find(c => c.sessionId === team.writer);
                if (writerClient && writerClient.metadata && writerClient.metadata.playerId) {
                    writerPlayerId = writerClient.metadata.playerId;
                }
            }
            
            // Get playerIds for suggesters
            const suggesterPlayerIds = [];
            for (const suggesterSessionId of team.suggesters) {
                const suggesterClient = this.clients.find(c => c.sessionId === suggesterSessionId);
                if (suggesterClient && suggesterClient.metadata && suggesterClient.metadata.playerId) {
                    suggesterPlayerIds.push({
                        sessionId: suggesterSessionId,
                        playerId: suggesterClient.metadata.playerId
                    });
                }
            }
            
            teamsData[teamId] = {
                teamId: teamId,
                name: team.name || teamId,
                writer: team.writer,
                writerPlayerId: writerPlayerId, // Chapter 12: Include playerId for moderation
                suggesters: Array.from(team.suggesters),
                suggesterPlayerIds: suggesterPlayerIds, // Chapter 12: Include playerIds for suggesters
                answer: team.answer,
                locked: team.locked,
                gold: team.gold,
                suggestions: Array.from(team.suggestions).map(s => ({
                    text: s.text,
                    suggesterId: s.suggesterId,
                    timestamp: s.timestamp
                })),
                // Chapter 16: Include deck state
                deckSlots: Array.from(team.deckSlots || []),
                deckLocked: team.deckLocked || false,
                teamCardPool: Array.from(team.teamCardPool || [])
            };
        }

        const teamCount = Object.keys(teamsData).length;
        const clientType = client.metadata.isDisplay ? "display" : (client.metadata.isTeacher ? "teacher" : "student");
        console.log(`[QuizRoom] Sending TEAM_UPDATE to ${clientType} client: ${teamCount} teams`);
        if (teamCount === 0) {
            console.warn(`[QuizRoom] WARNING: Sending TEAM_UPDATE with 0 teams to ${clientType} client. Room has ${this.state.teams.size} teams in state.`);
        }

        client.send("TEAM_UPDATE", { teams: teamsData });
    }

    broadcastAvailableTeams() {
        const availableTeams = [];

        for (const [teamId, team] of this.state.teams.entries()) {
            const currentSize = 1 + team.suggesters.length;
            if (currentSize < this.maxTeamSize) {
                const writerClient = this.clients.find(c => c.sessionId === team.writer);
                availableTeams.push({
                    teamId,
                    currentSize,
                    maxSize: this.maxTeamSize,
                    writerName: writerClient?.sessionId.substring(0, 20) || "Unknown"
                });
            }
        }

        this.broadcast("AVAILABLE_TEAMS", { teams: availableTeams });
    }

    broadcastGoldUpdate() {
        const goldData = {};
        for (const [teamId, gold] of this.state.gold.entries()) {
            goldData[teamId] = gold;
        }
        this.broadcast("GOLD_UPDATE", { gold: goldData });
    }

    // Chapter 11.5: Wrapper methods - delegate to scoringSystem (for backward compatibility with routes)
    addXPToCache(playerId, amount, reason) {
        this.scoringSystem.addXPToCache(playerId, amount, reason);
    }

    flushAllXP() {
        this.scoringSystem.flushAllXP();
    }

    determineRoundWinner(evaluationScores) {
        return this.scoringSystem.determineRoundWinner(evaluationScores);
    }

    checkMatchWinCondition() {
        return this.scoringSystem.checkMatchWinCondition();
    }

    awardScoringXP(roundWinner, matchWon) {
        this.scoringSystem.awardScoringXP(roundWinner, matchWon);
    }

    // Chapter 11.5: Wrapper methods - delegate to scoringSystem (for backward compatibility with routes)
    submitRoundScores(round, scores) {
        return this.scoringSystem.submitRoundScores(round, scores);
    }

    applyOverride(teamId, playerId, round, newEvaluationScore) {
        return this.scoringSystem.applyOverride(teamId, playerId, round, newEvaluationScore);
    }

    // Chapter 12: Reset moderation state (called on round/match transitions)
    resetModerationState() {
        if (!this.moderationState) return;
        this.moderationState.mutedPlayers.clear();
        this.moderationState.frozenTeams.clear();
        this.moderationState.roundFrozen = false;
        this.broadcastModerationUpdate();
    }

    // Chapter 12: Broadcast moderation state to all clients
    broadcastModerationUpdate() {
        if (!this.moderationState) return;
        this.broadcast("MODERATION_UPDATE", {
            mutedPlayers: Array.from(this.moderationState.mutedPlayers),
            frozenTeams: Array.from(this.moderationState.frozenTeams),
            roundFrozen: this.moderationState.roundFrozen
        });
    }
}
