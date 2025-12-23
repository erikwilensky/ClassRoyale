import React from "react";
import { Scoreboard } from "../../components/Scoreboard.jsx";

/**
 * Top HUD bar for the Clash-style student UI.
 * Presentation-only: consumes derived state and displays it.
 */

export function TopHud({
  round,
  connectionStatus,
  roomId,
  teamName,
  teamGold,
  matchScores,
  matchOver,
  moderation,
  playerId,
  onLogout,
  showShopLink = true,
}) {
  const isMuted =
    !!playerId && Array.isArray(moderation?.mutedPlayers)
      ? moderation.mutedPlayers.includes(playerId)
      : false;
  const isRoundFrozen = !!moderation?.roundFrozen;

  return (
    <header className="clash-hud-bar">
      <div className="clash-hud-section">
        <div className="clash-hud-label">
          <span className="clash-hud-connection">
            {connectionStatus === "connecting" && "Connecting..."}
            {connectionStatus === "connected" && "Connected"}
            {connectionStatus === "error" && "Connection Issue"}
          </span>
          {roomId && (
            <span className="clash-hud-room">Room: {roomId}</span>
          )}
          {teamName && (
            <span className="clash-hud-team">Team: {teamName}</span>
          )}
        </div>
      </div>

      <div className="clash-hud-center">
        <div className="clash-hud-round">
          <span className="clash-hud-round-label">
            Round {round?.roundNumber} – {round?.phaseLabel}
          </span>
        </div>
        <div className="clash-hud-question" title={round?.questionText || ""}>
          {round?.questionText || "Waiting for question…"}
        </div>
      </div>

      <div className="clash-hud-section clash-hud-section--right">
        {round?.showTimer && (
          <div className="clash-chip clash-chip--timer">
            ⏱ {round?.timerText}
          </div>
        )}
        <div className="clash-chip clash-chip--gold">💰 {teamGold ?? 0}</div>
        <div className="clash-chip clash-chip--score">
          <Scoreboard
            compact
            scores={matchScores}
            roundResult={round?.roundResult}
            matchOver={!!matchOver}
          />
        </div>
        {isRoundFrozen && (
          <div className="clash-chip clash-chip--warning">⏸️ Paused</div>
        )}
        {isMuted && (
          <div className="clash-chip clash-chip--warning">🔇 Muted</div>
        )}
        {showShopLink && (
          <button
            className="clash-btn clash-btn--secondary"
            type="button"
            onClick={() => {
              window.location.href = "/shop";
            }}
          >
            Shop
          </button>
        )}
        {onLogout && (
          <button
            className="clash-btn clash-btn--danger"
            type="button"
            onClick={onLogout}
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}


