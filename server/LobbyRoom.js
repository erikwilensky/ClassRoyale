import { Room, matchMaker } from "@colyseus/core";
import { Schema, MapSchema } from "@colyseus/schema";
import { verifyToken } from "./auth/auth.js";
import { LOBBY_CONFIG } from "./config/lobby.js";
import { db } from "./db/database.js";

// Player state schema
class PlayerState extends Schema {
    id = "";              // playerId from JWT
    displayName = "";     // from database
    teamId = "";          // assigned team ID
    ready = false;        // readiness status
    sessionId = "";       // Colyseus session ID
    isTeacher = false;    // whether this player is a teacher
}

// Team state schema
class TeamState extends Schema {
    id = "";              // Team ID (e.g., "A", "B")
    name = "";            // Team name (e.g., "Team A")
    playerCount = 0;      // Number of players
}

// Lobby state schema
class LobbyState extends Schema {
    players = new MapSchema(); // Map<sessionId, PlayerState>
    teams = new MapSchema(); // Map<teamId, TeamState>
    locked = false;
    matchStarted = false;
    quizRoomId = "";
    allowSelfSelection = true; // Whether students can select their own teams
}

export class LobbyRoom extends Room {
    onCreate(options) {
        this.setState(new LobbyState());
        this.maxClients = 50;
        
        // Teams will be created dynamically by players, not pre-created
        
        // Message handlers
        this.onMessage("SET_READY", (client, message) => {
            this.setReady(client, message.ready !== false);
        });

        this.onMessage("ASSIGN_TEAM", (client, message) => {
            if (!client.metadata || !client.metadata.isTeacher) {
                client.send("ERROR", { message: "Only teachers can assign teams" });
                return;
            }
            if (!message.playerId || !message.teamId) {
                client.send("ERROR", { message: "Both playerId and teamId are required" });
                return;
            }
            // Find the target player's client by playerId
            const targetPlayer = Array.from(this.state.players.values()).find(p => p.id === message.playerId);
            if (!targetPlayer) {
                client.send("ERROR", { message: "Player not found" });
                return;
            }
            const targetClient = this.clients.find(c => c.sessionId === targetPlayer.sessionId);
            if (!targetClient) {
                client.send("ERROR", { message: "Player client not found" });
                return;
            }
            this.assignTeam(targetClient, message.playerId, message.teamId);
        });

        this.onMessage("LOCK_LOBBY", (client) => {
            this.lockLobby(client);
        });

        this.onMessage("START_MATCH", (client, message) => {
            this.startMatch(client, message.override || false);
        });

        this.onMessage("BALANCE_TEAMS", (client) => {
            if (!client.metadata || !client.metadata.isTeacher) {
                client.send("ERROR", { message: "Only teachers can balance teams" });
                return;
            }
            this.balanceTeams();
        });

        this.onMessage("UPDATE_TEAM_NAME", (client, message) => {
            if (!message.teamId || !message.teamName) {
                client.send("ERROR", { message: "Both teamId and teamName are required" });
                return;
            }

            const team = this.state.teams.get(message.teamId);
            if (!team) {
                client.send("ERROR", { message: "Team not found" });
                return;
            }

            // Check if player is on this team or is a teacher
            const playerState = this.state.players.get(client.sessionId);
            if (!playerState) {
                client.send("ERROR", { message: "Player not found" });
                return;
            }

            if (!client.metadata.isTeacher && playerState.teamId !== message.teamId) {
                client.send("ERROR", { message: "You can only rename teams you belong to" });
                return;
            }

            const newName = message.teamName.trim();
            if (newName.length === 0) {
                client.send("ERROR", { message: "Team name cannot be empty" });
                return;
            }

            if (newName.length > 50) {
                client.send("ERROR", { message: "Team name cannot exceed 50 characters" });
                return;
            }

            team.name = newName;
            console.log(`[LobbyRoom] Team ${message.teamId} renamed to "${newName}" by ${client.metadata.displayName}`);
            this.broadcastLobbyUpdate();
        });

        this.onMessage("CHANGE_TEAM", (client, message) => {
            if (!client.metadata || client.metadata.isTeacher) {
                client.send("ERROR", { message: "Only students can change their own team" });
                return;
            }
            this.changeTeam(client, message.teamId);
        });

        this.onMessage("SET_SELF_SELECTION", (client, message) => {
            if (!client.metadata || !client.metadata.isTeacher) {
                client.send("ERROR", { message: "Only teachers can change this setting" });
                return;
            }
            this.state.allowSelfSelection = message.enabled !== false;
            this.broadcastLobbyUpdate();
            console.log(`[LobbyRoom] Self-selection ${this.state.allowSelfSelection ? 'enabled' : 'disabled'} by teacher`);
        });

        this.onMessage("CREATE_TEAM", (client, message) => {
            this.createTeam(client, message.teamName);
        });

        this.onMessage("DELETE_TEAM", (client, message) => {
            this.deleteTeam(client, message.teamId);
        });

        console.log("[LobbyRoom] Lobby created (teams will be created by players)");
    }

