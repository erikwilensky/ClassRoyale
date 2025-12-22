/**
 * AI Scoring Service
 * External scoring only - scores are submitted by teacher
 * This file is kept for future LLM integration hooks if needed
 */

/**
 * Score an answer (STUB - External scoring only)
 * @param {string} answerText - The answer text to score
 * @param {string} questionText - Optional question text for context
 * @returns {null} Always returns null - scoring is done externally by teacher
 * @deprecated Internal scoring removed. Use external scoring via /api/score/submit
 */
export async function scoreAnswer(answerText, questionText = null) {
  // Internal scoring removed - all scores must be submitted by teacher via /api/score/submit
  return null;
}

