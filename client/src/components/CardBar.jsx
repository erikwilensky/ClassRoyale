import React, { useState, useEffect } from "react";
import { getToken } from "../utils/auth.js";
import { getEffectiveGoldCost } from "../ui/drag/dragRules.js";

// Chapter 10/14/15: CardBar fetches cards and supports drag / tap-to-select casting
// Chapter 16: Supports cardFilterIds to show only deck cards in-match
export function CardBar({
  className = "",
  gold,
  onCastCard,
  disabled,
  roundActive,
  availableTeams,
  currentTeamId,
  unlockedCards = [],
  playerLevel = 1,
  disabledCards = new Set(),
  goldCostModifiers = {},
  // Drag + selection props from Student page
  onCardPointerDown,
  onCardClickForSelect,
  selectedCardId = null,
  // Chapter 16: Filter cards to only show these IDs (for deck-only view)
  cardFilterIds = null,
}) {
  const [selectedTarget, setSelectedTarget] = useState("");
  const [allCards, setAllCards] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch cards from server on mount
  useEffect(() => {
    async function fetchCards() {
      try {
        const token = getToken();
        if (!token) {
          console.warn("[CardBar] No token found");
          setLoading(false);
          return;
        }

        const response = await fetch("http://localhost:3000/api/shop/cards", {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          console.log("[CardBar] Cards fetched:", data);
          setAllCards(data.cards || []);
        } else {
          const errorText = await response.text();
          console.error("[CardBar] Failed to fetch cards:", response.status, errorText);
        }
      } catch (error) {
        console.error("[CardBar] Failed to fetch cards:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCards();
  }, []);

  const handleCardClick = (cardId, event) => {
    console.log("[CardBar] Card clicked:", cardId);
    const card = allCards.find(c => c.id === cardId);
    if (!card) {
      console.warn("[CardBar] Card not found:", cardId);
      return;
    }
    
    console.log("[CardBar] Card found:", card.name, "target:", card.target, "selectedTarget:", selectedTarget);
    
    if (onCardClickForSelect) {
      onCardClickForSelect(card, event);
      return;
    }

    // Legacy fallback (should not be used when drag system is active)
    if (onCastCard) {
      if (card.target === "self") {
        console.log("[CardBar] Casting self-target card (fallback):", cardId, "to team:", currentTeamId);
        onCastCard(cardId, currentTeamId);
      } else if (card.target === "opponent") {
        if (selectedTarget && selectedTarget !== currentTeamId) {
          console.log("[CardBar] Casting opponent-target card (fallback):", cardId, "to team:", selectedTarget);
          onCastCard(cardId, selectedTarget);
        } else {
          console.warn("[CardBar] Cannot cast opponent card (fallback): no valid target selected");
        }
      }
    }
  };

  const isCardUnlocked = (cardId) => {
    return unlockedCards.includes(cardId);
  };

  const isCardDisabled = (card) => {
    // Match-level disable takes precedence
    if (disabledCards && disabledCards.has(card.id)) return true;

    if (!isCardUnlocked(card.id)) return true; // Locked cards are disabled
    if (disabled || !roundActive) return true;

    // Standard cards: use adjusted cost when checking affordability
    const effectiveCost = getEffectiveGoldCost({ card, goldCostModifiers });
    if (gold < effectiveCost) return true;
    return false;
  };

  const getDisplayCost = (card) => {
    if (card.type === "cosmetic") return "Free";
    const effectiveCost = getEffectiveGoldCost({ card, goldCostModifiers });
    const multiplier =
      typeof goldCostModifiers[card.id] === "number"
        ? goldCostModifiers[card.id]
        : 1.0;
    if (multiplier !== 1.0) {
      return `${effectiveCost}💰 (${multiplier.toFixed(1)}x)`;
    }
    return `${effectiveCost}💰`;
  };
  
  // Chapter 16: Filter cards if cardFilterIds is provided
  let filteredCards = allCards;
  if (cardFilterIds && Array.isArray(cardFilterIds) && cardFilterIds.length > 0) {
    const filterSet = new Set(cardFilterIds.filter(Boolean)); // Remove nulls
    filteredCards = allCards.filter(card => filterSet.has(card.id));
    // Preserve order based on cardFilterIds
    filteredCards.sort((a, b) => {
      const indexA = cardFilterIds.indexOf(a.id);
      const indexB = cardFilterIds.indexOf(b.id);
      return indexA - indexB;
    });
  }

  // Separate cards by type and unlock status
  const standardCards = filteredCards.filter(card => card.type === "standard");
  const cosmeticCards = filteredCards.filter(card => card.type === "cosmetic");
  
  const unlockedStandardCards = standardCards.filter(card => isCardUnlocked(card.id));
  const lockedStandardCards = standardCards.filter(card => !isCardUnlocked(card.id));
  const unlockedCosmeticCards = cosmeticCards.filter(card => isCardUnlocked(card.id));

  if (loading) {
    return (
      <div
        className={["clash-cardbar", className].filter(Boolean).join(" ")}
        style={{
          marginTop: "1rem",
          padding: "1rem",
          backgroundColor: "#f5f5f5",
          borderRadius: "4px",
          border: "1px solid #ddd",
        }}
      >
        <h3 style={{ marginBottom: "0.75rem" }}>🎴 Cards</h3>
        <div>Loading cards...</div>
      </div>
    );
  }

  // Debug: Log card counts
  console.log("[CardBar] Render - allCards:", allCards.length, "filteredCards:", filteredCards.length, "unlockedCards prop:", unlockedCards.length);
  console.log("[CardBar] cardFilterIds:", cardFilterIds);
  console.log("[CardBar] standardCards:", standardCards.length, "cosmeticCards:", cosmeticCards.length);
  console.log("[CardBar] unlockedStandard:", unlockedStandardCards.length, "lockedStandard:", lockedStandardCards.length, "unlockedCosmetic:", unlockedCosmeticCards.length);

  return (
    <div
      className={["clash-cardbar", className].filter(Boolean).join(" ")}
      style={{
        marginTop: "1rem",
        padding: "1rem",
        backgroundColor: "#f5f5f5",
        borderRadius: "4px",
        border: "1px solid #ddd",
      }}
    >
      <h3 style={{ marginBottom: "0.75rem" }}>🎴 Cards</h3>
      
      {allCards.length === 0 && !loading && (
        <div style={{ color: "#666", fontStyle: "italic" }}>No cards available. Please check your connection.</div>
      )}
      
      {/* Show message if no cards at all */}
      {allCards.length > 0 && standardCards.length === 0 && cosmeticCards.length === 0 && (
        <div style={{ color: "#666", fontStyle: "italic" }}>No cards found in response.</div>
      )}
      
      {/* Standard Cards - Show all (unlocked and locked) */}
      {standardCards.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", color: "#666" }}>Standard Cards</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {/* Unlocked standard cards */}
            {unlockedStandardCards.map((card) => {
              const cardDisabled = isCardDisabled(card);
              const effectiveCost = getEffectiveGoldCost({ card, goldCostModifiers });
              const canAfford = gold >= effectiveCost;
              const isSelected = selectedCardId === card.id;
              
              return (
                <button
                  key={card.id}
                  onClick={(e) => handleCardClick(card.id, e)}
                  onPointerDown={onCardPointerDown ? (e) => onCardPointerDown(card, e) : undefined}
                  disabled={cardDisabled}
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: cardDisabled
                      ? "#ccc"
                      : isSelected
                      ? "#1976d2"
                      : card.target === "self"
                      ? "#4caf50"
                      : "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: cardDisabled ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                    opacity: cardDisabled ? 0.6 : 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: "120px",
                    position: "relative"
                  }}
                  title={
                    disabledCards && disabledCards.has(card.id)
                      ? "Disabled this match by teacher"
                      : cardDisabled
                      ? !roundActive
                        ? "Round not active"
                        : !canAfford
                        ? `Need ${effectiveCost} gold, have ${gold}`
                        : "Cannot cast"
                      : `Cast ${card.name} (${getDisplayCost(card)})`
                  }
                >
                  <span>{card.name}</span>
                  <span style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                    {getDisplayCost(card)} {card.target === "self" ? "(Self)" : "(Opponent)"}
                  </span>
                </button>
              );
            })}
            {/* Locked standard cards */}
            {lockedStandardCards.map((card) => {
              return (
                <button
                  key={card.id}
                  disabled={true}
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: "#999",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "not-allowed",
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                    opacity: 0.5,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: "120px",
                    position: "relative"
                  }}
                  title={`Unlock for ${card.unlockCost} XP in Shop`}
                >
                  <span style={{ position: "relative" }}>
                    {card.name}
                    <span style={{ 
                      position: "absolute", 
                      top: "-8px", 
                      right: "-8px", 
                      fontSize: "0.7rem" 
                    }}>🔒</span>
                  </span>
                  <span style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                    {card.cost}💰 {card.target === "self" ? "(Self)" : "(Opponent)"}
                  </span>
                  <span style={{ fontSize: "0.65rem", marginTop: "0.25rem", opacity: 0.8 }}>
                    {card.unlockCost} XP
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Cosmetic Cards - Show all unlocked */}
      {cosmeticCards.length > 0 && unlockedCosmeticCards.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", color: "#666" }}>✨ Cosmetic Cards</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {unlockedCosmeticCards.map((card) => {
              // Check if card is disabled (match-level disable or round not active)
              const cardDisabled = isCardDisabled(card);
              const isMatchDisabled = disabledCards && disabledCards.has(card.id);
              
              return (
                <button
                  key={card.id}
                  onClick={(e) => handleCardClick(card.id, e)}
                  disabled={cardDisabled}
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: cardDisabled ? "#ccc" : "#9c27b0",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: cardDisabled ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                    opacity: cardDisabled ? 0.6 : 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: "120px"
                  }}
                  title={
                    isMatchDisabled
                      ? "Disabled this match by teacher"
                      : cardDisabled
                      ? "Round not active"
                      : `Use ${card.name} (Free)`
                  }
                >
                  <span>✨ {card.name}</span>
                  <span style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                    Free
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