    async onJoin(client, options) {
        try {
            console.log("[LobbyRoom] onJoin: Attempting to join", { 
                hasToken: !!options.token,
                tokenLength: options.token?.length,
                role: options.role 
            });

            // Verify JWT token
            if (!options.token) {
                console.error("[LobbyRoom] onJoin: No token provided");
                client.send("ERROR", { message: "Authentication token required" });
                client.leave(1008, "No token provided");
                return;
            }

            const decoded = verifyToken(options.token);
            if (!decoded) {
                console.error("[LobbyRoom] onJoin: Invalid token");
                client.send("ERROR", { message: "Invalid authentication token" });
                client.leave(1008, "Invalid token");
                return;
            }

            console.log("[LobbyRoom] onJoin: Token verified", { 
                playerId: decoded.playerId,
                isTeacher: decoded.isTeacher 
            });

            // Check if lobby is locked
            if (this.state.locked && !decoded.isTeacher) {
                console.warn("[LobbyRoom] onJoin: Lobby locked, student rejected");
                client.send("ERROR", { message: "Lobby is locked" });
                client.leave(1008, "Lobby locked");
                return;
            }

            // Get player info from database
            let player;
            try {
                player = db.prepare(
                    "SELECT id, displayName, isTeacher FROM players WHERE id = ?"
                ).get(decoded.playerId);
            } catch (dbError) {
                console.error("[LobbyRoom] onJoin: Database error", dbError);
                client.send("ERROR", { message: "Database error" });
                client.leave(1008, "Database error");
                return;
            }

            if (!player) {
                console.error("[LobbyRoom] onJoin: Player not found in database", { playerId: decoded.playerId });
                client.send("ERROR", { message: "Player not found" });
                client.leave(1008, "Player not found");
                return;
            }

            // Set client metadata
            client.metadata = {
                playerId: decoded.playerId,
                displayName: player.displayName,
                isTeacher: Boolean(player.isTeacher),
                role: player.isTeacher ? "teacher" : "student"
            };

            // Check if player already exists (reconnect scenario)
            let existingPlayerState = null;
            for (const [sessionId, pState] of this.state.players.entries()) {
                if (pState.id === decoded.playerId) {
                    // Player reconnecting - remove old entry
                    existingPlayerState = pState;
                    this.state.players.delete(sessionId);
                    // Remove from old team count
                    if (pState.teamId) {
                        const oldTeam = this.state.teams.get(pState.teamId);
                        if (oldTeam && oldTeam.playerCount > 0) {
                            oldTeam.playerCount--;
                        }
                    }
                    break;
                }
            }

            // Create player state (or reuse existing)
            const playerState = existingPlayerState || new PlayerState();
            playerState.id = decoded.playerId;
            playerState.displayName = player.displayName;
            playerState.sessionId = client.sessionId;
            playerState.isTeacher = Boolean(player.isTeacher);
            // Preserve team assignment if reconnecting
            if (!existingPlayerState) {
                playerState.ready = false;
                playerState.teamId = "";
            }

            // Add player to state (new sessionId)
            this.state.players.set(client.sessionId, playerState);
            
            // Restore team count if reconnecting
            if (existingPlayerState && existingPlayerState.teamId) {
                const team = this.state.teams.get(existingPlayerState.teamId);
                if (team) {
                    team.playerCount++;
                }
            }

            // Students join without auto-assignment - they must create or join a team
            // Teachers don't need teams
            this.broadcastLobbyUpdate();

            console.log(`[LobbyRoom] Player joined successfully: ${player.displayName} (${player.isTeacher ? "teacher" : "student"})`);
        } catch (error) {
            console.error("[LobbyRoom] onJoin: Unexpected error", error);
            console.error("[LobbyRoom] onJoin: Error stack", error.stack);
            try {
                client.send("ERROR", { message: `Server error: ${error.message}` });
                client.leave(1008, "Server error");
            } catch (sendError) {
                console.error("[LobbyRoom] onJoin: Failed to send error to client", sendError);
            }
        }
    }

