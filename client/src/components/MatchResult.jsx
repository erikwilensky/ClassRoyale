import React from "react";
import { getPlayerId } from "../utils/auth.js";

export function MatchResult({ matchData, teamId, onClose }) {
  if (!matchData) return null;

  const { winner, finalScores, mvp } = matchData;
  const isWinner = winner === teamId;
  const playerId = getPlayerId();
  const isMVP = mvp === playerId;

  // Sort teams by final score
  const sortedTeams = Object.entries(finalScores?.teams || {})
    .sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ 
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      padding: "2rem",
      border: "3px solid #4caf50",
      borderRadius: "12px",
      backgroundColor: "white",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      zIndex: 1000,
      maxWidth: "600px",
      width: "90%"
    }}>
      <h1 style={{ marginTop: 0, color: "#4caf50", textAlign: "center" }}>
        {isWinner ? "🎉 Match Won! 🎉" : "Match Over"}
      </h1>

      <div style={{ marginBottom: "1.5rem", textAlign: "center", fontSize: "1.2rem", fontWeight: "bold" }}>
        Winner: {winner}
      </div>

      {isMVP && (
        <div style={{ 
          padding: "1rem", 
          marginBottom: "1rem", 
          backgroundColor: "#fff3cd", 
          border: "2px solid #ffc107", 
          borderRadius: "4px",
          textAlign: "center",
          fontWeight: "bold"
        }}>
          ⭐ You are the MVP! ⭐
        </div>
      )}

      <div style={{ marginBottom: "1.5rem" }}>
        <strong>Final Standings:</strong>
        <ol style={{ marginTop: "0.5rem" }}>
          {sortedTeams.map(([tid, points], index) => (
            <li key={tid} style={{ fontWeight: tid === teamId ? "bold" : "normal", padding: "0.25rem 0" }}>
              {tid}: {points} {points === 1 ? "point" : "points"}
            </li>
          ))}
        </ol>
      </div>

      {finalScores?.perPlayer && (
        <div style={{ marginBottom: "1.5rem" }}>
          <strong>Top Players (Evaluation Score):</strong>
          <ul style={{ marginTop: "0.5rem" }}>
            {Object.entries(finalScores.perPlayer)
              .sort((a, b) => b[1].totalEvaluationScore - a[1].totalEvaluationScore)
              .slice(0, 5)
              .map(([pid, data]) => (
                <li key={pid} style={{ fontWeight: pid === playerId ? "bold" : "normal" }}>
                  {pid.substring(0, 8)}...: {data.totalEvaluationScore} points
                </li>
              ))}
          </ul>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
        <button 
          onClick={() => {
            if (onClose) {
              onClose();
            } else {
              window.location.reload();
            }
          }}
          style={{ 
            padding: "0.75rem 1.5rem", 
            backgroundColor: "#4caf50", 
            color: "white", 
            border: "none", 
            borderRadius: "4px", 
            cursor: "pointer",
            fontSize: "1rem"
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

