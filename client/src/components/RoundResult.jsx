import React from "react";

export function RoundResult({ roundData, teamId }) {
  if (!roundData) return null;

  const { roundNumber, question, evaluationScores, roundPoints, roundWinner, answers } = roundData;
  
  // Check if scores are pending (no evaluationScores yet)
  if (!evaluationScores || !evaluationScores.teams) {
    return (
      <div style={{ 
        padding: "1.5rem", 
        margin: "1rem 0", 
        border: "2px solid #ff9800", 
        borderRadius: "8px", 
        backgroundColor: "#fff3e0" 
      }}>
        <h2 style={{ marginTop: 0, color: "#ff9800" }}>Round {roundNumber} Results</h2>
        <p><strong>Question:</strong> {question}</p>
        <p><strong>Your Team's Answer:</strong> {answers?.[teamId]?.text || "No answer submitted"}</p>
        <p style={{ fontStyle: "italic", color: "#666" }}>⏳ Scores pending - waiting for teacher to evaluate...</p>
      </div>
    );
  }

  const teamScore = evaluationScores?.teams?.[teamId] || 0;
  const isWinner = roundWinner === teamId;

  // Sort teams by round points for standings
  const sortedTeams = Object.entries(roundPoints?.teams || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div style={{ 
      padding: "1.5rem", 
      margin: "1rem 0", 
      border: "2px solid #4caf50", 
      borderRadius: "8px", 
      backgroundColor: "#f1f8f4" 
    }}>
      <h2 style={{ marginTop: 0, color: "#4caf50" }}>Round {roundNumber} Results</h2>
      
      <div style={{ marginBottom: "1rem" }}>
        <strong>Question:</strong> {question}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <strong>Your Team's Answer:</strong> {answers?.[teamId]?.text || "No answer submitted"}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <strong>Your Team's Evaluation Score:</strong> {teamScore}/10
      </div>

      {isWinner && (
        <div style={{ 
          padding: "1rem", 
          marginBottom: "1rem", 
          backgroundColor: "#fff3cd", 
          border: "1px solid #ffc107", 
          borderRadius: "4px",
          fontWeight: "bold"
        }}>
          🎉 Your team won this round!
        </div>
      )}

      {roundWinner && !isWinner && (
        <div style={{ marginBottom: "1rem" }}>
          <strong>Round Winner:</strong> {roundWinner}
        </div>
      )}

      <div>
        <strong>Top 3 Standings:</strong>
        <ol style={{ marginTop: "0.5rem" }}>
          {sortedTeams.map(([tid, points], index) => (
            <li key={tid} style={{ fontWeight: tid === teamId ? "bold" : "normal" }}>
              {tid}: {points} {points === 1 ? "point" : "points"}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