    onLeave(client, abandoned) {
        if (!client.metadata) return;

        const playerState = this.state.players.get(client.sessionId);
        if (playerState) {
            // Remove from team count
            if (playerState.teamId) {
                const team = this.state.teams.get(playerState.teamId);
                if (team && team.playerCount > 0) {
                    team.playerCount--;
                }
                // Remove empty teams (but keep default teams if we have less than maxTeams)
                if (team && team.playerCount === 0 && this.state.teams.size > LOBBY_CONFIG.maxTeams) {
                    this.state.teams.delete(playerState.teamId);
                }
            }
            this.state.players.delete(client.sessionId);
        }

        this.broadcastLobbyUpdate();
        console.log(`[LobbyRoom] Player left: ${client.metadata.displayName}`);
    }

    assignTeam(client, playerId, teamId = null) {
        // Find player state (either by sessionId if client provided, or by playerId)
        let playerState = null;
        if (client) {
            // First try by sessionId
            playerState = this.state.players.get(client.sessionId);
            
            // If not found by sessionId but we have playerId from metadata, try by playerId
            if (!playerState && client.metadata && client.metadata.playerId) {
                console.warn(`[LobbyRoom] assignTeam: Player state not found for sessionId ${client.sessionId}, trying playerId ${client.metadata.playerId}`);
                for (const [sessionId, pState] of this.state.players.entries()) {
                    if (pState.id === client.metadata.playerId) {
                        playerState = pState;
                        console.log(`[LobbyRoom] assignTeam: Found player by playerId with different sessionId ${sessionId}`);
                        break;
                    }
                }
            }
            
            if (!playerState) {
                console.error(`[LobbyRoom] assignTeam: Player state not found for sessionId ${client.sessionId}`);
                console.error(`[LobbyRoom] assignTeam: Client metadata:`, client.metadata);
                console.error(`[LobbyRoom] assignTeam: Available sessions: ${Array.from(this.state.players.keys()).join(", ")}`);
                console.error(`[LobbyRoom] assignTeam: Available players:`, Array.from(this.state.players.values()).map(p => ({ id: p.id, displayName: p.displayName, sessionId: p.sessionId })));
                if (client) {
                    client.send("ERROR", { message: "Player not found in lobby state. Please refresh the page." });
                }
                return null;
            }
        } else {
            // Find by playerId
            for (const [sessionId, pState] of this.state.players.entries()) {
                if (pState.id === playerId) {
                    playerState = pState;
                    break;
                }
            }
            if (!playerState) {
                console.error(`[LobbyRoom] assignTeam: Player state not found for playerId ${playerId}`);
                return null;
            }
        }

        // If teamId provided, assign to that team
        if (teamId) {
            const targetTeam = this.state.teams.get(teamId);
            if (!targetTeam) {
                console.error(`[LobbyRoom] assignTeam: Team ${teamId} not found`);
                if (client) {
                    client.send("ERROR", { message: "Team not found" });
                }
                return null;
            }

            // Check if team is full
            if (targetTeam.playerCount >= LOBBY_CONFIG.maxPlayersPerTeam) {
                console.log(`[LobbyRoom] assignTeam: Team ${teamId} is full (${targetTeam.playerCount}/${LOBBY_CONFIG.maxPlayersPerTeam})`);
                if (client) {
                    client.send("ERROR", { message: "Team is full" });
                }
                return null;
            }

            // Remove from old team (if they had one)
            if (playerState.teamId && playerState.teamId !== teamId) {
                const oldTeam = this.state.teams.get(playerState.teamId);
                if (oldTeam && oldTeam.playerCount > 0) {
                    oldTeam.playerCount--;
                    console.log(`[LobbyRoom] assignTeam: Removed ${playerState.displayName} from team ${playerState.teamId}`);
                }
            }

            // Add to new team
            const wasJoining = !playerState.teamId || playerState.teamId === "";
            playerState.teamId = teamId;
            targetTeam.playerCount++;
            console.log(`[LobbyRoom] assignTeam: ${playerState.displayName} ${wasJoining ? 'joined' : 'changed to'} team ${teamId} (${targetTeam.playerCount} players)`);
            this.broadcastLobbyUpdate();
            return teamId;
        }

        // Auto-assignment: find team with least players (balanced assignment)
        let minPlayers = Infinity;
        let candidates = []; // Teams with minimum player count

        console.log(`[LobbyRoom] assignTeam: Searching for team. Teams in state: ${this.state.teams.size}, Max teams: ${LOBBY_CONFIG.maxTeams}, Max per team: ${LOBBY_CONFIG.maxPlayersPerTeam}`);
        
        // First, find the minimum player count
        for (const [id, team] of this.state.teams.entries()) {
            console.log(`[LobbyRoom] assignTeam: Checking team ${id}, playerCount: ${team.playerCount}`);
            if (team.playerCount < LOBBY_CONFIG.maxPlayersPerTeam) {
                if (team.playerCount < minPlayers) {
                    minPlayers = team.playerCount;
                    candidates = [id]; // Reset candidates with new minimum
                } else if (team.playerCount === minPlayers) {
                    candidates.push(id); // Add to candidates if same minimum
                }
            }
        }
        
        // Pick from candidates (prefer balancing - if tie, alternate)
        let targetTeamId = null;
        if (candidates.length > 0) {
            // Sort candidates to ensure consistent ordering
            candidates.sort();
            // Pick first candidate (will alternate naturally as teams fill up)
            targetTeamId = candidates[0];
            console.log(`[LobbyRoom] assignTeam: Selected team ${targetTeamId} from ${candidates.length} candidates with ${minPlayers} players`);
        }

        // No auto-creation of teams - players must create teams explicitly
        if (!targetTeamId) {
            if (client) {
                client.send("ERROR", { message: "No available teams. Create a team first or join an existing one." });
            }
            return null;
        }

        // Remove from old team
        if (playerState.teamId) {
            const oldTeam = this.state.teams.get(playerState.teamId);
            if (oldTeam && oldTeam.playerCount > 0) {
                oldTeam.playerCount--;
            }
        }

        // Assign to target team
        playerState.teamId = targetTeamId;
        const targetTeam = this.state.teams.get(targetTeamId);
        targetTeam.playerCount++;
        this.broadcastLobbyUpdate();

        return targetTeamId;
    }

