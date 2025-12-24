import React from "react";

/**
 * Card Component - Renders a full card with art, frame, and metadata
 * 
 * Props:
 * - card: { id, name, category, baseGoldCost, unlockXp, kind, target }
 * - isUnlocked: boolean
 * - isDisabled: boolean
 * - effectiveCost: number (gold cost after modifiers)
 * - goldCostModifier: number (optional multiplier)
 * - onClick: function
 * - onPointerDown: function (for drag)
 * - isSelected: boolean
 * - className: string
 */
export function Card({
  card,
  isUnlocked = false,
  isDisabled = false,
  effectiveCost = null,
  goldCostModifier = null,
  onClick,
  onPointerDown,
  isSelected = false,
  className = "",
}) {
  // Get card art image path
  const getCardArtPath = (cardId) => {
    // Try to load manifest.json for accurate paths
    // For now, use a fallback mapping based on known patterns
    const baseUrl = import.meta.env.DEV ? "http://localhost:3000" : "";
    
    // Map category to folder (catalog uses different names than folders)
    const categoryMap = {
      // Catalog category names -> folder names
      tempo_time_control: "time_tempo",
      suggestion_communication_control: "suggestion_control",
      suggestion_control: "suggestion_control",
      roles_team_coordination: "roles_coordination",
      roles_coordination: "roles_coordination",
      defense_counterplay: "defense_counterplay",
      gold_economy: "gold_economy",
      classroom_safe_disruption: "disruption",
      disruption: "disruption",
      vision_clarity: "disruption",
      disruption_light: "disruption",
      cosmetic: "cosmetic",
      // Legacy folder names (for backwards compatibility)
      time_tempo: "time_tempo",
    };
    
    const folder = categoryMap[card.category] || "cosmetic";
    // Convert card ID to filename: "brainwave-boost" -> "brainwave_boost.png"
    const filename = cardId.replace(/-/g, "_") + ".png";
    return `${baseUrl}/card_art/${folder}/${filename}`;
  };

  // Category colors for glow/border
  const categoryColors = {
    time_tempo: { border: "#6a5acd", glow: "rgba(106, 90, 205, 0.3)" },
    suggestion_control: { border: "#00bcd4", glow: "rgba(0, 188, 212, 0.3)" },
    roles_coordination: { border: "#ff6b35", glow: "rgba(255, 107, 53, 0.3)" },
    defense_counterplay: { border: "#20b2aa", glow: "rgba(32, 178, 170, 0.3)" },
    gold_economy: { border: "#ffd700", glow: "rgba(255, 215, 0, 0.3)" },
    disruption: { border: "#8b008b", glow: "rgba(139, 0, 139, 0.3)" },
    cosmetic: { border: "#c0c0c0", glow: "rgba(192, 192, 192, 0.3)" },
  };

  const colors = categoryColors[card.category] || categoryColors.cosmetic;
  const cardArtPath = getCardArtPath(card.id);
  const displayCost = effectiveCost !== null ? effectiveCost : card.baseGoldCost || 0;
  const isCosmetic = card.kind === "cosmetic";

  return (
    <div
      className={`card ${className}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      style={{
        position: "relative",
        width: "140px",
        height: "200px",
        backgroundColor: "#0d1117",
        borderRadius: "16px",
        border: `3px solid ${isSelected ? "#fff" : "#4a5568"}`,
        overflow: "hidden",
        cursor: isDisabled ? "not-allowed" : onClick || onPointerDown ? "pointer" : "default",
        opacity: isDisabled ? 0.6 : 1,
        transform: isSelected ? "scale(1.05)" : "scale(1)",
        transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
        // Clash Royale style: metallic frame with subtle glow
        boxShadow: `
          ${isSelected ? `0 0 25px ${colors.glow}, 0 0 15px ${colors.border},` : ""}
          0 8px 16px rgba(0,0,0,0.5),
          inset 0 0 60px ${colors.glow}40,
          inset 0 2px 6px rgba(0,0,0,0.6),
          inset 0 -2px 6px rgba(255,255,255,0.1)
        `,
        // Metallic frame effect
        background: `linear-gradient(135deg, #1a1f2e 0%, #0d1117 50%, #1a1f2e 100%)`,
      }}
    >
      {/* Vignette overlay - Clash Royale style */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(ellipse at center 60%, transparent 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.7) 100%)`,
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      {/* Grain overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")`,
          pointerEvents: "none",
          zIndex: 4,
        }}
      />

      {/* Top-left: Cost badge (Clash Royale style) */}
      {!isCosmetic && (
        <div
          style={{
            position: "absolute",
            top: "6px",
            left: "6px",
            zIndex: 3,
            width: "32px",
            height: "32px",
            background: `linear-gradient(135deg, ${colors.border} 0%, ${colors.border}dd 100%)`,
            borderRadius: "50% 50% 50% 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.3)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          <span
            style={{
              fontSize: "0.85rem",
              fontWeight: "bold",
              color: "#fff",
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
            }}
          >
            {displayCost}
          </span>
        </div>
      )}

      {/* Top header: Card name */}
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: isCosmetic ? "8px" : "42px",
          right: "8px",
          zIndex: 2,
          textAlign: isCosmetic ? "center" : "left",
        }}
      >
        <div
          style={{
            fontSize: "0.7rem",
            fontWeight: "bold",
            color: "#fff",
            textShadow: "0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)",
            lineHeight: "1.2",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "0.5px",
          }}
        >
          {card.name}
        </div>
      </div>

      {/* Center art slot */}
      <div
        style={{
          position: "absolute",
          top: "28px",
          left: "10px",
          right: "10px",
          bottom: "50px",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "8px",
        }}
      >
        <img
          src={cardArtPath}
          alt={card.name}
          onError={(e) => {
            // Fallback if image doesn't load
            e.target.style.display = "none";
            e.target.parentElement.innerHTML = `<div style="color: #666; font-size: 0.7rem; text-align: center;">${card.name}</div>`;
          }}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            filter: isDisabled ? "grayscale(100%)" : "none",
          }}
        />
      </div>

      {/* Bottom: XP unlock cost (if locked) */}
      {!isUnlocked && card.unlockXp && (
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            left: "8px",
            right: "8px",
            zIndex: 2,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "0.65rem",
              color: "#ffd700",
              textShadow: "0 2px 4px rgba(0,0,0,0.9)",
              fontWeight: "bold",
            }}
          >
            🔒 {card.unlockXp} XP
          </div>
        </div>
      )}

      {/* Lock overlay */}
      {!isUnlocked && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5,
            borderRadius: "10px",
          }}
        >
          <div
            style={{
              fontSize: "2rem",
              opacity: 0.8,
            }}
          >
            🔒
          </div>
        </div>
      )}
    </div>
  );
}

