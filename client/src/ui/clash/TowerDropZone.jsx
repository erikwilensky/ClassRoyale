import React, { useEffect, useRef } from "react";

/**
 * Presentational tower/tile that acts as a drop target and click target.
 * Compatible with Chapter 14 hit-testing (registerDropRef).
 */
export function TowerDropZone({
  teamId,
  teamName,
  gold,
  writer,
  locked,
  statusFlags = {},
  isValidDropTarget,
  isHoveredDropTarget,
  registerDropRef,
  onClickForCast,
  children,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (registerDropRef && ref.current && teamId) {
      registerDropRef(teamId, ref.current);
    }
  }, [registerDropRef, teamId]);

  const classes = [
    "clash-tower",
    statusFlags.isSelf ? "clash-tower--self" : "clash-tower--opponent",
    isValidDropTarget ? "clash-tower--valid" : "",
    isHoveredDropTarget ? "clash-tower--hovered" : "",
    statusFlags.isFrozen ? "clash-tower--frozen" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={ref}
      className={classes}
      onClick={onClickForCast ? () => onClickForCast(teamId) : undefined}
    >
      <div className="clash-tower-header">
        <span className="clash-tower-name">
          {statusFlags.isSelf ? "Your Team" : teamName || teamId}
        </span>
        {locked && <span className="clash-tower-lock">🔒</span>}
      </div>
      <div className="clash-tower-meta">
        <span className="clash-tower-gold">💰 {gold ?? 0}</span>
        {writer && (
          <span className="clash-tower-writer">
            ✍️ {String(writer).slice(0, 8)}…
          </span>
        )}
      </div>
      {statusFlags.isFrozen && (
        <div className="clash-tower-badge clash-tower-badge--frozen">
          ❄️ Frozen
        </div>
      )}
      {children && <div className="clash-tower-body">{children}</div>}
    </div>
  );
}