    createTeam(client, teamName) {
        if (!client.metadata) {
            client.send("ERROR", { message: "Not authenticated" });
            return;
        }

        if (!teamName || teamName.trim().length === 0) {
            client.send("ERROR", { message: "Team name cannot be empty" });
            return;
        }

        // Check if we've reached max teams
        if (this.state.teams.size >= LOBBY_CONFIG.maxTeams) {
            client.send("ERROR", { message: `Maximum number of teams (${LOBBY_CONFIG.maxTeams}) reached` });
            return;
        }

        // Generate a unique team ID
        let teamId = String.fromCharCode(65 + this.state.teams.size); // A, B, C...
        // If team ID exists, find next available
        while (this.state.teams.has(teamId)) {
            if (teamId.length === 1 && teamId.charCodeAt(0) < 90) {
                teamId = String.fromCharCode(teamId.charCodeAt(0) + 1);
            } else {
                // Use numeric IDs if we run out of letters
                teamId = `T${this.state.teams.size}`;
            }
        }

        // Create new team
        const newTeam = new TeamState();
        newTeam.id = teamId;
        newTeam.name = teamName.trim();
        newTeam.playerCount = 0;
        this.state.teams.set(teamId, newTeam);

        // Only assign student players to the team (teachers don't join teams)
        if (!client.metadata.isTeacher) {
            const playerState = this.state.players.get(client.sessionId);
            if (!playerState) {
                client.send("ERROR", { message: "Player not found" });
                return;
            }

            if (playerState.teamId) {
                client.send("ERROR", { message: "You are already on a team. Leave your current team first." });
                return;
            }

            // Assign student player to the new team
            playerState.teamId = teamId;
            newTeam.playerCount = 1;
        }

        this.broadcastLobbyUpdate();
        const creatorName = client.metadata.isTeacher ? "Teacher" : this.state.players.get(client.sessionId)?.displayName || "Unknown";
        console.log(`[LobbyRoom] Team "${teamName}" (${teamId}) created by ${creatorName}`);
        client.send("TEAM_CREATED", { teamId, teamName: newTeam.name });
    }

