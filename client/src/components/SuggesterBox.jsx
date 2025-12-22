import React from "react";

export function SuggesterBox({
  suggestionText,
  teamAnswer,
  onSuggestionChange,
  onSubmitSuggestion,
  disabled
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (suggestionText && suggestionText.trim().length > 0 && onSubmitSuggestion) {
      onSubmitSuggestion(suggestionText.trim());
    }
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      <h3 style={{ marginBottom: "0.5rem" }}>💡 Suggester Controls</h3>
      
      {teamAnswer && (
        <div style={{ 
          marginBottom: "1rem", 
          padding: "1rem", 
          backgroundColor: "#e8f5e9", 
          borderRadius: "4px",
          border: "1px solid #4caf50"
        }}>
          <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
            Current Team Answer (read-only):
          </div>
          <div style={{ 
            padding: "0.75rem", 
            backgroundColor: "white", 
            borderRadius: "4px",
            minHeight: "60px",
            fontStyle: teamAnswer ? "normal" : "italic",
            color: teamAnswer ? "black" : "#666"
          }}>
            {teamAnswer || "Writer hasn't started the answer yet..."}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
          Propose Text Suggestion:
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={suggestionText || ""}
            onChange={(e) => onSuggestionChange && onSuggestionChange(e.target.value)}
            disabled={disabled}
            placeholder="Type your suggestion here..."
            style={{
              flex: 1,
              padding: "0.75rem",
              fontSize: "1rem",
              border: "2px solid #9c27b0",
              borderRadius: "4px",
              fontFamily: "inherit"
            }}
          />
          <button
            type="submit"
            disabled={disabled || !suggestionText || suggestionText.trim().length === 0}
            style={{
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              backgroundColor: (disabled || !suggestionText || suggestionText.trim().length === 0)
                ? "#ccc"
                : "#9c27b0",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: (disabled || !suggestionText || suggestionText.trim().length === 0)
                ? "not-allowed"
                : "pointer",
              fontWeight: "bold"
            }}
          >
            Submit Suggestion
          </button>
        </div>
        <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
          The writer will see your suggestion and can choose to insert it into the answer.
        </div>
      </form>
    </div>
  );
}





