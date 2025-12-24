import React from "react";

/**
 * CardArt - Displays the center art image for a card
 * 
 * Props:
 * - cardId: string (e.g., "brainwave-boost")
 * - category: string (e.g., "time_tempo")
 * - isDisabled: boolean (applies grayscale filter)
 * - className: string
 * - style: object (additional inline styles)
 */
export function CardArt({
  cardId,
  category,
  isDisabled = false,
  className = "",
  style = {},
}) {
  // Get card art image path
  const getCardArtPath = (cardId, category) => {
    // Map card ID to filename (from manifest.json pattern)
    const filename = cardId.replace(/-/g, "_") + ".png";
    
    // Map category to folder
    const categoryMap = {
      time_tempo: "time_tempo",
      suggestion_control: "suggestion_control",
      roles_coordination: "roles_coordination",
      defense_counterplay: "defense_counterplay",
      gold_economy: "gold_economy",
      disruption: "disruption",
      vision_clarity: "disruption",
      disruption_light: "disruption",
      cosmetic: "cosmetic",
    };
    
    const folder = categoryMap[category] || "cosmetic";
    // Card art is served from Express server on port 3000
    // In production, this could be relative if assets are bundled
    const baseUrl = import.meta.env.DEV ? "http://localhost:3000" : "";
    return `${baseUrl}/card_art/${folder}/${filename}`;
  };

  const cardArtPath = getCardArtPath(cardId, category);

  return (
    <img
      src={cardArtPath}
      alt={cardId}
      className={`card-art ${className}`}
      onError={(e) => {
        // Fallback if image doesn't load
        console.warn(`[CardArt] Failed to load image: ${cardArtPath}`);
        e.target.style.display = "none";
        const fallback = document.createElement("div");
        fallback.style.cssText = `
          color: #666;
          font-size: 0.7rem;
          text-align: center;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        `;
        fallback.textContent = cardId;
        e.target.parentElement.appendChild(fallback);
      }}
      style={{
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain",
        filter: isDisabled ? "grayscale(100%)" : "none",
        ...style,
      }}
    />
  );
}