    deleteTeam(client, teamId) {
        if (!client.metadata || !client.metadata.isTeacher) {
            client.send("ERROR", { message: "Only teachers can delete teams" });
            return;
        }

        const team = this.state.teams.get(teamId);
        if (!team) {
            client.send("ERROR", { message: "Team not found" });
            return;
        }

        // Check if team has players
        if (team.playerCount > 0) {
            client.send("ERROR", { message: "Cannot delete team with players. Remove all players first." });
            return;
        }

        // Delete the team
        this.state.teams.delete(teamId);
        this.broadcastLobbyUpdate();
        console.log(`[LobbyRoom] Team "${team.name}" (${teamId}) deleted by teacher`);
        client.send("TEAM_DELETED", { teamId });
    }

    setReady(client, ready) {
        if (!client.metadata) return;

        const playerState = this.state.players.get(client.sessionId);
        if (!playerState) return;

        playerState.ready = ready;
        this.broadcastLobbyUpdate();
    }

    changeTeam(client, teamId) {
        if (!client.metadata || client.metadata.isTeacher) {
            if (client) {
                client.send("ERROR", { message: "Only students can change their own team" });
            }
            return false;
        }

        // Check if self-selection is allowed
        if (!this.state.allowSelfSelection) {
            client.send("ERROR", { message: "Team self-selection is disabled. Teacher must assign teams." });
            return false;
        }

        // Validate team exists
        const targetTeam = this.state.teams.get(teamId);
        if (!targetTeam) {
            client.send("ERROR", { message: "Team not found" });
            return false;
        }

        // Check if team is full
        if (targetTeam.playerCount >= LOBBY_CONFIG.maxPlayersPerTeam) {
            client.send("ERROR", { message: "Team is full" });
            return false;
        }

        // Get player state first to verify it exists
        const playerState = this.state.players.get(client.sessionId);
        if (!playerState) {
            console.error(`[LobbyRoom] changeTeam: Player state not found for sessionId ${client.sessionId}`);
            client.send("ERROR", { message: "Player not found in lobby. Please refresh the page." });
            return false;
        }

        // Use assignTeam method with the new team
        const result = this.assignTeam(client, null, teamId);
        if (result) {
            // Reset ready status when changing teams
            playerState.ready = false;
            this.broadcastLobbyUpdate();
            return true;
        }

        return false;
    }

    lockLobby(client) {
        if (!client.metadata || !client.metadata.isTeacher) {
            client.send("ERROR", { message: "Only teachers can lock the lobby" });
            return;
        }

        this.state.locked = true;
        this.broadcastLobbyUpdate();
        console.log("[LobbyRoom] Lobby locked by teacher");
    }

