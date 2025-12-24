import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { spendXP, getPlayerProgress } from "../services/xpService.js";
import { getAllCards, getCardById } from "../config/cards.js";
import { CARD_CATALOG_V1, CARD_CATALOG_V1_BY_ID, getLegacyIdFromCatalogId } from "../config/cards.catalog.v1.js";
import { getPlayerUnlockedCards } from "../services/xpService.js";
import { db } from "../db/database.js";

const router = express.Router();

// Store reference to active QuizRoom instance (for checking if player is in match)
// This will be set by server/index.js
let quizRoomInstance = null;

export function setShopQuizRoomInstance(room) {
    quizRoomInstance = room;
}

/**
 * GET /api/shop/cards
 * Returns all cards with unlock status for authenticated user
 * Card Catalog v1: Returns cards from catalog (50 cards) with backwards compatibility
 */
router.get("/cards", authenticateToken, (req, res) => {
    try {
        const playerId = req.playerId;
        
        // Get player's unlocked cards (may contain both legacy and catalog IDs)
        const unlockedCards = getPlayerUnlockedCards(playerId);
        const unlockedSet = new Set(unlockedCards);
        
        // Card Catalog v1: Use catalog cards, but check unlock status for both catalog and legacy IDs
        const cardsWithStatus = CARD_CATALOG_V1.map(card => {
            // Check if unlocked by catalog ID or legacy ID
            const legacyId = getLegacyIdFromCatalogId(card.id);
            const isUnlocked = unlockedSet.has(card.id) || (legacyId && unlockedSet.has(legacyId));
            
            // Format effect for display (catalog has effect object, legacy has string)
            let effectDisplay = card.effect;
            if (card.effect && typeof card.effect === 'object') {
                // Convert effect object to readable string
                const effectType = card.effect.type || '';
                const params = card.effect.params || card.effect;
                if (effectType === 'TIMER_ADD' && params.seconds) {
                    effectDisplay = `Add ${params.seconds} seconds to timer`;
                } else if (effectType === 'TIMER_SUBTRACT' && params.seconds) {
                    effectDisplay = `Subtract ${params.seconds} seconds from timer`;
                } else if (effectType === 'SUGGESTION_MUTE_RECEIVE' && params.durationSeconds) {
                    effectDisplay = `Block suggestions for ${params.durationSeconds} seconds`;
                } else if (effectType === 'SUGGESTION_DELAY' && params.delaySeconds) {
                    effectDisplay = `Delay suggestions by ${params.delaySeconds} seconds`;
                } else if (effectType === 'GOLD_GAIN' && params.amount) {
                    effectDisplay = `Gain ${params.amount} gold`;
                } else if (effectType === 'SHIELD_NEGATIVE_NEXT') {
                    effectDisplay = 'Block next negative card';
                } else if (effectType === 'WRITER_SWAP') {
                    effectDisplay = 'Swap writer with suggester';
                } else if (effectType === 'SCREEN_SHAKE' || effectType === 'SCREEN_BLUR' || effectType === 'SCREEN_DISTORT') {
                    effectDisplay = card.description; // Use description for screen effects
                } else if (effectType === 'COSMETIC') {
                    effectDisplay = card.description; // Use description for cosmetic
                } else if (effectType === 'MULTI') {
                    effectDisplay = 'Multiple effects';
                } else {
                    effectDisplay = card.description; // Fallback to description
                }
            }
            
            return {
                id: card.id,
                name: card.name,
                unlockCost: card.unlockXp, // Catalog uses unlockXp
                type: card.kind, // Catalog uses "kind" instead of "type"
                cost: card.baseGoldCost, // Catalog uses baseGoldCost
                target: card.target,
                effect: effectDisplay, // Formatted for display
                description: card.description,
                category: card.category,
                unlocked: isUnlocked,
                // Card Catalog v1: Include metadata and full effect object for advanced use
                meta: card.meta,
                limits: card.limits,
                effectData: card.effect // Full effect object for advanced clients
            };
        });
        
        res.json({ cards: cardsWithStatus });
    } catch (error) {
        console.error("[Shop] Error getting cards:", error);
        res.status(500).json({ error: "Failed to get cards" });
    }
});

/**
 * POST /api/shop/purchase
 * Purchase a card with XP
 * Validates: authentication, sufficient XP, card not already owned, not in active match
 */
