// Chapter 14: Pure drag rules for student card casting
// These helpers are UI-only and contain no React or side effects.

import { applyGoldCostModifier } from "../../quiz/viewModels.js";

/**
 * Compute the effective gold cost for a card given match modifiers.
 * - Standard cards: ceil(baseCost * modifier), minimum 1.
 * - Cosmetic cards: 0.
 */
export function getEffectiveGoldCost({ card, goldCostModifiers = {} }) {
  if (!card) return 0;

  if (card.type === "cosmetic") {
    return 0;
  }

  const baseCost = typeof card.cost === "number" ? card.cost : 0;
  const modifier =
    typeof goldCostModifiers[card.id] === "number"
      ? goldCostModifiers[card.id]
      : 1.0;

  return applyGoldCostModifier(baseCost, modifier);
}

/**
 * Get valid drop target team IDs for a card.
 *
 * - target: "self"     → [myTeamId]
 * - target: "opponent" → all teamIds except myTeamId
 */
export function getValidDropTargets({ card, myTeamId, teamIds }) {
  if (!card || !card.target || !myTeamId || !Array.isArray(teamIds)) {
    return [];
  }

  if (card.target === "self") {
    return [myTeamId];
  }

  if (card.target === "opponent") {
    return teamIds.filter((id) => id && id !== myTeamId);
  }

  return [];
}

/**
 * Determine whether a drag can start for a given card and context.
 *
 * This is a *pre-check* only. The server remains authoritative.
 */
export function canStartDrag({
  card,
  capabilities,
  isOwned,
  isDisabled,
  effectiveGoldCost,
  teamGold,
  roundState,
  matchOver,
}) {
  if (!card) return false;

  // Basic gating from capabilities
  if (!capabilities || !capabilities.canCastCards) {
    return false;
  }

  // Match must not be over
  if (matchOver) {
    return false;
  }

  // Round must be active (or whatever state is treated as castable)
  if (roundState !== "ROUND_ACTIVE") {
    return false;
  }

  // Card availability
  if (!isOwned) return false;
  if (isDisabled) return false;

  // Gold requirement for standard cards
  if (card.type !== "cosmetic") {
    if (typeof effectiveGoldCost !== "number" || effectiveGoldCost < 0) {
      return false;
    }
    if (typeof teamGold !== "number" || teamGold < effectiveGoldCost) {
      return false;
    }
  }

  return true;
}