    async startMatch(client, override = false) {
        if (!client.metadata || !client.metadata.isTeacher) {
            client.send("ERROR", { message: "Only teachers can start the match" });
            return;
        }

        // Validate conditions
        const allReady = Array.from(this.state.players.values())
            .filter(p => !client.metadata.isTeacher || p.id !== client.metadata.playerId) // Exclude teacher
            .every(p => p.ready);

        if (!this.state.locked && !allReady && !override) {
            client.send("ERROR", { 
                message: "Cannot start match: lobby not locked and not all players are ready. Use override to start anyway." 
            });
            return;
        }

        // Validate minimum teams
        const teamsWithPlayers = Array.from(this.state.teams.values())
            .filter(t => t.playerCount > 0);
        
        if (teamsWithPlayers.length < 2) {
            client.send("ERROR", { message: "Need at least 2 teams with players to start match" });
            return;
        }

        // Get team assignments
        const teamAssignments = this.getTeamAssignments();
        const playerAssignments = this.getPlayerAssignments();

        // Create QuizRoom with team assignments
        try {
            const quizRoom = await matchMaker.createRoom("quiz_room", {
                teams: teamAssignments,
                players: playerAssignments
            });

            this.state.matchStarted = true;
            this.state.quizRoomId = quizRoom.roomId;

            // Broadcast MATCH_START to all clients
            const matchStartMessage = {
                roomId: quizRoom.roomId,
                teams: teamAssignments,
                players: playerAssignments
            };

            this.broadcast("MATCH_START", matchStartMessage);

            // Disconnect all clients after a short delay (they will reconnect to QuizRoom)
            setTimeout(() => {
                this.broadcast("MATCH_START", matchStartMessage); // Send again to ensure receipt
                // Disconnect all clients
                this.clients.forEach(client => {
                    client.leave();
                });
            }, 100);

            console.log(`[LobbyRoom] Match started. QuizRoom ID: ${quizRoom.roomId}`);
        } catch (error) {
            console.error("[LobbyRoom] Error creating QuizRoom:", error);
            client.send("ERROR", { message: `Failed to start match: ${error.message}` });
        }
    }

    getTeamAssignments() {
        const assignments = {};
        
        // Group players by team (excluding teachers)
        const teamGroups = {};
        for (const [sessionId, playerState] of this.state.players.entries()) {
            if (!playerState.teamId || playerState.isTeacher) continue;
            
            if (!teamGroups[playerState.teamId]) {
                teamGroups[playerState.teamId] = [];
            }
            teamGroups[playerState.teamId].push(playerState.id);
        }

        // Create assignment structure
        for (const [teamId, playerIds] of Object.entries(teamGroups)) {
            const team = this.state.teams.get(teamId);
            const teamName = team ? team.name : teamId;
            assignments[teamId] = {
                playerIds: playerIds,
                writerId: playerIds[0] || null, // First player becomes writer
                name: teamName // Include team name
            };
        }

        return assignments;
    }

    getPlayerAssignments() {
        const assignments = {};
        
        // Group players by team to determine writers (excluding teachers)
        const teamGroups = {};
        for (const [sessionId, playerState] of this.state.players.entries()) {
            if (!playerState.teamId || playerState.isTeacher) continue;
            
            if (!teamGroups[playerState.teamId]) {
                teamGroups[playerState.teamId] = [];
            }
            teamGroups[playerState.teamId].push({
                playerId: playerState.id,
                displayName: playerState.displayName
            });
        }

        // Create assignment structure
        for (const [teamId, players] of Object.entries(teamGroups)) {
            players.forEach((player, index) => {
                assignments[player.playerId] = {
                    teamId: teamId,
                    displayName: player.displayName,
                    isWriter: index === 0 // First player is writer
                };
            });
        }

        return assignments;
    }

