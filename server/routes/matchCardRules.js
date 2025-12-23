import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getAllCards, getCardById } from "../config/cards.js";
import { getTeacherDefaultSettings, saveTeacherDefaultSettings, deleteTeacherDefaultSettings } from "../services/teacherCardSettings.js";
import { logDebug } from "../utils/log.js";

const router = express.Router();

// Store reference to active QuizRoom instance (set from server/index.js)
let quizRoomInstance = null;

export function setMatchCardRulesInstance(room) {
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
    res.status(403).json({ error: "Only teachers can modify match card rules" });
    return false;
  }
  return true;
}

function ensureMatchActive(res) {
  if (quizRoomInstance?.scores?.matchOver) {
    res.status(400).json({ error: "Cannot modify card rules after match has ended" });
    return false;
  }
  return true;
}

// Chapter 11.5: Get card rules from cardSystem
function getMatchCardRules() {
  if (!quizRoomInstance || !quizRoomInstance.cardSystem) {
    return null;
  }
  return quizRoomInstance.cardSystem.getRules();
}

// GET /api/match/cards - full card list + current match rules
router.get("/cards", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;

    const rules = getMatchCardRules();
    if (!rules) {
      return res.status(503).json({ error: "Card system not available" });
    }
    const allCards = getAllCards();

    res.json({
      cards: allCards,
      disabledCards: rules.disabledCards || [],
      goldCostModifiers: rules.goldCostModifiers || {}
    });
  } catch (error) {
    console.error("[MatchCardRules] GET /cards error:", error);
    res.status(500).json({ error: "Failed to get match card rules" });
  }
});

// POST /api/match/cards/disable { cardId }
router.post("/cards/disable", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;
    if (!ensureMatchActive(res)) return;

    const { cardId } = req.body || {};
    if (!cardId) {
      return res.status(400).json({ error: "cardId is required" });
    }

    const card = getCardById(cardId);
    if (!card) {
      return res.status(400).json({ error: "Invalid cardId" });
    }

    if (!quizRoomInstance || !quizRoomInstance.cardSystem) {
      return res.status(503).json({ error: "Card system not available" });
    }

    try {
      quizRoomInstance.cardSystem.disableCard(cardId);
      const rules = quizRoomInstance.cardSystem.getRules();
      logDebug(`[MatchCardRules] Card rules updated: disabledCards=${rules.disabledCards.length}, modifiers=${Object.keys(rules.goldCostModifiers).length}`);
      res.json({ success: true, disabledCards: rules.disabledCards });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } catch (error) {
    console.error("[MatchCardRules] POST /cards/disable error:", error);
    res.status(500).json({ error: "Failed to disable card" });
  }
});

// POST /api/match/cards/enable { cardId }
router.post("/cards/enable", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;
    if (!ensureMatchActive(res)) return;

    const { cardId } = req.body || {};
    if (!cardId) {
      return res.status(400).json({ error: "cardId is required" });
    }

    const card = getCardById(cardId);
    if (!card) {
      return res.status(400).json({ error: "Invalid cardId" });
    }

    if (!quizRoomInstance || !quizRoomInstance.cardSystem) {
      return res.status(503).json({ error: "Card system not available" });
    }

    try {
      quizRoomInstance.cardSystem.enableCard(cardId);
      const rules = quizRoomInstance.cardSystem.getRules();
      logDebug(`[MatchCardRules] Card rules updated: disabledCards=${rules.disabledCards.length}, modifiers=${Object.keys(rules.goldCostModifiers).length}`);
      res.json({ success: true, disabledCards: rules.disabledCards });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } catch (error) {
    console.error("[MatchCardRules] POST /cards/enable error:", error);
    res.status(500).json({ error: "Failed to enable card" });
  }
});

// POST /api/match/cards/modify { cardId, multiplier }
router.post("/cards/modify", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;
    if (!ensureMatchActive(res)) return;

    const { cardId, multiplier } = req.body || {};
    if (!cardId || multiplier === undefined) {
      return res.status(400).json({ error: "cardId and multiplier are required" });
    }

    let m = Number(multiplier);
    if (Number.isNaN(m)) {
      return res.status(400).json({ error: "multiplier must be a number" });
    }

    // Clamp to [0.5, 2.0]
    m = Math.min(2.0, Math.max(0.5, m));

    const card = getCardById(cardId);
    if (!card) {
      return res.status(400).json({ error: "Invalid cardId" });
    }
    if (card.type !== "standard") {
      return res.status(400).json({ error: "Only standard cards can have gold cost modifiers" });
    }

    if (!quizRoomInstance || !quizRoomInstance.cardSystem) {
      return res.status(503).json({ error: "Card system not available" });
    }

    try {
      quizRoomInstance.cardSystem.setCostModifier(cardId, m);
      const rules = quizRoomInstance.cardSystem.getRules();
      logDebug(`[MatchCardRules] Card rules updated: disabledCards=${rules.disabledCards.length}, modifiers=${Object.keys(rules.goldCostModifiers).length}`);
      res.json({ success: true, goldCostModifiers: rules.goldCostModifiers });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } catch (error) {
    console.error("[MatchCardRules] POST /cards/modify error:", error);
    res.status(500).json({ error: "Failed to modify card cost" });
  }
});

