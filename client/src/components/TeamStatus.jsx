import React from "react";

export function TeamStatus({ teamId, teamName, isWriter, teamRole, writer, suggesters, locked, onTransferWriter, currentClientSessionId }) {
  if (!teamId) {
    return (
      <div style={{ padding: "1rem", backgroundColor: "#f0f0f0", borderRadius: "4px", marginBottom: "1rem" }}>
        <strong>Team:</strong> Not assigned yet
      </div>
    );
  }

  // Use teamName if available, otherwise fall back to teamId
  const displayName = teamName || teamId.toUpperCase();

  return (
    <div style={{ 
      padding: "1rem", 
      backgroundColor: isWriter ? "#e3f2fd" : "#f3e5f5", 
      borderRadius: "4px", 
      marginBottom: "1rem",
      border: locked ? "2px solid #4caf50" : "1px solid #ccc"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <strong style={{ fontSize: "1.1rem" }}>
          Team: {displayName}
        </strong>
        {locked && (
          <span style={{ 
            backgroundColor: "#4caf50", 
            color: "white", 
            padding: "0.25rem 0.5rem", 
            borderRadius: "4px",
            fontSize: "0.85rem"
          }}>
            🔒 LOCKED
          </span>
        )}
      </div>
      
      <div style={{ marginTop: "0.5rem" }}>
        <div>
          <strong>Your Role:</strong> {isWriter ? "✍️ Writer" : "💡 Suggester"}
        </div>
        
        {writer && (
          <div style={{ marginTop: "0.25rem", fontSize: "0.9rem" }}>
            <strong>Writer:</strong> {writer.substring(0, 8)}...
          </div>
        )}
        
        {suggesters && suggesters.length > 0 && (
          <div style={{ marginTop: "0.25rem", fontSize: "0.9rem" }}>
            <strong>Suggesters ({suggesters.length}):</strong>{" "}
            {suggesters.map((id, idx) => (
              <span key={idx}>
                {id.substring(0, 8)}...
                {isWriter && onTransferWriter && !locked && (
                  <button
                    onClick={() => onTransferWriter(id)}
                    style={{
                      marginLeft: "0.5rem",
                      padding: "0.2rem 0.5rem",
                      fontSize: "0.75rem",
                      backgroundColor: "#ff9800",
                      color: "white",
                      border: "none",
                      borderRadius: "3px",
                      cursor: "pointer"
                    }}
                  >
                    Make Writer
                  </button>
                )}
                {idx < suggesters.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


