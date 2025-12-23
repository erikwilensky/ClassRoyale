import React from "react";
import { TowerDropZone } from "./TowerDropZone.jsx";

/**
 * Arena region showing your team and opponent towers as drop targets.
 * Presentation-only: all state/handlers are passed via props.
 */
export function Arena({
  yourTeam,
  opponentTeams,
  hoveredTeamId,
  isTeamValidDropTarget,
  registerDropRef,
  onTeamClickForCast,
}) {
  return (
    <section className="clash-arena">
      <div className="clash-arena-row clash-arena-row--opponents">
        {opponentTeams && opponentTeams.length > 0 ? (
          opponentTeams.map((t) => (
            <TowerDropZone
              key={t.teamId}
              teamId={t.teamId}
              teamName={t.name}
              gold={t.gold}
              writer={t.writer}
              locked={t.locked}
              statusFlags={{ isSelf: false, isFrozen: t.isFrozen }}
              isValidDropTarget={isTeamValidDropTarget(t.teamId)}
              isHoveredDropTarget={hoveredTeamId === t.teamId}
              registerDropRef={registerDropRef}
              onClickForCast={onTeamClickForCast}
            />
          ))
        ) : (
          <div className="clash-arena-empty clash-panel">
            <p>No teams yet. Use the panel below to create or join a team.</p>
          </div>
        )}
      </div>

      {yourTeam && (
        <div className="clash-arena-row clash-arena-row--self">
          <TowerDropZone
            teamId={yourTeam.id}
            teamName={yourTeam.name}
            gold={yourTeam.gold}
            writer={yourTeam.writer}
            locked={yourTeam.locked}
            statusFlags={{ isSelf: true, isFrozen: yourTeam.isFrozen }}
            isValidDropTarget={isTeamValidDropTarget(yourTeam.id)}
            isHoveredDropTarget={hoveredTeamId === yourTeam.id}
            registerDropRef={registerDropRef}
            onClickForCast={onTeamClickForCast}
          />
        </div>
      )}
    </section>
  );
}


