import React from "react";

export function SuggestionList({ 
  suggestions, 
  onInsert, 
  disabled,
  // Chapter 17.2: Themeable className props
  className = "",
  emptyStateClassName = "clash-empty-state",
  listClassName = "clash-list",
  itemClassName = "clash-list-item",
  itemButtonClassName = "clash-btn clash-btn--secondary",
}) {
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className={emptyStateClassName}>
        No suggestions yet. Waiting for team members to propose text...
      </div>
    );
  }

  return (
    <div className={className || ""}>
      <h4 style={{ marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 600, color: "#cfd8dc" }}>
        Suggestions from Team ({suggestions.length}):
      </h4>
      <div className={listClassName}>
        {suggestions.map((suggestion, index) => {
          const timestamp = suggestion.timestamp 
            ? new Date(suggestion.timestamp).toLocaleTimeString() 
            : "now";
          
          return (
            <div
              key={index}
              className={itemClassName}
            >
              <div className="clash-list-item-content">
                <div className="clash-list-item-text">
                  "{suggestion.text}"
                </div>
                <div className="clash-list-item-meta">
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
                className={itemButtonClassName}
                style={{ marginLeft: "1rem" }}
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


