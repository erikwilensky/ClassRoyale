// Chapter 12: Teacher moderation controls for classroom safety
// Ephemeral moderation state (no persistence)

import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { logDebug } from "../utils/log.js";

const router = express.Router();

// Store reference to active QuizRoom instance (set from server/index.js)
let quizRoomInstance = null;

export function setModerationInstance(room) {
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
    res.status(403).json({ error: "Only teachers can use moderation controls" });
    return false;
  }
  return true;
}

function ensureMatchActive(res) {
  if (quizRoomInstance?.scores?.matchOver) {
    res.status(400).json({ error: "Cannot modify moderation state after match has ended" });
    return false;
  }
  return true;
}

// GET /api/match/moderation/status - Get current moderation state
router.get("/status", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;

    if (!quizRoomInstance.moderationState) {
      return res.json({
        mutedPlayers: [],
        frozenTeams: [],
        roundFrozen: false
      });
    }

    res.json({
      mutedPlayers: Array.from(quizRoomInstance.moderationState.mutedPlayers || []),
      frozenTeams: Array.from(quizRoomInstance.moderationState.frozenTeams || []),
      roundFrozen: quizRoomInstance.moderationState.roundFrozen || false
    });
  } catch (error) {
    console.error("[Moderation] GET /status error:", error);
    res.status(500).json({ error: "Failed to get moderation state" });
  }
});

// POST /api/match/moderation/mute - Mute a player
router.post("/mute", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;
    if (!ensureMatchActive(res)) return;

    const { playerId } = req.body || {};
    if (!playerId) {
      return res.status(400).json({ error: "playerId is required" });
    }

    if (!quizRoomInstance.moderationState) {
      return res.status(503).json({ error: "Moderation system not available" });
    }

    quizRoomInstance.moderationState.mutedPlayers.add(playerId);
    quizRoomInstance.broadcastModerationUpdate();

    logDebug(`[Moderation] Muted player: playerId=${playerId}`);

    res.json({
      success: true,
      mutedPlayers: Array.from(quizRoomInstance.moderationState.mutedPlayers)
    });
  } catch (error) {
    console.error("[Moderation] POST /mute error:", error);
    res.status(500).json({ error: "Failed to mute player" });
  }
});

// POST /api/match/moderation/unmute - Unmute a player
router.post("/unmute", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;
    if (!ensureMatchActive(res)) return;

    const { playerId } = req.body || {};
    if (!playerId) {
      return res.status(400).json({ error: "playerId is required" });
    }

    if (!quizRoomInstance.moderationState) {
      return res.status(503).json({ error: "Moderation system not available" });
    }

    quizRoomInstance.moderationState.mutedPlayers.delete(playerId);
    quizRoomInstance.broadcastModerationUpdate();

    logDebug(`[Moderation] Unmuted player: playerId=${playerId}`);

    res.json({
      success: true,
      mutedPlayers: Array.from(quizRoomInstance.moderationState.mutedPlayers)
    });
  } catch (error) {
    console.error("[Moderation] POST /unmute error:", error);
    res.status(500).json({ error: "Failed to unmute player" });
  }
});

// POST /api/match/moderation/freeze-team - Freeze a team
router.post("/freeze-team", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;
    if (!ensureMatchActive(res)) return;

    const { teamId } = req.body || {};
    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    if (!quizRoomInstance.moderationState) {
      return res.status(503).json({ error: "Moderation system not available" });
    }

    // Verify team exists
    if (!quizRoomInstance.state.teams.has(teamId)) {
      return res.status(400).json({ error: "Team not found" });
    }

    quizRoomInstance.moderationState.frozenTeams.add(teamId);
    quizRoomInstance.broadcastModerationUpdate();

    logDebug(`[Moderation] Froze team: teamId=${teamId}`);

    res.json({
      success: true,
      frozenTeams: Array.from(quizRoomInstance.moderationState.frozenTeams)
    });
  } catch (error) {
    console.error("[Moderation] POST /freeze-team error:", error);
    res.status(500).json({ error: "Failed to freeze team" });
  }
});

// POST /api/match/moderation/unfreeze-team - Unfreeze a team
router.post("/unfreeze-team", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;
    if (!ensureMatchActive(res)) return;

    const { teamId } = req.body || {};
    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    if (!quizRoomInstance.moderationState) {
      return res.status(503).json({ error: "Moderation system not available" });
    }

    quizRoomInstance.moderationState.frozenTeams.delete(teamId);
    quizRoomInstance.broadcastModerationUpdate();

    logDebug(`[Moderation] Unfroze team: teamId=${teamId}`);

    res.json({
      success: true,
      frozenTeams: Array.from(quizRoomInstance.moderationState.frozenTeams)
    });
  } catch (error) {
    console.error("[Moderation] POST /unfreeze-team error:", error);
    res.status(500).json({ error: "Failed to unfreeze team" });
  }
});

// POST /api/match/moderation/freeze-round - Freeze the entire round
router.post("/freeze-round", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;
    if (!ensureMatchActive(res)) return;

    if (!quizRoomInstance.moderationState) {
      return res.status(503).json({ error: "Moderation system not available" });
    }

    quizRoomInstance.moderationState.roundFrozen = true;
    quizRoomInstance.broadcastModerationUpdate();

    logDebug(`[Moderation] Froze round`);

    res.json({
      success: true,
      roundFrozen: true
    });
  } catch (error) {
    console.error("[Moderation] POST /freeze-round error:", error);
    res.status(500).json({ error: "Failed to freeze round" });
  }
});

// POST /api/match/moderation/resume-round - Resume the round
router.post("/resume-round", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;
    if (!ensureMatchActive(res)) return;

    if (!quizRoomInstance.moderationState) {
      return res.status(503).json({ error: "Moderation system not available" });
    }

    quizRoomInstance.moderationState.roundFrozen = false;
    quizRoomInstance.broadcastModerationUpdate();

    logDebug(`[Moderation] Resumed round`);

    res.json({
      success: true,
      roundFrozen: false
    });
  } catch (error) {
    console.error("[Moderation] POST /resume-round error:", error);
    res.status(500).json({ error: "Failed to resume round" });
  }
});

// POST /api/match/moderation/reset - Reset all moderation state
router.post("/reset", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;
    // Reset allowed even after match ends (for cleanup)

    if (!quizRoomInstance.moderationState) {
      return res.status(503).json({ error: "Moderation system not available" });
    }

    quizRoomInstance.resetModerationState();

    res.json({
      success: true,
      message: "Moderation state reset"
    });
  } catch (error) {
    console.error("[Moderation] POST /reset error:", error);
    res.status(500).json({ error: "Failed to reset moderation state" });
  }
});

export default router;


