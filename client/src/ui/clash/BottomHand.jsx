import React from "react";
import { CardBar } from "../../components/CardBar.jsx";

/**
 * Bottom hand wrapper around the existing CardBar.
 * Presentation-only: forces sticky bar and Clash-style classes.
 */
export function BottomHand({
  gold,
  disabled,
  roundActive,
  availableTeams,
  currentTeamId,
  unlockedCards,
  playerLevel,
  disabledCards,
  goldCostModifiers,
  onCardPointerDown,
  onCardClickForSelect,
  selectedCardId,
  // Chapter 16: Deck filter
  cardFilterIds = null,
}) {
  return (
    <section className="clash-hand">
      <CardBar
        className="clash-cardbar"
        gold={gold}
        onCastCard={undefined /* casting is triggered from Student via handlers */}
        disabled={disabled}
        roundActive={roundActive}
        availableTeams={availableTeams}
        currentTeamId={currentTeamId}
        unlockedCards={unlockedCards}
        playerLevel={playerLevel}
        disabledCards={disabledCards}
        goldCostModifiers={goldCostModifiers}
        onCardPointerDown={onCardPointerDown}
        onCardClickForSelect={onCardClickForSelect}
        selectedCardId={selectedCardId}
        cardFilterIds={cardFilterIds}
      />
    </section>
  );
}


