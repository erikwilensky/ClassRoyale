import express from "express";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Store reference to active QuizRoom instance (set from server/index.js)
let quizRoomInstance = null;

export function setDebugInstance(room) {
  quizRoomInstance = room;
}

function ensureRoomAvailable(res) {
  if (!quizRoomInstance) {
    res.status(503).json({ error: "Game room not available" });
    return false;
  }
  return true;
}

function ensureTeacher(req, res) {
  if (!req.isTeacher) {
    res.status(403).json({ error: "Only teachers can access debug endpoints" });
    return false;
  }
  return true;
}

/**
 * GET /api/debug/quizroom-snapshot
 * Returns a sanitized snapshot of the current quiz room state for debugging.
 * Teacher-only, read-only, no persistence.
 */
router.get("/quizroom-snapshot", authenticateToken, (req, res) => {
  try {
    if (!ensureTeacher(req, res)) return;
    if (!ensureRoomAvailable(res)) return;

    const room = quizRoomInstance;

    // Build sanitized snapshot
    const snapshot = {
      round: {
        roundState: room.state?.roundState || "ROUND_WAITING",
        roundNumber: room.scores?.roundNumber || 0,
        questionText: room.state?.questionText || "",
        timerEnabled: room.state?.timerEnabled || false,
        timeRemaining: room.state?.timeRemaining || 0
      },
      teams: [],
      moderation: {
        mutedPlayers: [],
        frozenTeams: [],
        roundFrozen: false
      },
      cardRules: {
        disabledCards: [],
        goldCostModifiers: {}
      },
      effects: {
        activeEffectsCount: 0,
        summary: []
      },
      match: {
        matchOver: room.scores?.matchOver || false,
        scores: {}
      }
    };

    // Extract teams (sanitized - no session IDs, only playerIds)
    if (room.state?.teams) {
      room.state.teams.forEach((team, teamId) => {
        snapshot.teams.push({
          teamId: teamId,
          name: team.name || teamId,
          gold: team.gold || 0,
          writerPlayerId: team.writerPlayerId || null,
          suggesterPlayerIds: Array.isArray(team.suggesterPlayerIds) 
            ? Array.from(team.suggesterPlayerIds) 
            : [],
          hasAnswer: !!(team.answer && team.answer.trim().length > 0),
          answerLength: team.answer ? team.answer.length : 0,
          locked: team.locked || false
        });
      });
    }

    // Extract moderation state
    if (room.moderationState) {
      snapshot.moderation.mutedPlayers = Array.from(room.moderationState.mutedPlayers || []);
      snapshot.moderation.frozenTeams = Array.from(room.moderationState.frozenTeams || []);
      snapshot.moderation.roundFrozen = room.moderationState.roundFrozen || false;
    }

    // Extract card rules
    if (room.cardSystem) {
      const rules = room.cardSystem.getRules();
      snapshot.cardRules.disabledCards = rules.disabledCards || [];
      snapshot.cardRules.goldCostModifiers = rules.goldCostModifiers || {};
    }

    // Extract effects summary (no timestamps, no private data)
    if (room.state?.activeEffects) {
      snapshot.effects.activeEffectsCount = room.state.activeEffects.size || 0;
      room.state.activeEffects.forEach((effect, targetTeamId) => {
        snapshot.effects.summary.push({
          cardId: effect.cardId || "unknown",
          casterTeamId: effect.casterTeamId || "unknown",
          targetTeamId: targetTeamId
        });
      });
    }

    // Extract match scores (summary only)
    if (room.scores?.matchScores) {
      room.scores.matchScores.forEach((score, teamId) => {
        snapshot.match.scores[teamId] = score;
      });
    }

    res.json(snapshot);
  } catch (error) {
    console.error("[debug] Error generating snapshot:", error);
    res.status(500).json({ error: "Failed to generate snapshot" });
  }
});

export default router;

