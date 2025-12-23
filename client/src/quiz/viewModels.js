/**
 * View model selectors - pure functions that derive UI-ready values from state.
 * These functions compute presentation logic without JSX.
 */

/**
 * Derives round view model from state.
 * 
 * @param {Object} state - Quiz state
 * @returns {Object} Round view model
 */
export function deriveRoundViewModel(state) {
  const roundState = state.round?.roundState || "ROUND_WAITING";
  const roundNumber = state.round?.roundNumber || 0;
  const questionText = state.round?.questionText || "";
  const timeRemaining = state.round?.timeRemaining || 0;
  const timerEnabled = state.round?.timerEnabled || false;

  const isWaiting = roundState === "ROUND_WAITING";
  const isActive = roundState === "ROUND_ACTIVE";
  const isReview = roundState === "ROUND_REVIEW";
  const isEnded = roundState === "ROUND_ENDED";

  let phaseLabel = "Waiting";
  let statusMessage = "Waiting for teacher to start round...";

  if (isActive) {
    phaseLabel = "Active";
    statusMessage = questionText || "Round in progress...";
  } else if (isReview) {
    phaseLabel = "Review";
    statusMessage = "Round ended. Waiting for scoring...";
  } else if (isEnded) {
    phaseLabel = "Ended";
    statusMessage = "Round completed.";
  }

  const showTimer = isActive && timerEnabled;
  const timerText = formatTime(timeRemaining);

  return {
    phaseLabel,
    statusMessage,
    isActive,
    isWaiting,
    isReview,
    isEnded,
    showTimer,
    timerText,
    roundNumber,
    questionText
  };
}

/**
 * Derives student capabilities from state and player context.
 * 
 * @param {Object} state - Quiz state
 * @param {Object} context - Player context
 * @param {string} context.playerId - Player ID
 * @param {string} context.teamId - Team ID
 * @param {boolean} context.isWriter - Whether player is writer
 * @param {string} context.teamAnswer - Current team answer
 * @returns {Object} Capability flags
 */
export function deriveStudentCapabilities(state, { playerId, teamId, isWriter, teamAnswer = "" }) {
  const roundState = state.round?.roundState || "ROUND_WAITING";
  const isRoundActive = roundState === "ROUND_ACTIVE";

  const moderation = state.moderation || {};
  const isMuted = playerId && moderation.mutedPlayers?.includes(playerId);
  const isTeamFrozen = teamId && moderation.frozenTeams?.includes(teamId);
  const isRoundFrozen = moderation.roundFrozen || false;

  // Base capability: round must be active and not frozen
  const baseCapable = isRoundActive && !isRoundFrozen;

  // Can write answer: base + is writer + not muted + team not frozen
  const canWriteAnswer = baseCapable && isWriter && !isMuted && !isTeamFrozen;

  // Can lock answer: can write + answer not empty
  const canLockAnswer = canWriteAnswer && teamAnswer.trim().length > 0;

  // Can suggest: base + not muted + team not frozen (suggester role)
  const canSuggest = baseCapable && !isMuted && !isTeamFrozen;

  // Can insert suggestion: can suggest + is writer
  const canInsertSuggestion = canSuggest && isWriter;

  // Can cast cards: base + not muted + team not frozen
  const canCastCards = baseCapable && !isMuted && !isTeamFrozen;

  return {
    canWriteAnswer,
    canLockAnswer,
    canSuggest,
    canInsertSuggestion,
    canCastCards
  };
}

/**
 * Derives display view model from state.
 * 
 * @param {Object} state - Quiz state
 * @returns {Object} Display view model
 */
export function deriveDisplayViewModel(state) {
  const round = state.round || {};
  const roundState = round.roundState || "ROUND_WAITING";
  const roundNumber = round.roundNumber || 0;
  const questionText = round.questionText || "";
  const moderation = state.moderation || {};

  const isPaused = moderation.roundFrozen || false;
  const frozenTeams = moderation.frozenTeams || [];

  let headline = `Round ${roundNumber}`;
  if (roundState === "ROUND_WAITING") {
    headline += " - Waiting";
  } else if (roundState === "ROUND_ACTIVE") {
    headline += " - Active";
  } else if (roundState === "ROUND_REVIEW") {
    headline += " - Review";
  } else if (roundState === "ROUND_ENDED") {
    headline += " - Ended";
  }

  let subhead = "";
  if (questionText) {
    subhead = `Question: ${questionText}`;
  } else {
    subhead = "Waiting for question...";
  }

  return {
    headline,
    subhead,
    isPaused,
    frozenTeams,
    roundState,
    roundNumber,
    questionText
  };
}

/**
 * Applies gold cost modifier to base cost.
 * Matches server logic: Math.ceil(baseCost * multiplier), minimum 1.
 * 
 * @param {number} baseCost - Base card cost
 * @param {number} multiplier - Cost multiplier (0.5-2.0)
 * @returns {number} Adjusted cost (minimum 1)
 */
export function applyGoldCostModifier(baseCost, multiplier) {
  if (baseCost <= 0) {
    return 1; // Minimum cost is 1
  }
  const adjusted = Math.ceil(baseCost * multiplier);
  return Math.max(1, adjusted); // Ensure minimum of 1
}

/**
 * Formats time in seconds to MM:SS string.
 * 
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}


