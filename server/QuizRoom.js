import { Room } from "colyseus";
import { Schema, MapSchema, ArraySchema } from "@colyseus/schema";
import { verifyToken } from "./auth/auth.js";
import { getPlayerUnlockedCards } from "./services/xpService.js";
import { db } from "./db/database.js";
import { CardSystem } from "./systems/cardSystem.js";
import { ScoringSystem } from "./systems/scoringSystem.js";

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
            this.state.teams.set(teamId, team);
            this.state.gold.set(teamId, 0);

            // Delay sending TEAM_JOINED to allow client to register handlers
            setTimeout(() => {
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
            setTimeout(() => {
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
            if (!team || team.writer === client.sessionId) return; // Writers don't send suggestions

            const teamId = Array.from(this.state.teams.entries()).find(([_, t]) => t === team)[0];
            if (team.locked || this.state.roundState !== "ROUND_ACTIVE") return;

            const suggestion = new SuggestionState();
            suggestion.text = message.text;
            suggestion.suggesterId = client.sessionId;
            suggestion.timestamp = Date.now();

            team.suggestions.push(suggestion);

            // Award gold (+1) and XP (+1) for suggestion
            team.gold += 1;
            this.state.gold.set(teamId, team.gold);
            this.scoringSystem.addXPToCache(client.metadata.playerId, 1, "suggestionSubmitted");

            // Broadcast gold update
            this.broadcastGoldUpdate();

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

            console.log(`[QuizRoom] Match ended manually. Winner: ${winnerTeamId}`);
        });

        // Reset match to start a new match
        this.onMessage("RESET_MATCH", (client, message) => {
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
            
            // Reset round state
            this.state.roundState = "ROUND_WAITING";
            this.state.questionText = "";
            this.state.timeRemaining = 0;
            this.state.timerEnabled = false;
            this.state.activeEffects.clear();

            // Chapter 11.5: reset match-level card rules - delegate to cardSystem
            this.cardSystem.resetRules();
            
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
        
        // Chapter 9: Handle display role
        if (role === "display") {
            client.metadata.isDisplay = true;
            // Display clients don't need playerId, team assignments, or XP
            // They just receive state updates
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

                        // Initialize XP cache entry
                        this.xpCache.set(decoded.playerId, { totalXP: 0, reasons: [] });
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
                    setTimeout(() => {
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

        // Clear XP cache if player left
        if (client.metadata && client.metadata.playerId) {
            this.xpCache.delete(client.metadata.playerId);
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

            this.state.timeRemaining = Math.max(0, this.state.timeRemaining - 1);

            this.broadcast("TIMER_UPDATE", {
                timeRemaining: this.state.timeRemaining,
                enabled: this.state.timerEnabled
            });

            // Auto-end round when timer reaches 0 (only if timer is enabled)
            if (this.state.timeRemaining <= 0 && this.state.timerEnabled) {
                // Transition to ROUND_REVIEW and end round
                this.state.roundState = "ROUND_REVIEW";
                this.endRound();
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
    broadcastTeamUpdate() {
        const teamsData = {};
        for (const [teamId, team] of this.state.teams.entries()) {
            teamsData[teamId] = {
                teamId: teamId,
                name: team.name || teamId, // Include team name
                writer: team.writer,
                suggesters: Array.from(team.suggesters),
                answer: team.answer,
                locked: team.locked,
                gold: team.gold,
                suggestions: Array.from(team.suggestions).map(s => ({
                    text: s.text,
                    suggesterId: s.suggesterId,
                    timestamp: s.timestamp
                }))
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
            teamsData[teamId] = {
                teamId: teamId,
                name: team.name || teamId,
                writer: team.writer,
                suggesters: Array.from(team.suggesters),
                answer: team.answer,
                locked: team.locked,
                gold: team.gold,
                suggestions: Array.from(team.suggestions).map(s => ({
                    text: s.text,
                    suggesterId: s.suggesterId,
                    timestamp: s.timestamp
                }))
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
}
