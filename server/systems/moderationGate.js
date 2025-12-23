/**
 * Centralized moderation gate for consistent enforcement.
 * Provides defense-in-depth: even if UI forgets a disable check, server blocks it.
 * 
 * Chapter 13: Hardening - Single source of truth for moderation rules.
 */

/**
 * Checks if a player is muted.
 * 
 * @param {Object} room - QuizRoom instance
 * @param {string} playerId - Player ID to check
 * @returns {boolean} True if player is muted
 */
export function isPlayerMuted(room, playerId) {
    if (!room || !room.moderationState || !playerId) {
        return false;
    }
    return room.moderationState.mutedPlayers?.has(playerId) || false;
}

/**
 * Checks if a team is frozen.
 * 
 * @param {Object} room - QuizRoom instance
 * @param {string} teamId - Team ID to check
 * @returns {boolean} True if team is frozen
 */
export function isTeamFrozen(room, teamId) {
    if (!room || !room.moderationState || !teamId) {
        return false;
    }
    return room.moderationState.frozenTeams?.has(teamId) || false;
}

/**
 * Checks if the round is frozen globally.
 * 
 * @param {Object} room - QuizRoom instance
 * @returns {boolean} True if round is frozen
 */
export function isRoundFrozen(room) {
    if (!room || !room.moderationState) {
        return false;
    }
    return room.moderationState.roundFrozen || false;
}

/**
 * Main gate function: checks if an action can be performed based on moderation state.
 * 
 * Rules (matching Chapter 12):
 * - Muted blocks: suggestion, insertSuggestion, updateAnswer, lockAnswer, castCard
 * - Frozen team blocks: updateAnswer, lockAnswer, castCard
 * - Round frozen blocks: all above actions + pauses timer
 * 
 * @param {Object} room - QuizRoom instance
 * @param {Object} context - Action context
 * @param {string} context.playerId - Player ID performing the action
 * @param {string} context.teamId - Team ID (required for team-scoped actions)
 * @param {string} context.action - Action type: "updateAnswer", "lockAnswer", "suggestion", "insertSuggestion", "castCard"
 * @returns {{ ok: boolean, reason?: string }} Result object
 */
export function canPerformAction(room, { playerId, teamId, action }) {
    // Validate inputs
    if (!room || !action) {
        return { ok: false };
    }

    // Check round frozen first (blocks everything)
    if (isRoundFrozen(room)) {
        return { ok: false }; // Silent failure - no reason
    }

    // Actions that require teamId
    const teamScopedActions = ["updateAnswer", "lockAnswer", "castCard"];
    if (teamScopedActions.includes(action) && !teamId) {
        return { ok: false };
    }

    // Check muted player (blocks all student actions)
    if (playerId && isPlayerMuted(room, playerId)) {
        // Muted blocks: suggestion, insertSuggestion, updateAnswer, lockAnswer, castCard
        const mutedBlockedActions = ["suggestion", "insertSuggestion", "updateAnswer", "lockAnswer", "castCard"];
        if (mutedBlockedActions.includes(action)) {
            return { ok: false }; // Silent failure
        }
    }

    // Check frozen team (blocks team-scoped actions)
    if (teamId && isTeamFrozen(room, teamId)) {
        // Frozen team blocks: updateAnswer, lockAnswer, castCard
        const frozenTeamBlockedActions = ["updateAnswer", "lockAnswer", "castCard"];
        if (frozenTeamBlockedActions.includes(action)) {
            return { ok: false }; // Silent failure
        }
    }

    // All checks passed
    return { ok: true };
}

