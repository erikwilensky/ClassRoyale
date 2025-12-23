// Chapter 12: Teacher Moderation Panel
import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { getToken, removeToken } from "../utils/auth.js";

export function TeacherModeration() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = getToken();

  // Teams are provided as a snapshot from the Teacher page via router state
  const [teams, setTeams] = useState(location.state?.teams || {});

  // Moderation state is loaded via REST and updated after each action
  const [moderationState, setModerationState] = useState({
    mutedPlayers: [],
    frozenTeams: [],
    roundFrozen: false
  });

  // We no longer maintain a separate WebSocket connection here
  const connectionStatus = "connected";
  const room = null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Debug: Log teams state
  useEffect(() => {
    console.log("[TeacherModeration] Teams state updated:", Object.keys(teams).length, "teams");
    if (Object.keys(teams).length > 0) {
      console.log("[TeacherModeration] Teams:", teams);
    }
  }, [teams]);
  
  // Log connection and teams status for debugging
  useEffect(() => {
    if (room && connectionStatus === "connected") {
      const roomTeamsCount = room.state?.teams?.size || 0;
      const stateTeamsCount = Object.keys(teams).length;
      console.log(`[TeacherModeration] Connection status: connected, room.state.teams: ${roomTeamsCount}, state.teams: ${stateTeamsCount}`);
      if (roomTeamsCount > 0 && stateTeamsCount === 0) {
        console.warn("[TeacherModeration] Teams exist in room.state but not in normalized state - state sync should handle this");
      }
    }
  }, [room, connectionStatus, teams]);

  // Fetch moderation status helper (used on mount and after actions)
  const fetchModerationStatus = async () => {
    if (!token) return;
    try {
      const response = await fetch("http://localhost:3000/api/match/moderation/status", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch moderation status");
      const data = await response.json();
      setModerationState({
        mutedPlayers: data.mutedPlayers || [],
        frozenTeams: data.frozenTeams || [],
        roundFrozen: !!data.roundFrozen
      });
    } catch (err) {
      console.error("[TeacherModeration] Failed to fetch status:", err);
    }
  };

  // Initial moderation state load
  useEffect(() => {
    fetchModerationStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  
  // Helper to extract players from teams with playerIds
  const getPlayersFromTeams = () => {
    const playersMap = new Map();
    for (const [teamId, team] of Object.entries(teams)) {
      // Writer - use writerPlayerId if available
      if (team.writerPlayerId) {
        playersMap.set(team.writerPlayerId, {
          playerId: team.writerPlayerId,
          sessionId: team.writer || null,
          teamId,
          role: "writer",
          displayName: team.name || teamId
        });
      } else if (team.writer) {
        // Fallback to sessionId if playerId not available
        playersMap.set(team.writer, {
          playerId: team.writer, // Will use sessionId as playerId (may not work for moderation)
          sessionId: team.writer,
          teamId,
          role: "writer",
          displayName: team.name || teamId
        });
      }
      
      // Suggesters - use suggesterPlayerIds array (array of playerId strings)
      if (team.suggesterPlayerIds && Array.isArray(team.suggesterPlayerIds)) {
        team.suggesterPlayerIds.forEach((playerId) => {
          if (!playersMap.has(playerId)) {
            // Find corresponding sessionId from suggesters array if available
            const sessionId = team.suggesters?.find((s, idx) => {
              // Try to match by index or other means
              return true; // We'll use the playerId as the key
            }) || null;
            playersMap.set(playerId, {
              playerId: playerId,
              sessionId: sessionId,
              teamId,
              role: "suggester",
              displayName: team.name || teamId
            });
          }
        });
      } else if (team.suggesters && Array.isArray(team.suggesters)) {
        // Fallback: if suggesterPlayerIds not available, use sessionIds
        team.suggesters.forEach((sessionId) => {
          if (!playersMap.has(sessionId)) {
            playersMap.set(sessionId, {
              playerId: sessionId, // Will use sessionId as playerId (may not work for moderation)
              sessionId: sessionId,
              teamId,
              role: "suggester",
              displayName: team.name || teamId
            });
          }
        });
      }
    }
    return Array.from(playersMap.values());
  };

  // Moderation actions
  const handleMutePlayer = async (playerId) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3000/api/match/moderation/mute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ playerId }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to mute player");
      }
      await fetchModerationStatus();
    } catch (err) {
      setError(err.message || "Failed to mute player");
    } finally {
      setLoading(false);
    }
  };

  const handleUnmutePlayer = async (playerId) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3000/api/match/moderation/unmute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ playerId }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to unmute player");
      }
      await fetchModerationStatus();
    } catch (err) {
      setError(err.message || "Failed to unmute player");
    } finally {
      setLoading(false);
    }
  };

  const handleFreezeTeam = async (teamId) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3000/api/match/moderation/freeze-team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teamId }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to freeze team");
      }
      await fetchModerationStatus();
    } catch (err) {
      setError(err.message || "Failed to freeze team");
    } finally {
      setLoading(false);
    }
  };

  const handleUnfreezeTeam = async (teamId) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3000/api/match/moderation/unfreeze-team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teamId }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to unfreeze team");
      }
      await fetchModerationStatus();
    } catch (err) {
      setError(err.message || "Failed to unfreeze team");
    } finally {
      setLoading(false);
    }
  };

  const handleFreezeRound = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3000/api/match/moderation/freeze-round", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to freeze round");
      }
      await fetchModerationStatus();
    } catch (err) {
      setError(err.message || "Failed to freeze round");
    } finally {
      setLoading(false);
    }
  };

  const handleResumeRound = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3000/api/match/moderation/resume-round", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to resume round");
      }
      await fetchModerationStatus();
    } catch (err) {
      setError(err.message || "Failed to resume round");
    } finally {
      setLoading(false);
    }
  };

  const handleResetModeration = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3000/api/match/moderation/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to reset moderation");
      }
      await fetchModerationStatus();
    } catch (err) {
      setError(err.message || "Failed to reset moderation");
    } finally {
      setLoading(false);
    }
  };

  const players = getPlayersFromTeams();
  const teamIds = Object.keys(teams);

  if (!token) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Teacher Moderation</h1>
        <p>You must be logged in as a teacher to access moderation controls.</p>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ margin: 0 }}>🛡️ Classroom Moderation</h1>
        <div style={{ display: "flex", gap: "1rem" }}>
          <Link
            to="/teacher"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#2196f3",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px"
            }}
          >
            Back to Teacher
          </Link>
          <button
            onClick={() => {
              removeToken();
              navigate("/login");
            }}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: 
        connectionStatus === "connected" ? "#c8e6c9" : 
        connectionStatus === "connecting" ? "#fff9c4" : "#ffcdd2",
        borderRadius: "4px" }}>
        Status: <strong>{connectionStatus === "connected" ? "Connected" : connectionStatus === "connecting" ? "Connecting..." : "Error"}</strong>
      </div>

      {error && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#ffebee", color: "#c62828", borderRadius: "4px" }}>
          Error: {error}
        </div>
      )}

      {/* Round Controls */}
      <div style={{ marginBottom: "2rem", padding: "1.5rem", border: "2px solid #ff9800", borderRadius: "8px", backgroundColor: "#fff3e0" }}>
        <h2 style={{ marginTop: 0, color: "#ff9800" }}>⏸️ Round Controls</h2>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          {moderationState.roundFrozen ? (
            <>
              <div style={{ padding: "0.5rem 1rem", backgroundColor: "#ffebee", color: "#c62828", borderRadius: "4px", fontWeight: "bold" }}>
                ⏸️ Round Paused by Teacher
              </div>
              <button
                onClick={handleResumeRound}
                disabled={loading || connectionStatus !== "connected"}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#4caf50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: (loading || connectionStatus !== "connected") ? "not-allowed" : "pointer",
                  opacity: (loading || connectionStatus !== "connected") ? 0.6 : 1
                }}
              >
                ▶️ Resume Round
              </button>
            </>
          ) : (
            <button
              onClick={handleFreezeRound}
              disabled={loading || connectionStatus !== "connected"}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#ff9800",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: (loading || connectionStatus !== "connected") ? "not-allowed" : "pointer",
                opacity: (loading || connectionStatus !== "connected") ? 0.6 : 1
              }}
            >
              ⏸️ Freeze Round
            </button>
          )}
          <button
            onClick={handleResetModeration}
            disabled={loading || connectionStatus !== "connected"}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#9e9e9e",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: (loading || connectionStatus !== "connected") ? "not-allowed" : "pointer",
              opacity: (loading || connectionStatus !== "connected") ? 0.6 : 1
            }}
          >
            🔄 Reset All Moderation
          </button>
        </div>
        <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#666" }}>
          Freezing a round pauses the timer and blocks all answer/card actions. Use this for classroom management or technical issues.
        </p>
      </div>

      {/* Teams Section */}
      <div style={{ marginBottom: "2rem", padding: "1.5rem", border: "2px solid #9c27b0", borderRadius: "8px", backgroundColor: "#f3e5f5" }}>
        <h2 style={{ marginTop: 0, color: "#9c27b0" }}>❄️ Team Controls</h2>
        {teamIds.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>No teams available yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {teamIds.map((teamId) => {
              const team = teams[teamId];
              const isFrozen = moderationState.frozenTeams.includes(teamId);
              return (
                <div
                  key={teamId}
                  style={{
                    padding: "1rem",
                    backgroundColor: "white",
                    borderRadius: "4px",
                    border: isFrozen ? "2px solid #f44336" : "1px solid #ccc"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#9c27b0" }}>
                        {team.name || teamId}
                        {isFrozen && <span style={{ marginLeft: "0.5rem", color: "#f44336", fontWeight: "bold" }}>❄️ FROZEN</span>}
                      </h3>
                      <p style={{ margin: "0.25rem 0", fontSize: "0.9rem", color: "#666" }}>
                        Writer: {team.writer ? team.writer.substring(0, 12) + "..." : "None"} | 
                        Suggesters: {team.suggesters ? team.suggesters.length : 0}
                      </p>
                    </div>
                    {isFrozen ? (
                      <button
                        onClick={() => handleUnfreezeTeam(teamId)}
                        disabled={loading || connectionStatus !== "connected"}
                        style={{
                          padding: "0.5rem 1rem",
                          backgroundColor: "#4caf50",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: (loading || connectionStatus !== "connected") ? "not-allowed" : "pointer",
                          opacity: (loading || connectionStatus !== "connected") ? 0.6 : 1
                        }}
                      >
                        ▶️ Unfreeze
                      </button>
                    ) : (
                      <button
                        onClick={() => handleFreezeTeam(teamId)}
                        disabled={loading || connectionStatus !== "connected"}
                        style={{
                          padding: "0.5rem 1rem",
                          backgroundColor: "#ff9800",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: (loading || connectionStatus !== "connected") ? "not-allowed" : "pointer",
                          opacity: (loading || connectionStatus !== "connected") ? 0.6 : 1
                        }}
                      >
                        ❄️ Freeze Team
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#666" }}>
          Freezing a team blocks answer editing, locking, and card casting for all members. Existing answers remain visible.
        </p>
      </div>

      {/* Players Section */}
      <div style={{ marginBottom: "2rem", padding: "1.5rem", border: "2px solid #2196f3", borderRadius: "8px", backgroundColor: "#e3f2fd" }}>
        <h2 style={{ marginTop: 0, color: "#2196f3" }}>🔇 Player Controls</h2>
        <p style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#666" }}>
          Mute individual players to prevent them from submitting/inserting suggestions or casting cards. Does not affect writer rotation.
        </p>
        {players.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>No players available yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {players.map((player) => {
              // Use playerId from team data (now included in TEAM_UPDATE)
              const playerId = player.playerId || player.sessionId; // Use playerId if available, fallback to sessionId
              const isMuted = moderationState.mutedPlayers.includes(playerId);
              return (
                <div
                  key={player.sessionId}
                  style={{
                    padding: "1rem",
                    backgroundColor: "white",
                    borderRadius: "4px",
                    border: isMuted ? "2px solid #f44336" : "1px solid #ccc"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#2196f3" }}>
                        {player.displayName}
                        {isMuted && <span style={{ marginLeft: "0.5rem", color: "#f44336", fontWeight: "bold" }}>🔇 MUTED</span>}
                      </h3>
                      <p style={{ margin: "0.25rem 0", fontSize: "0.9rem", color: "#666" }}>
                        Team: {player.teamId} | Role: {player.role}
                      </p>
                    </div>
                    {isMuted ? (
                      <button
                        onClick={() => handleUnmutePlayer(playerId)}
                        disabled={loading || connectionStatus !== "connected"}
                        style={{
                          padding: "0.5rem 1rem",
                          backgroundColor: "#4caf50",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: (loading || connectionStatus !== "connected") ? "not-allowed" : "pointer",
                          opacity: (loading || connectionStatus !== "connected") ? 0.6 : 1
                        }}
                      >
                        🔊 Unmute
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMutePlayer(playerId)}
                        disabled={loading || connectionStatus !== "connected"}
                        style={{
                          padding: "0.5rem 1rem",
                          backgroundColor: "#ff9800",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: (loading || connectionStatus !== "connected") ? "not-allowed" : "pointer",
                          opacity: (loading || connectionStatus !== "connected") ? 0.6 : 1
                        }}
                      >
                        🔇 Mute
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#666" }}>
          Muting a player blocks suggestions, insert suggestions, and card casting. Does not affect writer rotation.
        </p>
      </div>

      {/* Info Box */}
      <div style={{ padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px", fontSize: "0.9rem" }}>
        <h3 style={{ marginTop: 0 }}>ℹ️ About Moderation</h3>
        <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
          <li>All moderation state is ephemeral and resets automatically on round end, match reset, or match end.</li>
          <li>No logs, recordings, or persistent data are stored.</li>
          <li>Moderation actions are for classroom management only and do not affect scoring or XP.</li>
        </ul>
      </div>
    </div>
  );
}

