// Chapter 14: Pointer-based drag controller for student card casting
// This hook is UI-only and does not talk to the server.

import { useState, useCallback } from "react";

/**
 * Hook for managing card drag state in the Student UI.
 *
 * Responsibilities:
 * - Track drag state (which card, pointer position, valid targets, hovered target).
 * - Support tap-to-select fallback (selectedCardId).
 * - Expose imperative API used by CardBar + Student page orchestration.
 *
 * It does not perform any server calls or business-rule checks itself.
 */
export function useCardDrag() {
  const [dragState, setDragState] = useState({
    isDragging: false,
    dragCardId: null,
    dragCardMeta: null,
    pointerX: 0,
    pointerY: 0,
    validTargetTeamIds: [],
    hoveredTargetTeamId: null,
    selectedCardId: null,
  });

  const beginDrag = useCallback((cardMeta, pointerEvent, validTargetTeamIds = []) => {
    if (!cardMeta || !cardMeta.id) return;

    const { clientX, clientY } = pointerEvent;

    setDragState(prev => ({
      ...prev,
      isDragging: true,
      dragCardId: cardMeta.id,
      dragCardMeta: cardMeta,
      pointerX: clientX,
      pointerY: clientY,
      validTargetTeamIds: Array.isArray(validTargetTeamIds) ? validTargetTeamIds : [],
      hoveredTargetTeamId: null,
      // Do not clear selectedCardId here; selection can coexist with drag
    }));
  }, []);

  const updatePointer = useCallback((pointerEvent) => {
    const { clientX, clientY } = pointerEvent;

    setDragState(prev => {
      if (!prev.isDragging) return prev;
      return {
        ...prev,
        pointerX: clientX,
        pointerY: clientY,
      };
    });
  }, []);

  const endDrag = useCallback(() => {
    let result = { didDrop: false, targetTeamId: null, cardId: null };

    setDragState(prev => {
      if (prev.isDragging && prev.dragCardId) {
        const { hoveredTargetTeamId, validTargetTeamIds, dragCardId } = prev;
        const didDrop =
          !!hoveredTargetTeamId &&
          Array.isArray(validTargetTeamIds) &&
          validTargetTeamIds.includes(hoveredTargetTeamId);

        result = {
          didDrop,
          targetTeamId: didDrop ? hoveredTargetTeamId : null,
          cardId: dragCardId,
        };
      }

      return {
        ...prev,
        isDragging: false,
        dragCardId: null,
        dragCardMeta: null,
        hoveredTargetTeamId: null,
        validTargetTeamIds: prev.validTargetTeamIds,
      };
    });

    return result;
  }, []);

  const cancelDrag = useCallback(() => {
    setDragState(prev => ({
      ...prev,
      isDragging: false,
      dragCardId: null,
      dragCardMeta: null,
      hoveredTargetTeamId: null,
      // Keep validTargetTeamIds/selectedCardId; only the active drag is cancelled
    }));
  }, []);

  const setHoveredTargetTeamId = useCallback((teamId) => {
    setDragState(prev => {
      if (!prev.isDragging) return prev;
      return {
        ...prev,
        hoveredTargetTeamId: teamId,
      };
    });
  }, []);

  const selectCard = useCallback((cardId) => {
    setDragState(prev => ({
      ...prev,
      selectedCardId: cardId,
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setDragState(prev => ({
      ...prev,
      selectedCardId: null,
    }));
  }, []);

  const isTeamValidDropTarget = useCallback((teamId) => {
    if (!teamId) return false;
    return dragState.validTargetTeamIds.includes(teamId);
  }, [dragState.validTargetTeamIds]);

  return {
    ...dragState,
    beginDrag,
    updatePointer,
    endDrag,
    cancelDrag,
    selectCard,
    clearSelection,
    setHoveredTargetTeamId,
    isTeamValidDropTarget,
  };
}


