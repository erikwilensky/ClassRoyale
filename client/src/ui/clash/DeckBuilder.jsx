import React, { useState, useEffect } from "react";
import { getToken } from "../../utils/auth.js";
import { Card } from "../../components/Card.jsx";

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

  // Debug logging (only log when state changes significantly)
  useEffect(() => {
    if (teamCardPool.length > 0 && poolCards.length === 0 && allCards.length > 0) {
      console.warn('[DeckBuilder] Card mapping issue:', { 
        teamCardPoolLength: teamCardPool.length, 
        allCardsCount: allCards.length,
        poolCardsCount: poolCards.length,
        teamCardPoolSample: teamCardPool.slice(0, 3),
        allCardsSample: allCards.slice(0, 3).map(c => c.id)
      });
    }
  }, [teamCardPool.length, poolCards.length, allCards.length]);

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
  // Handles both catalog IDs (kebab-case) and legacy IDs (UPPER_CASE)
  // Deduplicates cards that appear in both legacy and catalog formats
  useEffect(() => {
    if (allCards.length > 0 && teamCardPool.length > 0) {
      const seenCardIds = new Set();
      const mapped = teamCardPool
        .map(cardId => {
          // Try direct match first (catalog ID)
          let card = allCards.find(c => c.id === cardId);
          
          // If no match, try converting legacy ID to catalog ID
          if (!card && cardId) {
            // Convert UPPER_CASE to kebab-case (e.g., "TIME_FREEZE" -> "time-freeze")
            const catalogId = cardId.toLowerCase().replace(/_/g, '-');
            card = allCards.find(c => c.id === catalogId);
          }
          
          // If still no match, try reverse (catalog to legacy)
          if (!card && cardId) {
            const legacyId = cardId.toUpperCase().replace(/-/g, '_');
            card = allCards.find(c => {
              const cardLegacyId = c.id.toUpperCase().replace(/-/g, '_');
              return cardLegacyId === legacyId;
            });
          }
          
          return card;
        })
        .filter(Boolean)
        .filter(card => {
          // Deduplicate: only keep the first occurrence of each card (by catalog ID)
          const cardId = card.id.toLowerCase().replace(/_/g, '-');
          if (seenCardIds.has(cardId)) {
            return false; // Skip duplicate
          }
          seenCardIds.add(cardId);
          return true;
        })
        .sort((a, b) => {
          // Sort: standard first, then cosmetic; then by name
          if (a.type !== b.type) {
            return a.type === "standard" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      setPoolCards(mapped);
      // Debug: Check which cards weren't mapped
      const unmappedIds = teamCardPool.filter(cardId => {
        const normalizedId = cardId.toLowerCase().replace(/_/g, '-');
        return !mapped.some(c => {
          const cardNormalized = c.id.toLowerCase().replace(/_/g, '-');
          return cardNormalized === normalizedId;
        });
      });
      
      const cosmeticCards = mapped.filter(c => c.type === 'cosmetic');
      const standardCards = mapped.filter(c => c.type === 'standard');
      
      console.log('[DeckBuilder] Mapped cards:', { 
        teamCardPoolCount: teamCardPool.length, 
        mappedCount: mapped.length,
        standardCount: standardCards.length,
        cosmeticCount: cosmeticCards.length,
        teamCardPool: teamCardPool,
        mappedIds: mapped.map(c => c.id),
        cosmeticIds: cosmeticCards.map(c => c.id),
        unmappedIds: unmappedIds,
        allCardsCount: allCards.length,
        allCardsSample: allCards.slice(0, 5).map(c => ({ id: c.id, name: c.name, type: c.type }))
      });
    } else {
      setPoolCards([]);
    }
  }, [allCards, teamCardPool]);

  const handleSlotClick = (slotIndex) => {
    if (deckLocked) {
      return; // Only check deckLocked, not matchStarted
    }
    if (!room) {
      return;
    }

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
    if (deckLocked) {
      return; // Only check deckLocked, not matchStarted
    }
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

  // Only log when there's a potential issue
  if (deckLocked && poolCards.length > 0) {
    console.log('[DeckBuilder] Deck is locked but cards are available');
  }

  if (deckLocked) {
    // Show locked deck view (only check deckLocked from server)
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
                  <Card
                    card={{
                      id: card.id,
                      name: card.name,
                      category: card.category || 'cosmetic',
                      baseGoldCost: card.cost || 0,
                      unlockXp: card.unlockCost || 0,
                      kind: card.type || 'standard',
                      target: card.target || 'self',
                    }}
                    isUnlocked={true}
                    isDisabled={false}
                    isSelected={false}
                    className="clash-deck-slot-card-inner"
                  />
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
              // Map shop API format to Card component format
              const cardData = {
                id: card.id,
                name: card.name,
                category: card.category || 'cosmetic',
                baseGoldCost: card.cost || 0,
                unlockXp: card.unlockCost || 0,
                kind: card.type || 'standard',
                target: card.target || 'self',
              };
              return (
                <div
                  key={card.id}
                  className={`clash-deck-pool-card-wrapper ${isSelected ? "clash-deck-pool-card--selected" : ""} ${isInDeck ? "clash-deck-pool-card--in-deck" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!deckLocked && !isInDeck) {
                      console.log('[DeckBuilder] Clicking card:', card.id, card.name, 'type:', card.type, 'category:', card.category);
                      handlePoolCardClick(card.id);
                    } else {
                      console.log('[DeckBuilder] Card click blocked:', { deckLocked, isInDeck, cardId: card.id });
                    }
                  }}
                  style={{ 
                    cursor: deckLocked || isInDeck ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Card
                    card={cardData}
                    isUnlocked={card.unlocked !== false}
                    isDisabled={deckLocked || isInDeck}
                    isSelected={isSelected}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!deckLocked && !isInDeck) {
                        handlePoolCardClick(card.id);
                      }
                    }}
                  />
                  {isInDeck && (
                    <div className="clash-deck-pool-card-badge" style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'var(--clash-accent)',
                      color: '#0b1630',
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      zIndex: 10
                    }}>In Deck</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

