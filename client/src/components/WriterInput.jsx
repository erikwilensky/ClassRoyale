import React from "react";
import { SuggestionList } from "./SuggestionList.jsx";

export function WriterInput({
  teamAnswer,
  suggestions,
  onAnswerChange,
  onInsertSuggestion,
  onLockAnswer,
  disabled,
  locked
}) {
  const handleInsert = (suggestion, index) => {
    if (onInsertSuggestion) {
      onInsertSuggestion(suggestion, index);
    }
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      <h3 style={{ marginBottom: "0.5rem" }}>✍️ Writer Controls</h3>
      
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
          Team Answer:
        </label>
        <textarea
          value={teamAnswer || ""}
          onChange={(e) => onAnswerChange && onAnswerChange(e.target.value)}
          disabled={disabled || locked}
          placeholder="Edit the team answer here. You can type directly or insert suggestions from your team."
          style={{
            width: "100%",
            minHeight: "120px",
            padding: "0.75rem",
            fontSize: "1rem",
            border: "2px solid #2196f3",
            borderRadius: "4px",
            fontFamily: "inherit",
            resize: "vertical"
          }}
        />
      </div>

      <SuggestionList
        suggestions={suggestions}
        onInsert={handleInsert}
        disabled={disabled || locked}
      />

      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={onLockAnswer}
          disabled={disabled || locked || !teamAnswer || teamAnswer.trim().length === 0}
          style={{
            padding: "0.75rem 2rem",
            fontSize: "1rem",
            backgroundColor: (disabled || locked || !teamAnswer || teamAnswer.trim().length === 0) 
              ? "#ccc" 
              : "#f44336",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: (disabled || locked || !teamAnswer || teamAnswer.trim().length === 0) 
              ? "not-allowed" 
              : "pointer",
            fontWeight: "bold"
          }}
        >
          {locked ? "🔒 Answer Locked" : "🔒 Lock Answer"}
        </button>
        {locked && (
          <div style={{ marginTop: "0.5rem", color: "#4caf50", fontWeight: "bold" }}>
            Your team's answer has been locked and submitted!
          </div>
        )}
      </div>
    </div>
  );
}





