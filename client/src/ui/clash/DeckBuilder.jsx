import React, { useState, useEffect } from "react";
import { getToken } from "../../utils/auth.js";

/**
 * Chapter 16: Pre-match team deck builder.
 * Allows any team member to configure the 4-card deck before match starts.
 */
export function DeckBuilder({
  teamId,
  deckSlots = [null, null, null, null],
  teamCardPool = [],
  deckLocked = false,
  matchStarted = false,
  room,
}) {
  const [selectedPoolCardId, setSelectedPoolCardId] = useState(null);
  const [poolCards, setPoolCards] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all cards (same as CardBar)
  useEffect(() => {
    async function fetchCards() {
      try {
        const token = getToken();
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await fetch("http://localhost:3000/api/shop/cards", {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setAllCards(data.cards || []);
        }
      } catch (error) {
        console.error("[DeckBuilder] Failed to fetch cards:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCards();
  }, []);

  // Map teamCardPool IDs to full card objects
  useEffect(() => {
    if (allCards.length > 0 && teamCardPool.length > 0) {
      const mapped = teamCardPool
        .map(cardId => allCards.find(c => c.id === cardId))
        .filter(Boolean)
        .sort((a, b) => {
          // Sort: standard first, then cosmetic; then by name
          if (a.type !== b.type) {
            return a.type === "standard" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      setPoolCards(mapped);
    } else {
      setPoolCards([]);
    }
  }, [allCards, teamCardPool]);

  const handleSlotClick = (slotIndex) => {
    if (deckLocked || matchStarted) return;
    if (!room) return;

    // If a pool card is selected, assign it to this slot
    if (selectedPoolCardId) {
      room.send("SET_TEAM_DECK_SLOT", {
        slotIndex,
        cardId: selectedPoolCardId
      });
      setSelectedPoolCardId(null);
    } else {
      // If slot has a card, clear it
      if (deckSlots[slotIndex]) {
        room.send("SET_TEAM_DECK_SLOT", {
          slotIndex,
          cardId: null
        });
      }
    }
  };

  const handlePoolCardClick = (cardId) => {
    if (deckLocked || matchStarted) return;
    // Toggle selection
    setSelectedPoolCardId(selectedPoolCardId === cardId ? null : cardId);
  };

  const getCardInSlot = (slotIndex) => {
    const cardId = deckSlots[slotIndex];
    if (!cardId) return null;
    return allCards.find(c => c.id === cardId);
  };

  if (loading) {
    return (
      <section className="clash-deck-builder clash-panel">
        <h3 className="clash-deck-title">Team Deck Builder</h3>
        <p>Loading cards...</p>
      </section>
    );
  }

  if (matchStarted || deckLocked) {
    // Show locked deck view
    return (
      <section className="clash-deck-builder clash-panel">
        <h3 className="clash-deck-title">Team Deck (Locked)</h3>
        <div className="clash-deck-slots">
          {[0, 1, 2, 3].map(slotIndex => {
            const card = getCardInSlot(slotIndex);
            return (
              <div key={slotIndex} className="clash-deck-slot clash-deck-slot--locked">
                <div className="clash-deck-slot-label">Slot {slotIndex + 1}</div>
                {card ? (
                  <div className="clash-deck-slot-card">
                    <div className="clash-deck-slot-card-name">{card.name}</div>
                    <div className="clash-deck-slot-card-type">{card.type}</div>
                  </div>
                ) : (
                  <div className="clash-deck-slot-empty">Empty</div>
                )}
              </div>
            );
          })}
        </div>
        <p className="clash-deck-locked-msg">🔒 Deck locked for this match</p>
      </section>
    );
  }

  return (
    <section className="clash-deck-builder clash-panel">
      <h3 className="clash-deck-title">Team Deck Builder</h3>
      <p className="clash-deck-subtitle">Select a card from the pool, then click a slot to assign it.</p>
      
      <div className="clash-deck-slots">
        {[0, 1, 2, 3].map(slotIndex => {
          const card = getCardInSlot(slotIndex);
          const isSelected = selectedPoolCardId && !card;
          return (
            <div
              key={slotIndex}
              className={`clash-deck-slot ${isSelected ? "clash-deck-slot--selected" : ""} ${card ? "clash-deck-slot--filled" : ""}`}
              onClick={() => handleSlotClick(slotIndex)}
            >
              <div className="clash-deck-slot-label">Slot {slotIndex + 1}</div>
              {card ? (
                <div className="clash-deck-slot-card">
                  <div className="clash-deck-slot-card-name">{card.name}</div>
                  <div className="clash-deck-slot-card-type">{card.type}</div>
                  <button
                    className="clash-deck-slot-clear"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSlotClick(slotIndex);
                    }}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="clash-deck-slot-empty">
                  {isSelected ? "Click to assign" : "Empty"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="clash-deck-pool">
        <h4 className="clash-deck-pool-title">Team Card Pool ({poolCards.length} cards)</h4>
        {poolCards.length === 0 ? (
          <p className="clash-deck-pool-empty">No cards available. Team members need to unlock cards first.</p>
        ) : (
          <div className="clash-deck-pool-grid">
            {poolCards.map(card => {
              const isSelected = selectedPoolCardId === card.id;
              const isInDeck = deckSlots.includes(card.id);
              return (
                <div
                  key={card.id}
                  className={`clash-deck-pool-card ${isSelected ? "clash-deck-pool-card--selected" : ""} ${isInDeck ? "clash-deck-pool-card--in-deck" : ""}`}
                  onClick={() => handlePoolCardClick(card.id)}
                >
                  <div className="clash-deck-pool-card-name">{card.name}</div>
                  <div className="clash-deck-pool-card-type">{card.type}</div>
                  {isInDeck && <div className="clash-deck-pool-card-badge">In Deck</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

