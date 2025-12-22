import React from "react";

export function Timer({ timeRemaining }) {
  const time = typeof timeRemaining === "number" ? timeRemaining : 0;
  const isCritical = time <= 10;

  return (
    <div
      style={{
        fontSize: "1.5rem",
        fontWeight: "bold",
        margin: "0.5rem 0",
        color: isCritical ? "red" : "black"
      }}
    >
      Time: {time}s
    </div>
  );
}






