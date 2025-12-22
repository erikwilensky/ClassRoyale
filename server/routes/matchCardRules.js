import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getAllCards, getCardById } from "../config/cards.js";

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

export default router;


