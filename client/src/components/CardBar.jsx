import React, { useState, useEffect } from "react";
import { getToken } from "../utils/auth.js";

// Chapter 10: CardBar now fetches cards from server and supports cosmetic cards
export function CardBar({ gold, onCastCard, disabled, roundActive, availableTeams, currentTeamId, unlockedCards = [], playerLevel = 1, disabledCards = new Set(), goldCostModifiers = {} }) {
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

  const handleCardClick = (cardId) => {
    console.log("[CardBar] Card clicked:", cardId);
    const card = allCards.find(c => c.id === cardId);
    if (!card) {
      console.warn("[CardBar] Card not found:", cardId);
      return;
    }
    
    console.log("[CardBar] Card found:", card.name, "target:", card.target, "selectedTarget:", selectedTarget);
    
    if (card.target === "self") {
      console.log("[CardBar] Casting self-target card:", cardId, "to team:", currentTeamId);
      onCastCard(cardId, currentTeamId);
    } else if (card.target === "opponent") {
      if (selectedTarget && selectedTarget !== currentTeamId) {
        console.log("[CardBar] Casting opponent-target card:", cardId, "to team:", selectedTarget);
        onCastCard(cardId, selectedTarget);
      } else {
        console.warn("[CardBar] Cannot cast opponent card: no valid target selected");
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

    // Cosmetic cards are always enabled (no gold cost, no modifier)
    if (card.type === "cosmetic") return false;

    // Standard cards: use adjusted cost when checking affordability
    const multiplier = typeof goldCostModifiers[card.id] === "number" ? goldCostModifiers[card.id] : 1.0;
    const clampedMultiplier = Math.min(2.0, Math.max(0.5, multiplier));
    let adjustedCost = Math.ceil(card.cost * clampedMultiplier);
    if (adjustedCost < 1) adjustedCost = 1;

    if (gold < adjustedCost) return true;
    if (card.target === "opponent" && (!selectedTarget || selectedTarget === currentTeamId)) return true;
    return false;
  };

  const getDisplayCost = (card) => {
    if (card.type === "cosmetic") return "Free";
    const multiplier = typeof goldCostModifiers[card.id] === "number" ? goldCostModifiers[card.id] : 1.0;
    const clampedMultiplier = Math.min(2.0, Math.max(0.5, multiplier));
    let adjustedCost = Math.ceil(card.cost * clampedMultiplier);
    if (adjustedCost < 1) adjustedCost = 1;
    if (clampedMultiplier !== 1.0) {
      return `${adjustedCost}💰 (${clampedMultiplier.toFixed(1)}x)`;
    }
    return `${card.cost}💰`;
  };
  
  // Separate cards by type and unlock status
  const standardCards = allCards.filter(card => card.type === "standard");
  const cosmeticCards = allCards.filter(card => card.type === "cosmetic");
  
  const unlockedStandardCards = standardCards.filter(card => isCardUnlocked(card.id));
  const lockedStandardCards = standardCards.filter(card => !isCardUnlocked(card.id));
  const unlockedCosmeticCards = cosmeticCards.filter(card => isCardUnlocked(card.id));

  if (loading) {
    return (
      <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px", border: "1px solid #ddd" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>🎴 Cards</h3>
        <div>Loading cards...</div>
      </div>
    );
  }

  // Debug: Log card counts
  console.log("[CardBar] Render - allCards:", allCards.length, "unlockedCards prop:", unlockedCards.length);
  console.log("[CardBar] standardCards:", standardCards.length, "cosmeticCards:", cosmeticCards.length);
  console.log("[CardBar] unlockedStandard:", unlockedStandardCards.length, "lockedStandard:", lockedStandardCards.length, "unlockedCosmetic:", unlockedCosmeticCards.length);

  return (
    <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px", border: "1px solid #ddd" }}>
      <h3 style={{ marginBottom: "0.75rem" }}>🎴 Cards</h3>
      
      {allCards.length === 0 && !loading && (
        <div style={{ color: "#666", fontStyle: "italic" }}>No cards available. Please check your connection.</div>
      )}
      
      {/* Show message if no cards at all */}
      {allCards.length > 0 && standardCards.length === 0 && cosmeticCards.length === 0 && (
        <div style={{ color: "#666", fontStyle: "italic" }}>No cards found in response.</div>
      )}
      
      {/* Target selector for opponent cards */}
      {standardCards.some(card => card.target === "opponent" && isCardUnlocked(card.id)) && availableTeams && availableTeams.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "bold" }}>
            Target Team (for opponent cards):
          </label>
          <select
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            disabled={disabled || !roundActive}
            style={{
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
              width: "100%",
              maxWidth: "300px"
            }}
          >
            <option value="">Select target team...</option>
            {availableTeams
              .filter(team => team.teamId !== currentTeamId)
              .map(team => (
                <option key={team.teamId} value={team.teamId}>
                  {team.teamId} ({team.currentSize}/{team.maxSize} members)
                </option>
              ))}
          </select>
        </div>
      )}

      {/* Standard Cards - Show all (unlocked and locked) */}
      {standardCards.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", color: "#666" }}>Standard Cards</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {/* Unlocked standard cards */}
            {unlockedStandardCards.map((card) => {
              const cardDisabled = isCardDisabled(card);
              const multiplier = typeof goldCostModifiers[card.id] === "number" ? goldCostModifiers[card.id] : 1.0;
              const clampedMultiplier = Math.min(2.0, Math.max(0.5, multiplier));
              let adjustedCost = Math.ceil(card.cost * clampedMultiplier);
              if (adjustedCost < 1) adjustedCost = 1;
              const canAfford = gold >= adjustedCost;
              
              return (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card.id)}
                  disabled={cardDisabled}
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: cardDisabled ? "#ccc" : (card.target === "self" ? "#4caf50" : "#f44336"),
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
                        ? `Need ${adjustedCost} gold, have ${gold}`
                        : card.target === "opponent" && (!selectedTarget || selectedTarget === currentTeamId)
                        ? "Select a valid target team"
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
              const cardDisabled = disabled || !roundActive;
              
              return (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card.id)}
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
                  title={cardDisabled ? "Round not active" : `Use ${card.name} (Free)`}
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
