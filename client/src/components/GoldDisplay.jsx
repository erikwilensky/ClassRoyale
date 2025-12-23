import React from "react";

export function GoldDisplay({ gold, teamId }) {
  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        backgroundColor: "#ffd700",
        borderRadius: "4px",
        border: "2px solid #ffa500",
        display: "inline-block",
        fontWeight: "bold",
        fontSize: "1.1rem",
        color: "#333",
        marginBottom: "1rem"
      }}
    >
      💰 Gold: {gold || 0}
    </div>
  );
}





