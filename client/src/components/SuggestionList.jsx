import React from "react";

export function SuggestionList({ suggestions, onInsert, disabled }) {
  if (!suggestions || suggestions.length === 0) {
    return (
      <div style={{ 
        padding: "1rem", 
        backgroundColor: "#f5f5f5", 
        borderRadius: "4px",
        color: "#666",
        fontStyle: "italic"
      }}>
        No suggestions yet. Waiting for team members to propose text...
      </div>
    );
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <h4 style={{ marginBottom: "0.5rem" }}>Suggestions from Team ({suggestions.length}):</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {suggestions.map((suggestion, index) => {
          const timestamp = suggestion.timestamp 
            ? new Date(suggestion.timestamp).toLocaleTimeString() 
            : "now";
          
          return (
            <div
              key={index}
              style={{
                padding: "0.75rem",
                backgroundColor: "#fff9c4",
                borderRadius: "4px",
                border: "1px solid #fbc02d",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
                  "{suggestion.text}"
                </div>
                <div style={{ fontSize: "0.8rem", color: "#666" }}>
                  From: {suggestion.suggesterId?.substring(0, 8)}... • {timestamp}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onInsert && !disabled) {
                    onInsert(suggestion, index);
                  }
                }}
                disabled={disabled}
                style={{
                  marginLeft: "1rem",
                  padding: "0.5rem 1rem",
                  backgroundColor: disabled ? "#ccc" : "#4caf50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontWeight: "bold"
                }}
              >
                Insert
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


