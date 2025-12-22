import React from "react";

export function AnswerList({ answers }) {
  console.log("[AnswerList] Received answers prop:", answers);
  
  if (!answers || answers.length === 0) {
    return (
      <div style={{ marginTop: "2rem", color: "#666", fontStyle: "italic" }}>
        No answers collected yet.
      </div>
    );
  }

  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
        {answers.map((answer, index) => (
          <li
            key={index}
            style={{
              padding: "0.5rem",
              margin: "0.5rem 0",
              backgroundColor: "#e8f4f8",
              borderRadius: "4px"
            }}
          >
            <strong>Student {index + 1}:</strong> {answer.text}
          </li>
        ))}
    </ul>
  );
}