// POST /api/match/cards/reset
router.post("/cards/reset", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;
    if (!ensureMatchActive(res)) return;

    if (!quizRoomInstance || !quizRoomInstance.cardSystem) {
      return res.status(503).json({ error: "Card system not available" });
    }

    quizRoomInstance.cardSystem.resetRules();
    res.json({ success: true });
  } catch (error) {
    console.error("[MatchCardRules] POST /cards/reset error:", error);
    res.status(500).json({ error: "Failed to reset card rules" });
  }
});

// GET /api/match/cards/defaults - Get teacher's default card settings
router.get("/cards/defaults", authenticateToken, (req, res) => {
  try {
    if (!ensureTeacher(req, res)) return;

    const defaults = getTeacherDefaultSettings(req.playerId);
    if (!defaults) {
      return res.json({ 
        hasDefaults: false, 
        disabledCards: [], 
        goldCostModifiers: {} 
      });
    }

    res.json({
      hasDefaults: true,
      disabledCards: defaults.disabledCards,
      goldCostModifiers: defaults.goldCostModifiers
    });
  } catch (error) {
    console.error("[MatchCardRules] GET /cards/defaults error:", error);
    res.status(500).json({ error: "Failed to get default card settings" });
  }
});

// POST /api/match/cards/defaults - Save current match settings as default
router.post("/cards/defaults", authenticateToken, (req, res) => {
  try {
    if (!ensureTeacher(req, res)) return;

    if (!quizRoomInstance || !quizRoomInstance.cardSystem) {
      return res.status(503).json({ error: "Card system not available" });
    }

    const rules = quizRoomInstance.cardSystem.getRules();
    const disabledCards = Array.from(rules.disabledCards || []);
    const goldCostModifiers = rules.goldCostModifiers || {};

    const success = saveTeacherDefaultSettings(
      req.playerId,
      disabledCards,
      goldCostModifiers
    );

    if (success) {
      res.json({ success: true, message: "Default settings saved" });
    } else {
      res.status(500).json({ error: "Failed to save default settings" });
    }
  } catch (error) {
    console.error("[MatchCardRules] POST /cards/defaults error:", error);
    res.status(500).json({ error: "Failed to save default card settings" });
  }
});

// DELETE /api/match/cards/defaults - Delete teacher's default settings
router.delete("/cards/defaults", authenticateToken, (req, res) => {
  try {
    if (!ensureTeacher(req, res)) return;

    const success = deleteTeacherDefaultSettings(req.playerId);
    if (success) {
      res.json({ success: true, message: "Default settings deleted" });
    } else {
      res.status(500).json({ error: "Failed to delete default settings" });
    }
  } catch (error) {
    console.error("[MatchCardRules] DELETE /cards/defaults error:", error);
    res.status(500).json({ error: "Failed to delete default card settings" });
  }
});

// POST /api/match/cards/load-defaults - Load and apply teacher's default settings to current match
// Note: This is allowed even when match is over (preparing for next match)
router.post("/cards/load-defaults", authenticateToken, (req, res) => {
  try {
    if (!ensureRoomAvailable(res)) return;
    if (!ensureTeacher(req, res)) return;
    // Don't check ensureMatchActive - allow loading defaults even after match ends

    if (!quizRoomInstance || !quizRoomInstance.cardSystem) {
      return res.status(503).json({ error: "Card system not available" });
    }

    const defaults = getTeacherDefaultSettings(req.playerId);
    if (!defaults || (defaults.disabledCards.length === 0 && Object.keys(defaults.goldCostModifiers).length === 0)) {
      return res.status(404).json({ error: "No default settings found" });
    }

    // Apply default settings to current match
    // First, reset current rules
    quizRoomInstance.cardSystem.resetRules();

    // Then apply defaults
    for (const cardId of defaults.disabledCards) {
      try {
        quizRoomInstance.cardSystem.disableCard(cardId);
      } catch (error) {
        console.warn(`[MatchCardRules] Failed to disable card ${cardId}:`, error.message);
      }
    }

    for (const [cardId, multiplier] of Object.entries(defaults.goldCostModifiers)) {
      try {
        quizRoomInstance.cardSystem.setCostModifier(cardId, multiplier);
      } catch (error) {
        console.warn(`[MatchCardRules] Failed to set modifier for ${cardId}:`, error.message);
      }
    }

    // Broadcast the update
    quizRoomInstance.cardSystem.broadcastRulesUpdate();

    const rules = quizRoomInstance.cardSystem.getRules();
    logDebug(`[MatchCardRules] Card rules updated (load defaults): disabledCards=${rules.disabledCards.length}, modifiers=${Object.keys(rules.goldCostModifiers).length}`);
    res.json({ 
      success: true, 
      message: "Default settings loaded",
      disabledCards: Array.from(rules.disabledCards),
      goldCostModifiers: rules.goldCostModifiers
    });
  } catch (error) {
    console.error("[MatchCardRules] POST /cards/load-defaults error:", error);
    res.status(500).json({ error: "Failed to load default card settings" });
  }
});

export default router;


