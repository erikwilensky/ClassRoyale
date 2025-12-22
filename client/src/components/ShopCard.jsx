import React from "react";

export function ShopCard({ card, unlocked, availableXP, onPurchase, isPurchasing }) {
  const canAfford = availableXP >= card.unlockCost;
  const isOwned = unlocked;
  const canPurchase = !isOwned && canAfford && !isPurchasing;

  const handlePurchase = () => {
    if (canPurchase) {
      onPurchase(card.id);
    }
  };

  return (
    <div
      style={{
        border: "2px solid",
        borderColor: isOwned ? "#4caf50" : canAfford ? "#2196f3" : "#ccc",
        borderRadius: "8px",
        padding: "1rem",
        backgroundColor: isOwned ? "#f1f8f4" : canAfford ? "#f5f9ff" : "#f5f5f5",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        minHeight: "200px",
        position: "relative"
      }}
    >
      {/* Owned Badge */}
      {isOwned && (
        <div
          style={{
            position: "absolute",
            top: "0.5rem",
            right: "0.5rem",
            backgroundColor: "#4caf50",
            color: "white",
            padding: "0.25rem 0.5rem",
            borderRadius: "4px",
            fontSize: "0.75rem",
            fontWeight: "bold"
          }}
        >
          ✓ Owned
        </div>
      )}

      {/* Card Icon/Image Placeholder */}
      <div
        style={{
          width: "60px",
          height: "60px",
          backgroundColor: isOwned ? "#4caf50" : card.type === "cosmetic" ? "#9c27b0" : "#2196f3",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2rem",
          color: "white",
          marginBottom: "0.5rem"
        }}
      >
        {card.type === "cosmetic" ? "✨" : "🎴"}
      </div>

      {/* Card Name */}
      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "bold", color: "#333" }}>
        {card.name}
      </h3>

      {/* Card Type Badge */}
      <div
        style={{
          display: "inline-block",
          padding: "0.25rem 0.5rem",
          borderRadius: "4px",
          fontSize: "0.75rem",
          fontWeight: "bold",
          backgroundColor: card.type === "cosmetic" ? "#e1bee7" : "#bbdefb",
          color: card.type === "cosmetic" ? "#4a148c" : "#0d47a1",
          width: "fit-content"
        }}
      >
        {card.type === "cosmetic" ? "Cosmetic" : "Standard"}
      </div>

      {/* Card Description */}
      <p style={{ margin: 0, fontSize: "0.9rem", color: "#666", flexGrow: 1 }}>
        {card.description}
      </p>

      {/* Card Effect */}
      <div style={{ fontSize: "0.85rem", color: "#888", fontStyle: "italic" }}>
        Effect: {card.effect}
      </div>

      {/* Gold Cost (for standard cards) */}
      {card.type === "standard" && (
        <div style={{ fontSize: "0.85rem", color: "#f57c00" }}>
          Gold Cost: {card.cost} 🪙
        </div>
      )}

      {/* Unlock Cost */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "0.5rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid #ddd"
        }}
      >
        <div style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#333" }}>
          {card.unlockCost} XP
        </div>

        {/* Purchase Button */}
        <button
          onClick={handlePurchase}
          disabled={!canPurchase}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "4px",
            border: "none",
            backgroundColor: isOwned
              ? "#4caf50"
              : canAfford
              ? "#2196f3"
              : "#ccc",
            color: "white",
            fontWeight: "bold",
            cursor: canPurchase ? "pointer" : "not-allowed",
            opacity: canPurchase ? 1 : 0.6,
            transition: "opacity 0.2s"
          }}
        >
          {isOwned
            ? "✓ Owned"
            : isPurchasing
            ? "Purchasing..."
            : canAfford
            ? "Unlock"
            : "Insufficient XP"}
        </button>
      </div>
    </div>
  );
}

