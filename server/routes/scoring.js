import express from "express";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Store reference to QuizRoom instance
// This will be set by server/index.js
let quizRoomInstance = null;

export function setQuizRoomInstance(room) {
  quizRoomInstance = room;
}

/**
 * POST /api/score/override
 * Teacher override for evaluation scores
 */
router.post("/score/override", authenticateToken, (req, res) => {
  try {
    // Validate teacher role
    if (!req.isTeacher) {
      return res.status(403).json({ error: "Only teachers can override scores" });
    }

    const { teamId, playerId, round, newEvaluationScore } = req.body;

    // Validate input
    if (!teamId || round === undefined || newEvaluationScore === undefined) {
      return res.status(400).json({ error: "teamId, round, and newEvaluationScore are required" });
    }

    if (typeof newEvaluationScore !== 'number' || newEvaluationScore < 0 || newEvaluationScore > 10) {
      return res.status(400).json({ error: "newEvaluationScore must be a number between 0 and 10" });
    }

    if (!quizRoomInstance) {
      return res.status(503).json({ error: "Game room not available" });
    }

    // Check if match is over
    if (quizRoomInstance.scores && quizRoomInstance.scores.matchOver) {
      return res.status(400).json({ error: "Cannot override scores after match has ended" });
    }

    // Apply override
    const result = quizRoomInstance.applyOverride(teamId, playerId, round, newEvaluationScore);

    if (!result.success) {
      return res.status(400).json({ error: result.error || "Override failed" });
    }

    res.json({ 
      success: true, 
      message: "Score override applied",
      updatedScores: result.updatedScores
    });
  } catch (error) {
    console.error("[Score Override Error]:", error);
    res.status(500).json({ error: "Failed to override score" });
  }
});

/**
 * POST /api/score/submit
 * Teacher submits scores for a round (primary scoring endpoint)
 */
router.post("/score/submit", authenticateToken, (req, res) => {
  try {
    // Validate teacher role
    if (!req.isTeacher) {
      return res.status(403).json({ error: "Only teachers can submit scores" });
    }

    const { round, scores } = req.body;

    // Validate input
    if (round === undefined || !scores || typeof scores !== 'object') {
      return res.status(400).json({ error: "round and scores object are required" });
    }

    if (typeof round !== 'number' || round < 1) {
      return res.status(400).json({ error: "round must be a positive number" });
    }

    if (!quizRoomInstance) {
      return res.status(503).json({ error: "Game room not available" });
    }

    // Check if match is over
    if (quizRoomInstance.scores && quizRoomInstance.scores.matchOver) {
      return res.status(400).json({ error: "Cannot submit scores after match has ended" });
    }

    // Submit scores
    const result = quizRoomInstance.submitRoundScores(round, scores);

    if (!result.success) {
      return res.status(400).json({ error: result.error || "Score submission failed" });
    }

    res.json({ 
      success: true, 
      message: "Scores submitted successfully",
      roundWinner: result.roundWinner,
      matchWon: result.matchWon
    });
  } catch (error) {
    console.error("[Score Submit Error]:", error);
    res.status(500).json({ error: "Failed to submit scores" });
  }
});

/**
 * GET /api/score/match
 * Get current match scores
 */
router.get("/score/match", authenticateToken, (req, res) => {
  try {
    if (!quizRoomInstance) {
      return res.status(503).json({ error: "Game room not available" });
    }

    const scores = quizRoomInstance.scores;
    if (!scores) {
      return res.json({
        teams: {},
        perPlayer: {},
        roundNumber: 0,
        matchOver: false,
        winner: null
      });
    }

    // Convert Maps to plain objects for JSON
    const teamsObj = {};
    for (const [teamId, roundPoints] of scores.teams.entries()) {
      teamsObj[teamId] = roundPoints;
    }

    const perPlayerObj = {};
    for (const [playerId, data] of scores.perPlayer.entries()) {
      perPlayerObj[playerId] = {
        roundScores: data.roundScores || [],
        totalEvaluationScore: data.totalEvaluationScore || 0
      };
    }

    // Convert roundScores Map to object
    const roundScoresObj = {};
    if (scores.roundScores) {
      for (const [round, roundScores] of scores.roundScores.entries()) {
        roundScoresObj[round] = roundScores;
      }
    }

    res.json({
      teams: teamsObj,
      perPlayer: perPlayerObj,
      roundScores: roundScoresObj,
      roundNumber: scores.roundNumber || 0,
      matchOver: scores.matchOver || false,
      winner: scores.winner || null
    });
  } catch (error) {
    console.error("[Get Match Scores Error]:", error);
    res.status(500).json({ error: "Failed to get match scores" });
  }
});

export default router;