    broadcastLobbyUpdate() {
        // Build lobby state for clients
        const playersObj = {};
        for (const [sessionId, playerState] of this.state.players.entries()) {
            playersObj[sessionId] = {
                id: playerState.id,
                displayName: playerState.displayName,
                teamId: playerState.teamId,
                ready: playerState.ready,
                sessionId: playerState.sessionId,
                isTeacher: playerState.isTeacher
            };
        }

        const teamsObj = {};
        for (const [teamId, team] of this.state.teams.entries()) {
            teamsObj[teamId] = {
                id: team.id,
                name: team.name,
                playerCount: team.playerCount
            };
        }

        // Calculate readiness percentage
        const studentPlayers = Array.from(this.state.players.values())
            .filter(p => {
                const player = this.clients.find(c => c.sessionId === p.sessionId);
                return player && !player.metadata?.isTeacher;
            });
        const readyCount = studentPlayers.filter(p => p.ready).length;
        const readinessPercentage = studentPlayers.length > 0 
            ? Math.round((readyCount / studentPlayers.length) * 100) 
            : 0;

        this.broadcast("LOBBY_UPDATE", {
            players: playersObj,
            teams: teamsObj,
            locked: this.state.locked,
            matchStarted: this.state.matchStarted,
            quizRoomId: this.state.quizRoomId,
            readinessPercentage: readinessPercentage,
            allowSelfSelection: this.state.allowSelfSelection
        });
    }

    balanceTeams() {
        // Get all unassigned students (excluding teachers)
        const unassignedPlayers = Array.from(this.state.players.values())
            .filter(p => (!p.teamId || p.teamId === "") && !p.isTeacher);
        
        if (unassignedPlayers.length === 0) {
            console.log("[LobbyRoom] No unassigned players to balance");
            return;
        }

        // Calculate how many teams we need (at least 2, but optimize based on player count)
        const existingTeamsCount = this.state.teams.size;
        const totalStudents = Array.from(this.state.players.values()).filter(p => !p.isTeacher).length;
        const idealTeamCount = Math.max(2, Math.min(
            LOBBY_CONFIG.maxTeams,
            Math.ceil(totalStudents / LOBBY_CONFIG.maxPlayersPerTeam)
        ));

        // Create teams if we don't have enough
        let teamNumber = 1;
        while (this.state.teams.size < idealTeamCount) {
            // Generate a unique team ID (A, B, C...)
            let teamId = String.fromCharCode(65 + this.state.teams.size);
            // If team ID exists, find next available
            while (this.state.teams.has(teamId)) {
                if (teamId.length === 1 && teamId.charCodeAt(0) < 90) {
                    teamId = String.fromCharCode(teamId.charCodeAt(0) + 1);
                } else {
                    teamId = `T${this.state.teams.size}`;
                }
            }

            const team = new TeamState();
            team.id = teamId;
            team.name = `Team ${teamNumber}`; // Use "Team 1", "Team 2", etc.
            team.playerCount = 0;
            this.state.teams.set(teamId, team);
            console.log(`[LobbyRoom] Auto-created team ${teamId} (${team.name}) for balancing`);
            teamNumber++;
        }

        // Get all teams with available slots
        let availableTeams = Array.from(this.state.teams.values())
            .filter(t => t.playerCount < LOBBY_CONFIG.maxPlayersPerTeam)
            .sort((a, b) => a.playerCount - b.playerCount); // Sort by size (smallest first)

        if (availableTeams.length === 0) {
            console.log("[LobbyRoom] All teams are full, cannot balance further");
            return;
        }

        // Distribute players evenly across teams
        for (const player of unassignedPlayers) {
            // Re-sort teams by size (smallest first) to ensure even distribution
            // Note: We need to refresh from state since assignTeam updates counts
            const currentAvailableTeams = Array.from(this.state.teams.values())
                .filter(t => t.playerCount < LOBBY_CONFIG.maxPlayersPerTeam)
                .sort((a, b) => a.playerCount - b.playerCount);

            if (currentAvailableTeams.length === 0) {
                // All teams are full
                console.log("[LobbyRoom] All teams are full, cannot balance further");
                break;
            }

            // Assign player to the team with fewest players
            const targetTeam = currentAvailableTeams[0];
            const playerClient = this.clients.find(c => c.sessionId === player.sessionId);
            
            if (playerClient) {
                const teamId = Array.from(this.state.teams.entries())
                    .find(([_, t]) => t === targetTeam)[0];
                this.assignTeam(playerClient, player.id, teamId);
                // assignTeam will update the team count automatically
            }
        }

        console.log(`[LobbyRoom] Balanced ${unassignedPlayers.length} unassigned players across ${this.state.teams.size} teams`);
        this.broadcastLobbyUpdate();
    }
}
