/**
 * Normalized state shape for QuizRoom client state.
 * This is the single source of truth for all room-related state.
 */

/**
 * Initial quiz state with all default values.
 * @type {Object}
 */
export const initialQuizState = {
  connection: {
    status: "connecting", // "connecting" | "connected" | "error"
    roomId: null,
    role: null // "teacher" | "student" | "display"
  },
  round: {
    roundState: "ROUND_WAITING", // "ROUND_WAITING" | "ROUND_ACTIVE" | "ROUND_REVIEW" | "ROUND_ENDED"
    roundNumber: 0,
    questionText: "",
    timerEnabled: false,
    timeRemaining: 0
  },
  teams: {}, // { [teamId: string]: TeamData }
  scoring: {
    roundResult: null, // { roundNumber, scores, winner, ... }
    matchResult: null, // { winner, finalScores, mvp, ... }
    matchOver: false,
    matchScores: {} // { [teamId: string]: number }
  },
  cardRules: {
    disabledCards: [], // string[]
    goldCostModifiers: {} // { [cardId: string]: number }
  },
  moderation: {
    mutedPlayers: [], // string[] (playerIds)
    frozenTeams: [], // string[] (teamIds)
    roundFrozen: false
  },
  effects: {
    activeEffects: [] // Array<{ cardId: string, casterTeamId: string, targetTeamId: string, timestamp: number }>
  }
};

/**
 * Team data structure.
 * @typedef {Object} TeamData
 * @property {string} name - Team name
 * @property {number} gold - Team gold amount
 * @property {string|null} writerPlayerId - Player ID of the writer
 * @property {string[]} suggesterPlayerIds - Array of suggester player IDs
 * @property {string} answer - Current team answer
 * @property {boolean} locked - Whether answer is locked
 * @property {Array<string|null>} deckSlots - Chapter 16: Array of 4 card IDs or null
 * @property {boolean} deckLocked - Chapter 16: Whether deck editing is locked
 * @property {string[]} teamCardPool - Chapter 16: Union of all team members' unlocked cards
 * @property {string} writer - Session ID of writer (for backward compatibility)
 * @property {string[]} suggesters - Session IDs of suggesters (for backward compatibility)
 * @property {Array} suggestions - Array of suggestion objects
 */


