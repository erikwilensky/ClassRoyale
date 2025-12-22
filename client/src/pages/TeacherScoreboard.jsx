import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../utils/auth.js";

export function TeacherScoreboard() {
  const navigate = useNavigate();
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overrideInputs, setOverrideInputs] = useState({}); // { "teamId-round": value }
  const [submitting, setSubmitting] = useState(false);
  const [roundData, setRoundData] = useState(null); // Latest ROUND_DATA
  const [scoreInputs, setScoreInputs] = useState({}); // { "round-teamId": value }

  useEffect(() => {
    fetchScores();
    // Poll for updates every 2 seconds
    const interval = setInterval(fetchScores, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchScores = async () => {
    try {
      const token = getToken();
      const response = await fetch("http://localhost:3000/api/score/match", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch scores");
      }

      const data = await response.json();
      setScores(data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching scores:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleOverride = async (teamId, round, newScore) => {
    if (newScore < 0 || newScore > 10) {
      setError("Score must be between 0 and 10");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const token = getToken();
      const response = await fetch("http://localhost:3000/api/score/override", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          teamId,
          round,
          newEvaluationScore: parseFloat(newScore)
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Override failed");
      }

      // Clear input and refresh scores
      setOverrideInputs(prev => {
        const key = `${teamId}-${round}`;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await fetchScores();
    } catch (err) {
      console.error("Error overriding score:", err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading scores...</div>;
  }

  if (error && !scores) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Scoreboard</h1>
        <p style={{ color: "red" }}>Error: {error}</p>
        <button onClick={() => navigate("/teacher")}>Back to Teacher</button>
      </div>
    );
  }

  // Build team data with answers from all rounds
  const teamData = {};
  const rounds = scores?.roundNumber || 0;

  // Get team IDs from scores
  const teamIds = Object.keys(scores?.teams || {});

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1>Scoreboard</h1>
        <button onClick={() => navigate("/teacher")} style={{ padding: "0.5rem 1rem", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
          Back to Teacher
        </button>
      </div>

      {error && (
        <div style={{ padding: "1rem", marginBottom: "1rem", backgroundColor: "#fee", border: "1px solid #fcc", borderRadius: "4px", color: "#c00" }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <strong>Round:</strong> {scores?.roundNumber || 0} | 
        <strong> Match Status:</strong> {scores?.matchOver ? `Over - Winner: ${scores.winner}` : "Active"}
      </div>

      {rounds === 0 ? (
        <p>No rounds played yet. Start a round to see scores.</p>
      ) : (
        <>
          {/* Pending Scoring Section */}
          {roundData && (
            <div style={{ marginBottom: "2rem", padding: "1rem", border: "2px solid #ff9800", borderRadius: "4px", backgroundColor: "#fff3e0" }}>
              <h3 style={{ marginTop: 0, color: "#ff9800" }}>📝 Score Round {roundData.roundNumber}</h3>
              <div style={{ marginBottom: "1rem" }}>
                <strong>Question:</strong> {roundData.question}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                {Object.entries(roundData.answers || {}).map(([teamId, answerData]) => {
                  const inputKey = `${roundData.roundNumber}-${teamId}`;
                  return (
                    <div key={teamId} style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "white", borderRadius: "4px", border: "1px solid #ddd" }}>
                      <div style={{ marginBottom: "0.5rem" }}>
                        <strong>{teamId}:</strong> {answerData.text || "(No answer)"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <label>Score (0-10):</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={scoreInputs[inputKey] || ""}
                          onChange={(e) => setScoreInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                          style={{ width: "80px", padding: "0.25rem" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => handleSubmitScores(roundData.roundNumber)}
                disabled={submitting}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#4caf50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: "1rem",
                  fontWeight: "bold"
                }}
              >
                {submitting ? "Submitting..." : "Submit Scores"}
              </button>
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ padding: "0.75rem", border: "1px solid #ddd", textAlign: "left" }}>Team</th>
                <th style={{ padding: "0.75rem", border: "1px solid #ddd", textAlign: "left" }}>Round Points</th>
                {Array.from({ length: rounds }, (_, i) => (
                  <th key={i + 1} style={{ padding: "0.75rem", border: "1px solid #ddd", textAlign: "left" }}>
                    Round {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamIds.map(teamId => {
                const roundPoints = scores.teams[teamId] || 0;
                return (
                  <tr key={teamId}>
                    <td style={{ padding: "0.75rem", border: "1px solid #ddd", fontWeight: "bold" }}>{teamId}</td>
                    <td style={{ padding: "0.75rem", border: "1px solid #ddd", textAlign: "center", fontWeight: "bold" }}>{roundPoints}</td>
                    {Array.from({ length: rounds }, (_, i) => {
                      const round = i + 1;
                      const roundScoreData = scores.roundScores?.[round];
                      const teamScore = roundScoreData?.[teamId];
                      const key = `${teamId}-${round}`;
                      const inputValue = overrideInputs[key] || "";
                      const isPending = !teamScore && round === rounds && roundData && roundData.roundNumber === round;
                      
                      return (
                        <td key={round} style={{ padding: "0.75rem", border: "1px solid #ddd" }}>
                          {isPending ? (
                            <span style={{ color: "#ff9800", fontStyle: "italic" }}>Pending...</span>
                          ) : teamScore !== undefined ? (
                            <div>
                              <div style={{ marginBottom: "0.5rem", fontWeight: "bold" }}>{teamScore}/10</div>
                              {!scores.matchOver && (
                                <>
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    value={inputValue}
                                    onChange={(e) => setOverrideInputs(prev => ({ ...prev, [key]: e.target.value }))}
                                    placeholder="Override"
                                    style={{ width: "60px", padding: "0.25rem" }}
                                  />
                                  <button
                                    onClick={() => handleOverride(teamId, round, inputValue)}
                                    disabled={submitting || !inputValue}
                                    style={{ marginLeft: "0.5rem", padding: "0.25rem 0.5rem", fontSize: "0.85rem" }}
                                  >
                                    Override
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "#999" }}>-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {scores?.perPlayer && Object.keys(scores.perPlayer).length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Player Scores</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ padding: "0.75rem", border: "1px solid #ddd", textAlign: "left" }}>Player ID</th>
                <th style={{ padding: "0.75rem", border: "1px solid #ddd", textAlign: "left" }}>Total Evaluation Score</th>
                <th style={{ padding: "0.75rem", border: "1px solid #ddd", textAlign: "left" }}>Round Scores</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(scores.perPlayer).map(([playerId, data]) => (
                <tr key={playerId}>
                  <td style={{ padding: "0.75rem", border: "1px solid #ddd" }}>{playerId.substring(0, 8)}...</td>
                  <td style={{ padding: "0.75rem", border: "1px solid #ddd", textAlign: "center" }}>{data.totalEvaluationScore || 0}</td>
                  <td style={{ padding: "0.75rem", border: "1px solid #ddd" }}>
                    {data.roundScores?.join(", ") || "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

