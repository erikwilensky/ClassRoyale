import React from "react";

/**
 * Floating card preview that follows the pointer during drag.
 *
 * Props:
 * - isDragging: boolean
 * - cardMeta: { id, name, type, displayCostText }
 * - pointerX, pointerY: number (viewport coordinates)
 * - isValidDrop: boolean (true when currently over a valid target)
 */
export function CardDragGhost({
  isDragging,
  cardMeta,
  pointerX,
  pointerY,
  isValidDrop,
}) {
  if (!isDragging || !cardMeta) {
    return null;
  }

  const style = {
    position: "fixed",
    left: pointerX + 12,
    top: pointerY + 12,
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    zIndex: 9999,
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
    backgroundColor: isValidDrop ? "rgba(76, 175, 80, 0.9)" : "rgba(244, 67, 54, 0.9)",
    color: "#fff",
    boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
    fontFamily: "Arial, sans-serif",
    fontSize: "0.85rem",
    minWidth: "140px",
    textAlign: "center",
  };

  return (
    <div style={style}>
      <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
        {cardMeta.name || cardMeta.id}
      </div>
      {cardMeta.displayCostText && (
        <div style={{ fontSize: "0.75rem", opacity: 0.9 }}>
          {cardMeta.displayCostText}
        </div>
      )}
      <div style={{ fontSize: "0.7rem", marginTop: "0.25rem", opacity: 0.9 }}>
        {isValidDrop ? "Release to cast" : "Invalid target"}
      </div>
    </div>
  );
}