router.post("/purchase", authenticateToken, async (req, res) => {
    try {
        const playerId = req.playerId;
        const { cardId } = req.body;
        
        if (!cardId) {
            return res.status(400).json({ error: "cardId is required" });
        }
        
        // Card Catalog v1: Check both catalog and legacy cards
        let card = CARD_CATALOG_V1_BY_ID[cardId]; // Try catalog first
        let legacyId = null;
        
        if (!card) {
            // Try legacy cards
            const legacyCard = getCardById(cardId);
            if (legacyCard) {
                // Convert legacy card to catalog format for consistency
                card = {
                    id: legacyCard.id,
                    name: legacyCard.name,
                    unlockXp: legacyCard.unlockCost,
                    kind: legacyCard.type,
                    baseGoldCost: legacyCard.cost,
                    target: legacyCard.target,
                    effect: legacyCard.effect,
                    description: legacyCard.description
                };
            }
        } else {
            // If catalog card, also check legacy ID for unlock status
            legacyId = getLegacyIdFromCatalogId(cardId);
        }
        
        if (!card) {
            return res.status(400).json({ error: "Invalid card ID" });
        }
        
        // Check if player already owns the card (check both catalog and legacy IDs)
        const unlockedCards = getPlayerUnlockedCards(playerId);
        if (unlockedCards.includes(cardId) || (legacyId && unlockedCards.includes(legacyId))) {
            return res.status(400).json({ error: "Card already owned" });
        }
        
        // Check if player is in an active match
        // Note: This is a simple check - in a production system, you'd want a more robust
        // way to track active matches per player (e.g., a matches table)
        if (quizRoomInstance) {
            // Check if player is connected to the room
            const playerClients = quizRoomInstance.clients.filter(c => 
                c.metadata && c.metadata.playerId === playerId && !c.metadata.isDisplay
            );
            if (playerClients.length > 0) {
                return res.status(400).json({ 
                    error: "Cannot purchase cards during an active match" 
                });
            }
        }
        
        // Check sufficient XP
        const playerProgress = getPlayerProgress(playerId);
        if (!playerProgress) {
            return res.status(404).json({ error: "Player not found" });
        }
        
        // Card Catalog v1: Use unlockXp from catalog, fall back to unlockCost for legacy
        const unlockCost = card.unlockXp || card.unlockCost;
        
        if (playerProgress.availableXP < unlockCost) {
            return res.status(400).json({ 
                error: "Insufficient XP",
                required: unlockCost,
                available: playerProgress.availableXP
            });
        }
        
        // Atomic operation: spend XP and create unlock record
        // Use database transaction for atomicity
        const spendResult = spendXP(playerId, unlockCost);
        if (!spendResult.success) {
            return res.status(400).json({ error: spendResult.error });
        }
        
        // Create unlock record
        // Card Catalog v1: Store catalog ID, but also create legacy unlock if needed for backwards compatibility
        try {
            db.prepare(
                "INSERT INTO unlocks (playerId, cardId, unlockMethod) VALUES (?, ?, 'purchase')"
            ).run(playerId, cardId);
            
            // If this is a catalog card with a legacy ID, also unlock the legacy version for backwards compatibility
            if (legacyId && !unlockedCards.includes(legacyId)) {
                try {
                    db.prepare(
                        "INSERT INTO unlocks (playerId, cardId, unlockMethod) VALUES (?, ?, 'purchase')"
                    ).run(playerId, legacyId);
                } catch (legacyError) {
                    // Ignore if legacy unlock already exists
                    if (!legacyError.message.includes("UNIQUE")) {
                        console.warn(`[Shop] Failed to create legacy unlock for ${legacyId}:`, legacyError);
                    }
                }
            }
        } catch (error) {
            // If insert fails (e.g., duplicate), refund XP
            // This shouldn't happen due to earlier check, but handle it anyway
            if (error.message.includes("UNIQUE constraint") || error.message.includes("UNIQUE")) {
                // Refund XP by adding it back to availableXP
                const currentAvailableXP = db.prepare("SELECT availableXP FROM players WHERE id = ?").get(playerId)?.availableXP || 0;
                db.prepare("UPDATE players SET availableXP = ? WHERE id = ?")
                    .run(currentAvailableXP + unlockCost, playerId);
                return res.status(400).json({ error: "Card already owned" });
            }
            // For other errors, also refund XP
            const currentAvailableXP = db.prepare("SELECT availableXP FROM players WHERE id = ?").get(playerId)?.availableXP || 0;
            db.prepare("UPDATE players SET availableXP = ? WHERE id = ?")
                .run(currentAvailableXP + unlockCost, playerId);
            throw error;
        }
        
        console.log(`[Shop] Player ${playerId} purchased card ${cardId} for ${unlockCost} XP`);
        
        res.json({
            success: true,
            newAvailableXP: spendResult.newAvailableXP,
            unlockedCard: {
                id: card.id,
                name: card.name,
                type: card.kind || card.type
            }
        });
    } catch (error) {
        console.error("[Shop] Error purchasing card:", error);
        res.status(500).json({ error: "Failed to purchase card" });
    }
});

/**
 * GET /api/shop/progress
 * Returns player's XP and owned cards
 */
router.get("/progress", authenticateToken, (req, res) => {
    try {
        const playerId = req.playerId;
        const progress = getPlayerProgress(playerId);
        
        if (!progress) {
            return res.status(404).json({ error: "Player not found" });
        }
        
        res.json(progress);
    } catch (error) {
        console.error("[Shop] Error getting player progress:", error);
        res.status(500).json({ error: "Failed to get player progress" });
    }
});

// Export a separate router for /api/player/progress endpoint
const playerRouter = express.Router();
playerRouter.get("/progress", authenticateToken, (req, res) => {
    try {
        const playerId = req.playerId;
        const progress = getPlayerProgress(playerId);
        
        if (!progress) {
            return res.status(404).json({ error: "Player not found" });
        }
        
        res.json(progress);
    } catch (error) {
        console.error("[Shop] Error getting player progress:", error);
        res.status(500).json({ error: "Failed to get player progress" });
    }
});

export { playerRouter };
export default router;

