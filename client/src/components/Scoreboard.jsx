import React from "react";

export function Scoreboard({ scores, roundNumber, matchOver }) {
  if (!scores || Object.keys(scores).length === 0) {
    return (
      <div style={{ padding: "1rem", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#f9f9f9" }}>
        <h3 style={{ marginTop: 0 }}>Scoreboard</h3>
        <p>No scores yet</p>
      </div>
    );
  }

  // Sort teams by round points (descending)
  const sortedTeams = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ padding: "1rem", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#f9f9f9", marginBottom: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Scoreboard</h3>
      <div style={{ marginBottom: "0.5rem", fontSize: "0.9rem", color: "#666" }}>
        Round: {roundNumber || 0} | {matchOver ? "Match Over" : "Active"}
      </div>
      <div>
        {sortedTeams.map(([teamId, points], index) => (
          <div key={teamId} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: index < sortedTeams.length - 1 ? "1px solid #eee" : "none" }}>
            <span style={{ fontWeight: index === 0 ? "bold" : "normal" }}>{teamId}</span>
            <span style={{ fontWeight: "bold" }}>{points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}



