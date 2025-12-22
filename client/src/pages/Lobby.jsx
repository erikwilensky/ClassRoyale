import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { joinLobbyRoom, joinQuizRoomById } from "../ws/colyseusClient.js";
import { getToken } from "../utils/auth.js";

// Default max players per team (should match server config)
const MAX_PLAYERS_PER_TEAM = 4;

export function Lobby() {
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [players, setPlayers] = useState({});
  const [teams, setTeams] = useState({});
  const [myTeamId, setMyTeamId] = useState("");
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [readinessPercentage, setReadinessPercentage] = useState(0);
  const [allowSelfSelection, setAllowSelfSelection] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [editingTeamId, setEditingTeamId] = useState("");
  const [editingTeamName, setEditingTeamName] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function connect() {
      try {
        const token = getToken();
        const joinedRoom = await joinLobbyRoom("student", token);
        
        if (!isMounted) return;

        setRoom(joinedRoom);
        setConnectionStatus("connected");

        // Register LOBBY_UPDATE handler (suppress warning)
        joinedRoom.onMessage("LOBBY_UPDATE", (message) => {
          console.log("[Lobby] LOBBY_UPDATE:", message);
          setPlayers(message.players || {});
          setTeams(message.teams || {});
          setLocked(message.locked || false);
          setReadinessPercentage(message.readinessPercentage || 0);
          setAllowSelfSelection(message.allowSelfSelection !== false);

          // Find my team
          const mySessionId = joinedRoom.sessionId;
          const myPlayer = message.players?.[mySessionId];
          if (myPlayer) {
            setMyTeamId(myPlayer.teamId || "");
            setReady(myPlayer.ready || false);
          }
        });

        // Handle MATCH_START message
        joinedRoom.onMessage("MATCH_START", async (message) => {
          console.log("[Lobby] MATCH_START:", message);
          
          // Leave lobby room
          joinedRoom.leave();
          
          // Connect to QuizRoom
          try {
            const token = getToken();
            const quizRoom = await joinQuizRoomById(message.roomId, "student", token);
            
            // Store room ID in localStorage for Student page to use
            localStorage.setItem("quizRoomId", message.roomId);
            
            // Navigate to student page
            navigate("/student");
          } catch (error) {
            console.error("[Lobby] Error connecting to QuizRoom:", error);
            setConnectionStatus("error");
          }
        });

        // Handle errors
        joinedRoom.onMessage("ERROR", (message) => {
          console.error("[Lobby] Error:", message);
          alert(message.message || "An error occurred");
        });

        // Request initial state
        if (joinedRoom.state) {
          // State will be synced via LOBBY_UPDATE
        }
      } catch (error) {
        console.error("[Lobby] Connection error:", error);
        if (isMounted) {
          setConnectionStatus("error");
        }
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (room) {
        room.leave();
      }
    };
  }, [navigate]);

  const handleToggleReady = () => {
    if (!room || connectionStatus !== "connected") return;
    room.send("SET_READY", { ready: !ready });
    setReady(!ready);
  };

  const handleChangeTeam = () => {
    if (!room || connectionStatus !== "connected") return;
    if (!selectedTeamId) {
      alert("Please select a team");
      return;
    }
    if (selectedTeamId === myTeamId) {
      alert("You are already on this team");
      return;
    }
    room.send("CHANGE_TEAM", { teamId: selectedTeamId });
    setSelectedTeamId("");
    // Note: myTeamId will be updated via LOBBY_UPDATE message from server
  };

  const handleCreateTeam = () => {
    if (!room || connectionStatus !== "connected") return;
    if (!newTeamName || newTeamName.trim().length === 0) {
      alert("Please enter a team name");
      return;
    }
    if (myTeamId) {
      alert("You are already on a team. Leave your current team first.");
      return;
    }
    room.send("CREATE_TEAM", { teamName: newTeamName.trim() });
    setNewTeamName("");
  };

  const handleStartEditTeamName = (teamId, currentName) => {
    if (locked) return;
    setEditingTeamId(teamId);
    setEditingTeamName(currentName);
  };

  const handleCancelEditTeamName = () => {
    setEditingTeamId("");
    setEditingTeamName("");
  };

  const handleSaveTeamName = () => {
    if (!room || connectionStatus !== "connected") return;
    if (!editingTeamId || !editingTeamName || editingTeamName.trim().length === 0) {
      alert("Please enter a valid team name");
      return;
    }
    room.send("UPDATE_TEAM_NAME", { teamId: editingTeamId, teamName: editingTeamName.trim() });
    setEditingTeamId("");
    setEditingTeamName("");
  };

  // Handle team created confirmation
  useEffect(() => {
    if (!room) return;
    
    const handler = (message) => {
      console.log("[Lobby] Team created:", message);
      if (message.teamId) {
        setMyTeamId(message.teamId);
      }
    };
    
    room.onMessage("TEAM_CREATED", handler);
    
    // Note: Colyseus automatically cleans up message handlers when room is left
    // No need for explicit cleanup
  }, [room]);

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

  // Group players by team (using unique players)
  const playersByTeam = {};
  Object.values(uniquePlayers).forEach((player) => {
    const teamId = player.teamId || "unassigned";
    if (!playersByTeam[teamId]) {
      playersByTeam[teamId] = [];
    }
    playersByTeam[teamId].push(player);
  });

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1>Lobby</h1>
        <Link
          to="/shop"
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#9c27b0",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            fontSize: "0.9rem",
            fontWeight: "bold"
          }}
        >
          🎴 Shop
        </Link>
      </div>
      
      {connectionStatus === "connecting" && (
        <p>Connecting to lobby...</p>
      )}

      {connectionStatus === "connected" && (
        <>
          <div style={{ marginBottom: "2rem" }}>
            <h2>Status</h2>
            <p>
              <strong>Team:</strong> {myTeamId ? `Team ${myTeamId}` : "Not assigned"}
            </p>
            <p>
              <strong>Readiness:</strong> {readinessPercentage}% ({Object.values(players).filter(p => !p.id.includes("teacher") && p.ready).length} / {Object.values(players).filter(p => !p.id.includes("teacher")).length})
            </p>
            {locked && (
              <p style={{ color: "#ff9800", fontWeight: "bold" }}>
                🔒 Lobby is locked
              </p>
            )}
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <button
              onClick={handleToggleReady}
              disabled={!myTeamId || locked}
              style={{
                padding: "1rem 2rem",
                fontSize: "1.2rem",
                backgroundColor: ready ? "#4caf50" : "#2196f3",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: myTeamId && !locked ? "pointer" : "not-allowed",
                fontWeight: "bold",
                marginRight: "1rem"
              }}
            >
              {ready ? "✓ Ready" : "Not Ready"}
            </button>
          </div>

          {!myTeamId && !locked && (
            <div style={{ marginBottom: "2rem", border: "2px solid #4caf50", padding: "1rem", borderRadius: "4px", backgroundColor: "#e8f5e9" }}>
              <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Create Team</h3>
              <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1rem" }}>
                Create a new team with a custom name. You will become the first member.
              </p>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold" }}>
                    Team Name:
                  </label>
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
          )}

          {allowSelfSelection && !locked && !myTeamId && Object.keys(teams).length > 0 && (
            <div style={{ marginBottom: "2rem", border: "2px solid #ff9800", padding: "1rem", borderRadius: "4px", backgroundColor: "#fff3e0" }}>
              <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Join Team</h3>
              <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1rem" }}>
                Join an existing team, or create a new team below.
              </p>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold" }}>
                    Select Team:
                  </label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
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
                      <option key={teamId} value={teamId} disabled={team.playerCount >= MAX_PLAYERS_PER_TEAM}>
                        {team.name} ({team.playerCount}/{MAX_PLAYERS_PER_TEAM} players)
                        {team.playerCount >= MAX_PLAYERS_PER_TEAM ? " (Full)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <button
                    onClick={handleChangeTeam}
                    disabled={!selectedTeamId}
                    style={{
                      padding: "0.5rem 1.5rem",
                      backgroundColor: selectedTeamId ? "#ff9800" : "#999",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: selectedTeamId ? "pointer" : "not-allowed",
                      fontWeight: "bold"
                    }}
                  >
                    Join Team
                  </button>
                </div>
              </div>
            </div>
          )}

          {allowSelfSelection && !locked && myTeamId && (
            <div style={{ marginBottom: "2rem", border: "2px solid #2196f3", padding: "1rem", borderRadius: "4px", backgroundColor: "#e3f2fd" }}>
              <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Change Team</h3>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold" }}>
                    Select Team:
                  </label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
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
                      <option key={teamId} value={teamId} disabled={teamId === myTeamId || team.playerCount >= MAX_PLAYERS_PER_TEAM}>
                        {team.name} ({team.playerCount}/{MAX_PLAYERS_PER_TEAM} players)
                        {teamId === myTeamId ? " (Current)" : team.playerCount >= MAX_PLAYERS_PER_TEAM ? " (Full)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <button
                    onClick={handleChangeTeam}
                    disabled={!selectedTeamId || selectedTeamId === myTeamId}
                    style={{
                      padding: "0.5rem 1.5rem",
                      backgroundColor: selectedTeamId && selectedTeamId !== myTeamId ? "#2196f3" : "#999",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: selectedTeamId && selectedTeamId !== myTeamId ? "pointer" : "not-allowed",
                      fontWeight: "bold"
                    }}
                  >
                    Change Team
                  </button>
                </div>
              </div>
              <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
                Note: Changing teams will reset your ready status.
              </p>
            </div>
          )}

          {!allowSelfSelection && !myTeamId && (
            <div style={{ marginBottom: "2rem", padding: "0.75rem", backgroundColor: "#fff3cd", border: "1px solid #ffc107", borderRadius: "4px" }}>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#856404" }}>
                Team self-selection is disabled. Please ask the teacher to assign you to a team.
              </p>
            </div>
          )}

          {!myTeamId && Object.keys(teams).length === 0 && (
            <div style={{ marginBottom: "2rem", padding: "1rem", backgroundColor: "#f0f0f0", border: "1px solid #ddd", borderRadius: "4px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "1rem", color: "#666" }}>
                No teams yet. Create a team to get started!
              </p>
            </div>
          )}

          <div style={{ marginBottom: "2rem" }}>
            <h2>Teams</h2>
            {Object.entries(teams).map(([teamId, team]) => (
              <div
                key={teamId}
                style={{
                  border: myTeamId === teamId ? "3px solid #2196f3" : "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "1rem",
                  marginBottom: "1rem",
                  backgroundColor: myTeamId === teamId ? "#e3f2fd" : "#f5f5f5"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  {editingTeamId === teamId && myTeamId === teamId ? (
                    <div style={{ flex: 1, display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input
                        type="text"
                        value={editingTeamName}
                        onChange={(e) => setEditingTeamName(e.target.value)}
                        maxLength={50}
                        style={{
                          flex: 1,
                          padding: "0.5rem",
                          border: "1px solid #2196f3",
                          borderRadius: "4px",
                          fontSize: "1rem"
                        }}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            handleSaveTeamName();
                          } else if (e.key === "Escape") {
                            handleCancelEditTeamName();
                          }
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveTeamName}
                        style={{
                          padding: "0.5rem 1rem",
                          backgroundColor: "#4caf50",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.9rem"
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEditTeamName}
                        style={{
                          padding: "0.5rem 1rem",
                          backgroundColor: "#999",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.9rem"
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 style={{ margin: 0 }}>
                        {team.name} ({team.playerCount} players)
                      </h3>
                      {myTeamId === teamId && !locked && (
                        <button
                          onClick={() => handleStartEditTeamName(teamId, team.name)}
                          style={{
                            padding: "0.25rem 0.75rem",
                            backgroundColor: "#2196f3",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.85rem"
                          }}
                        >
                          ✏️ Edit Name
                        </button>
                      )}
                    </>
                  )}
                </div>
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

          {locked && (
            <div style={{ 
              padding: "1rem", 
              backgroundColor: "#fff3cd", 
              border: "1px solid #ffc107",
              borderRadius: "4px",
              textAlign: "center"
            }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>
                Waiting for teacher to start the match...
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

