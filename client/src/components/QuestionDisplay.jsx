import React from "react";

export function QuestionDisplay({ questionText, roundActive }) {
  const displayText =
    roundActive && questionText
      ? questionText
      : "Waiting for question...";

  return (
    <div
      style={{
        margin: "1rem 0",
        padding: "1rem",
        backgroundColor: "#f0f0f0",
        borderRadius: "4px",
        minHeight: "3rem"
      }}
    >
      {displayText}
    </div>
  );
}







