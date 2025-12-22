import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { joinLobbyRoom, joinQuizRoomById } from "../ws/colyseusClient.js";
import { getToken } from "../utils/auth.js";

export function TeacherLobby() {
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [players, setPlayers] = useState({});
  const [teams, setTeams] = useState({});
  const [locked, setLocked] = useState(false);
  const [readinessPercentage, setReadinessPercentage] = useState(0);
  const [canStartMatch, setCanStartMatch] = useState(false);
  const [overrideStart, setOverrideStart] = useState(false);
  const [allowSelfSelection, setAllowSelfSelection] = useState(true);
  const [assignTeamPlayerId, setAssignTeamPlayerId] = useState("");
  const [assignTeamTargetId, setAssignTeamTargetId] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [deleteTeamId, setDeleteTeamId] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function connect() {
      try {
        const token = getToken();
        if (!token) {
          console.error("[TeacherLobby] No token found. User must be logged in.");
          if (isMounted) {
            setConnectionStatus("error");
          }
          alert("You must be logged in to access the teacher lobby. Please log in first.");
          navigate("/login");
          return;
        }

        console.log("[TeacherLobby] Attempting to connect to lobby with token:", token.substring(0, 20) + "...");
        const joinedRoom = await joinLobbyRoom("teacher", token);
        
        if (!isMounted) return;

        console.log("[TeacherLobby] Successfully connected to lobby room:", joinedRoom.id);
        setRoom(joinedRoom);
        setConnectionStatus("connected");

        // Register LOBBY_UPDATE handler (suppress warning)
        joinedRoom.onMessage("LOBBY_UPDATE", (message) => {
          console.log("[TeacherLobby] LOBBY_UPDATE:", message);
          setPlayers(message.players || {});
          setTeams(message.teams || {});
          setLocked(message.locked || false);
          setReadinessPercentage(message.readinessPercentage || 0);
          setAllowSelfSelection(message.allowSelfSelection !== false);

          // Check if can start match (exclude teachers)
          const studentPlayers = Object.values(message.players || {}).filter(
            p => !p.isTeacher
          );
          const allReady = studentPlayers.length > 0 && studentPlayers.every(p => p.ready);
          const teamsWithPlayers = Object.values(message.teams || {}).filter(
            t => t.playerCount > 0
          );
          const hasEnoughTeams = teamsWithPlayers.length >= 2;
          
          setCanStartMatch(
            (message.locked || allReady || overrideStart) && hasEnoughTeams
          );
        });

        // Handle MATCH_START message
        joinedRoom.onMessage("MATCH_START", async (message) => {
          console.log("[TeacherLobby] MATCH_START:", message);
          
          // Leave lobby room
          joinedRoom.leave();
          
          // Connect to QuizRoom
          try {
            const token = getToken();
            const quizRoom = await joinQuizRoomById(message.roomId, "teacher", token);
            
            // Store room ID in localStorage for Teacher page to use
            localStorage.setItem("quizRoomId", message.roomId);
            
            // Navigate to teacher page
            navigate("/teacher");
          } catch (error) {
            console.error("[TeacherLobby] Error connecting to QuizRoom:", error);
            setConnectionStatus("error");
          }
        });

        // Handle errors
        joinedRoom.onMessage("ERROR", (message) => {
          console.error("[TeacherLobby] Error:", message);
          alert(message.message || "An error occurred");
        });
      } catch (error) {
        console.error("[TeacherLobby] Connection error:", error);
        console.error("[TeacherLobby] Error details:", {
          message: error.message,
          name: error.name,
          stack: error.stack,
          cause: error.cause
        });
        if (isMounted) {
          setConnectionStatus("error");
        }
        // Show user-friendly error message
        alert(`Failed to connect to lobby: ${error.message || "Unknown error"}. Please check that the server is running and try again.`);
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (room) {
        room.leave();
      }
    };
  }, [navigate, overrideStart]);

  const handleLockLobby = () => {
    if (!room || connectionStatus !== "connected") return;
    room.send("LOCK_LOBBY", {});
  };

  const handleStartMatch = () => {
    if (!room || connectionStatus !== "connected") return;
    if (!canStartMatch) return;
    room.send("START_MATCH", { override: overrideStart });
  };

  const handleAssignTeam = () => {
    if (!room || connectionStatus !== "connected") return;
    if (!assignTeamPlayerId || !assignTeamTargetId) {
      alert("Please select both a player and a team");
      return;
    }
    room.send("ASSIGN_TEAM", { playerId: assignTeamPlayerId, teamId: assignTeamTargetId });
    setAssignTeamPlayerId("");
    setAssignTeamTargetId("");
  };

  const handleCreateTeam = () => {
    if (!room || connectionStatus !== "connected") return;
    if (!newTeamName || newTeamName.trim().length === 0) {
      alert("Please enter a team name");
      return;
    }
    room.send("CREATE_TEAM", { teamName: newTeamName.trim() });
    setNewTeamName("");
  };

  const handleDeleteTeam = () => {
    if (!room || connectionStatus !== "connected") return;
    if (!deleteTeamId) {
      alert("Please select a team to delete");
      return;
    }
    const team = teams[deleteTeamId];
    if (team && team.playerCount > 0) {
      alert(`Cannot delete team "${team.name}" - it has ${team.playerCount} player(s). Remove all players first.`);
      return;
    }
    if (window.confirm(`Are you sure you want to delete team "${team?.name || deleteTeamId}"?`)) {
      room.send("DELETE_TEAM", { teamId: deleteTeamId });
      setDeleteTeamId("");
    }
  };

  const handleToggleSelfSelection = () => {
    if (!room || connectionStatus !== "connected") return;
    room.send("SET_SELF_SELECTION", { enabled: !allowSelfSelection });
  };

  const handleBalanceTeams = () => {
    if (!room || connectionStatus !== "connected") return;
    const hasTeams = Object.keys(teams).length > 0;
    const message = hasTeams
      ? "This will automatically distribute all unassigned players evenly across available teams. Continue?"
      : "This will automatically create teams (Team 1, Team 2, etc.) and distribute all unassigned players evenly across them. Continue?";
    if (!window.confirm(message)) {
      return;
    }
    room.send("BALANCE_TEAMS", {});
  };

  // Deduplicate players by player ID (in case of reconnects)
  const uniquePlayers = {};
  Object.values(players).forEach((player) => {
    if (player.id && !uniquePlayers[player.id]) {
      uniquePlayers[player.id] = player;
    } else if (player.id && uniquePlayers[player.id]) {
      // Keep the one with a teamId if available, or the most recent
      if (player.teamId && !uniquePlayers[player.id].teamId) {
        uniquePlayers[player.id] = player;
      }
    }
  });

  // Group players by team (using unique players, excluding teachers)
  const playersByTeam = {};
  Object.values(uniquePlayers)
    .filter(p => !p.isTeacher) // Exclude teachers from team display
    .forEach((player) => {
      const teamId = player.teamId || "unassigned";
      if (!playersByTeam[teamId]) {
        playersByTeam[teamId] = [];
      }
      playersByTeam[teamId].push(player);
    });

  // Get unassigned players (unique, excluding teachers)
  const unassignedPlayers = Object.values(uniquePlayers).filter(
    p => (!p.teamId || p.teamId === "") && !p.isTeacher
  );

  // Get student players (excluding teacher, unique)
  const studentPlayers = Object.values(uniquePlayers).filter(p => !p.isTeacher);

  if (connectionStatus === "error") {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1>Connection Error</h1>
        <p>Failed to connect to lobby. Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Teacher Lobby Control</h1>
      
      {connectionStatus === "connecting" && (
        <p>Connecting to lobby...</p>
      )}

      {connectionStatus === "connected" && (
        <>
          <div style={{ marginBottom: "2rem", display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={handleLockLobby}
              disabled={locked}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                backgroundColor: locked ? "#999" : "#ff9800",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: locked ? "not-allowed" : "pointer",
                fontWeight: "bold"
              }}
            >
              {locked ? "🔒 Lobby Locked" : "🔓 Lock Lobby"}
            </button>

            <button
              onClick={handleToggleSelfSelection}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                backgroundColor: allowSelfSelection ? "#4caf50" : "#999",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              {allowSelfSelection ? "✓ Self-Selection Enabled" : "✗ Self-Selection Disabled"}
            </button>

            <div style={{ flex: 1 }}>
              <p style={{ margin: 0 }}>
                <strong>Readiness:</strong> {readinessPercentage}% ({studentPlayers.filter(p => p.ready).length} / {studentPlayers.length} ready)
              </p>
              <p style={{ margin: 0 }}>
                <strong>Teams with players:</strong> {Object.values(teams).filter(t => t.playerCount > 0).length}
              </p>
            </div>
          </div>

          <div style={{ marginBottom: "2rem", border: "2px solid #4caf50", padding: "1rem", borderRadius: "4px", backgroundColor: "#e8f5e9" }}>
            <h2 style={{ marginTop: 0 }}>Create Team</h2>
            <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1rem" }}>
              Create a new team that players can join. Teams must be created before players can be assigned.
            </p>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Team Name:</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Enter team name..."
                  maxLength={50}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "1rem"
                  }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleCreateTeam();
                    }
                  }}
                />
              </div>
              <button
                onClick={handleCreateTeam}
                disabled={!newTeamName || newTeamName.trim().length === 0}
                style={{
                  padding: "0.5rem 1.5rem",
                  backgroundColor: newTeamName && newTeamName.trim().length > 0 ? "#4caf50" : "#999",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: newTeamName && newTeamName.trim().length > 0 ? "pointer" : "not-allowed",
                  fontWeight: "bold",
                  fontSize: "1rem"
                }}
              >
                Create Team
              </button>
            </div>
          </div>

          <div style={{ marginBottom: "2rem", border: "2px solid #f44336", padding: "1rem", borderRadius: "4px", backgroundColor: "#ffebee" }}>
            <h2 style={{ marginTop: 0 }}>Delete Team</h2>
            <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1rem" }}>
              Delete an empty team. Teams with players cannot be deleted.
            </p>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Team to Delete:</label>
                <select
                  value={deleteTeamId}
                  onChange={(e) => setDeleteTeamId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "1rem"
                  }}
                >
                  <option value="">Select a team...</option>
                  {Object.entries(teams).map(([teamId, team]) => (
                    <option key={teamId} value={teamId} disabled={team.playerCount > 0}>
                      {team.name} ({team.playerCount} players)
                      {team.playerCount > 0 ? " (Has players)" : " (Empty)"}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleDeleteTeam}
                disabled={!deleteTeamId}
                style={{
                  padding: "0.5rem 1.5rem",
                  backgroundColor: deleteTeamId ? "#f44336" : "#999",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: deleteTeamId ? "pointer" : "not-allowed",
                  fontWeight: "bold",
                  fontSize: "1rem"
                }}
              >
                Delete Team
              </button>
            </div>
          </div>

          <div style={{ marginBottom: "2rem", border: "2px solid #9c27b0", padding: "1rem", borderRadius: "4px", backgroundColor: "#f3e5f5" }}>
            <h2 style={{ marginTop: 0 }}>⚖️ Auto-Balance Teams</h2>
            <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1rem" }}>
              Automatically distribute all unassigned players evenly across available teams. Players will be assigned to teams with the fewest members first.
            </p>
            <button
              onClick={handleBalanceTeams}
              disabled={unassignedPlayers.length === 0}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                backgroundColor: unassignedPlayers.length > 0 ? "#9c27b0" : "#999",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: unassignedPlayers.length > 0 ? "pointer" : "not-allowed",
                fontWeight: "bold"
              }}
            >
              Auto-Balance Teams ({unassignedPlayers.length} unassigned)
            </button>
            {unassignedPlayers.length === 0 && (
              <p style={{ color: "#666", marginTop: "0.5rem", fontSize: "0.85rem", fontStyle: "italic" }}>
                No unassigned players to balance.
              </p>
            )}
            {unassignedPlayers.length > 0 && Object.keys(teams).length === 0 && (
              <p style={{ color: "#2196f3", marginTop: "0.5rem", fontSize: "0.85rem", fontStyle: "italic" }}>
                Teams will be automatically created with names like "Team 1", "Team 2", etc.
              </p>
            )}
          </div>

          <div style={{ marginBottom: "2rem", border: "2px solid #2196f3", padding: "1rem", borderRadius: "4px", backgroundColor: "#e3f2fd" }}>
            <h2 style={{ marginTop: 0 }}>Manually Assign Player to Team</h2>
            <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1rem" }}>
              Select a player and a team to move them. Use this for fine-grained control over team assignments.
            </p>
            {Object.keys(teams).length === 0 && (
              <div style={{ padding: "0.75rem", backgroundColor: "#fff3cd", border: "1px solid #ffc107", borderRadius: "4px", marginBottom: "1rem" }}>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "#856404" }}>
                  No teams exist yet. Create a team above first, or wait for players to create teams.
                </p>
              </div>
            )}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Player:</label>
                <select
                  value={assignTeamPlayerId}
                  onChange={(e) => setAssignTeamPlayerId(e.target.value)}
                  style={{ padding: "0.5rem", minWidth: "200px" }}
                >
                  <option value="">Select player...</option>
                  {studentPlayers.map((player) => (
                    <option key={player.sessionId} value={player.id}>
                      {player.displayName} {player.teamId ? `(Team ${player.teamId})` : "(Unassigned)"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Team:</label>
                <select
                  value={assignTeamTargetId}
                  onChange={(e) => setAssignTeamTargetId(e.target.value)}
                  style={{ padding: "0.5rem", minWidth: "150px" }}
                >
                  <option value="">Select team...</option>
                  {Object.entries(teams).map(([teamId, team]) => (
                    <option key={teamId} value={teamId}>
                      {team.name} ({team.playerCount} players)
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  onClick={handleAssignTeam}
                  disabled={!assignTeamPlayerId || !assignTeamTargetId}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: assignTeamPlayerId && assignTeamTargetId ? "#2196f3" : "#999",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: assignTeamPlayerId && assignTeamTargetId ? "pointer" : "not-allowed"
                  }}
                >
                  Assign
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "2rem", border: "2px solid #4caf50", padding: "1rem", borderRadius: "4px" }}>
            <h2 style={{ marginTop: 0 }}>Start Match</h2>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={overrideStart}
                  onChange={(e) => setOverrideStart(e.target.checked)}
                />
                <span>Override (start even if not all players ready)</span>
              </label>
            </div>
            <button
              onClick={handleStartMatch}
              disabled={!canStartMatch}
              style={{
                padding: "1rem 2rem",
                fontSize: "1.2rem",
                backgroundColor: canStartMatch ? "#4caf50" : "#999",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: canStartMatch ? "pointer" : "not-allowed",
                fontWeight: "bold"
              }}
            >
              Start Match
            </button>
            {!canStartMatch && (
              <p style={{ color: "#f44336", marginTop: "0.5rem", fontSize: "0.9rem" }}>
                Cannot start: Need lobby locked or all players ready, and at least 2 teams with players
              </p>
            )}
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <h2>Teams</h2>
            {Object.entries(teams).map(([teamId, team]) => (
              <div
                key={teamId}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "1rem",
                  marginBottom: "1rem",
                  backgroundColor: "#f5f5f5"
                }}
              >
                <h3>{team.name} ({team.playerCount} players)</h3>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {(playersByTeam[teamId] || []).map((player) => (
                    <li
                      key={player.sessionId}
                      style={{
                        padding: "0.5rem",
                        backgroundColor: player.ready ? "#c8e6c9" : "#fff",
                        marginBottom: "0.25rem",
                        borderRadius: "4px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <span>{player.displayName}</span>
                      <span style={{ color: player.ready ? "#4caf50" : "#999" }}>
                        {player.ready ? "✓ Ready" : "Not Ready"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {unassignedPlayers.length > 0 && (
            <div style={{ marginBottom: "2rem" }}>
              <h2>Unassigned Players</h2>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {unassignedPlayers.map((player) => (
                  <li
                    key={player.sessionId}
                    style={{
                      padding: "0.5rem",
                      backgroundColor: "#fff3cd",
                      marginBottom: "0.25rem",
                      borderRadius: "4px"
                    }}
                  >
                    {player.displayName}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

