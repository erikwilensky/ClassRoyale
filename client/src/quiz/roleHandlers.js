/**
 * Role-specific message handler configuration.
 * Defines which message types each role should register to reduce "onMessage not registered" warnings.
 */

import { MSG } from "./messageTypes.js";

/**
 * Core messages that all roles need for basic functionality.
 */
const CORE_MESSAGES = [
  MSG.ROUND_STATE_UPDATE,
  MSG.QUESTION_UPDATE,
  MSG.TIMER_UPDATE,
  MSG.TEAM_UPDATE,
  MSG.GOLD_UPDATE,
  MSG.ERROR
];

/**
 * Scoring/match lifecycle messages.
 */
const SCORING_MESSAGES = [
  MSG.ROUND_SCORE,
  MSG.MATCH_OVER,
  MSG.MATCH_RESET,
  MSG.ROUND_STARTED,
  MSG.ROUND_ENDED
];

/**
 * Card and effect messages.
 */
const CARD_MESSAGES = [
  MSG.CARD_CAST,
  MSG.CARD_RULES_UPDATE
];

/**
 * Moderation messages.
 */
const MODERATION_MESSAGES = [
  MSG.MODERATION_UPDATE
];

/**
 * System/room messages.
 */
const SYSTEM_MESSAGES = [
  MSG.ROOM_ID
];

/**
 * Team assembly messages.
 */
const TEAM_ASSEMBLY_MESSAGES = [
  MSG.TEAM_JOINED,
  MSG.TEAM_LEFT,
  MSG.AVAILABLE_TEAMS,
  MSG.TEAM_SETTINGS_UPDATE
];

/**
 * Student-specific messages.
 */
const STUDENT_MESSAGES = [
  MSG.SUGGESTION,
  MSG.ANSWER_UPDATE,
  MSG.LOCK,
  MSG.WRITER_ROTATED,
  MSG.WRITER_TRANSFERRED,
  MSG.ROUND_DATA,
  MSG.XP_EARNED
];

/**
 * Additional scoring detail messages (used by students and teachers).
 */
const SCORING_DETAIL_MESSAGES = [
  MSG.TEAM_SCORE_UPDATE,
  MSG.PLAYER_SCORE_UPDATE,
  MSG.ROUND_SCORE_UPDATE
];

/**
 * Lobby messages.
 */
const LOBBY_MESSAGES = [
  MSG.MATCH_START,
  MSG.LOBBY_UPDATE
];

/**
 * Gets the message types that should be registered for a given role.
 * 
 * @param {string} role - Role: "teacher", "student", or "display"
 * @returns {string[]} Array of message type strings to register
 */
export function getRoleMessageTypes(role) {
  const messages = new Set();

  // All roles get core messages
  CORE_MESSAGES.forEach(msg => messages.add(msg));

  // All roles get scoring messages
  SCORING_MESSAGES.forEach(msg => messages.add(msg));

  // All roles get card messages (display needs to show card effects)
  CARD_MESSAGES.forEach(msg => messages.add(msg));

  // All roles get moderation messages (display needs to show pause/freeze indicators)
  MODERATION_MESSAGES.forEach(msg => messages.add(msg));

  // Teacher and display get system messages (ROOM_ID)
  if (role === "teacher" || role === "display") {
    SYSTEM_MESSAGES.forEach(msg => messages.add(msg));
  }

  // Teacher and student get team assembly messages
  if (role === "teacher" || role === "student") {
    TEAM_ASSEMBLY_MESSAGES.forEach(msg => messages.add(msg));
  }

  // Student gets student-specific messages
  if (role === "student") {
    STUDENT_MESSAGES.forEach(msg => messages.add(msg));
  }

  // Teacher and student get scoring detail messages
  if (role === "teacher" || role === "student") {
    SCORING_DETAIL_MESSAGES.forEach(msg => messages.add(msg));
  }

  // Teacher gets lobby messages (for lobby page)
  if (role === "teacher") {
    LOBBY_MESSAGES.forEach(msg => messages.add(msg));
  }

  return Array.from(messages);
}

