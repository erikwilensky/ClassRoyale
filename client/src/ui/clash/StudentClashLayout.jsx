import React from "react";
import { TopHud } from "./TopHud.jsx";
import { Arena } from "./Arena.jsx";
import { AnswerDock } from "./AnswerDock.jsx";
import { BottomHand } from "./BottomHand.jsx";
import { DeckBuilder } from "./DeckBuilder.jsx";
import "./clash.css";

/**
 * Top-level Clash-style layout for the Student page.
 * Purely presentational: all state and handlers are passed via props.
 * 
 * Chapter 17.1: Layout contract
 * - Uses CSS Grid with 3 rows: [HUD] [MAIN] [HAND]
 * - HUD and HAND are fixed-height grid rows (no scrolling)
 * - MAIN is the only scrollable region (overflow-y: auto)
 * - This ensures stable, predictable layout on all screen sizes
 */
export function StudentClashLayout({
  hudProps,
  hasTeam,
  arenaProps,
  answerProps,
  handProps,
  teamSelectionContent,
  deckBuilderProps,
}) {
  return (
    <div className="clash-root">
      <TopHud {...hudProps} />

      <main className="clash-main">
        {hasTeam ? (
          <>
            {deckBuilderProps && <DeckBuilder {...deckBuilderProps} />}
            <Arena {...arenaProps} />
            <AnswerDock {...answerProps} />
          </>
        ) : (
          <section className="clash-panel clash-team-select">
            {teamSelectionContent}
          </section>
        )}
      </main>

      {hasTeam && <BottomHand {...handProps} />}
    </div>
  );
}


