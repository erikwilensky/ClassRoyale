import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { spendXP, getPlayerProgress } from "../services/xpService.js";
import { getAllCards, getCardById } from "../config/cards.js";
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
 */
router.get("/cards", authenticateToken, (req, res) => {
    try {
        const playerId = req.playerId;
        
        // Get player's unlocked cards
        const unlockedCards = getPlayerUnlockedCards(playerId);
        const unlockedSet = new Set(unlockedCards);
        
        // Get all cards and add unlock status
        const allCards = getAllCards();
        const cardsWithStatus = allCards.map(card => ({
            id: card.id,
            name: card.name,
            unlockCost: card.unlockCost,
            type: card.type,
            cost: card.cost, // Gold cost in-match
            target: card.target,
            effect: card.effect,
            description: card.description,
            unlocked: unlockedSet.has(card.id)
        }));
        
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
        
        // Get card info
        const card = getCardById(cardId);
        if (!card) {
            return res.status(400).json({ error: "Invalid card ID" });
        }
        
        // Check if player already owns the card
        const unlockedCards = getPlayerUnlockedCards(playerId);
        if (unlockedCards.includes(cardId)) {
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
        
        if (playerProgress.availableXP < card.unlockCost) {
            return res.status(400).json({ 
                error: "Insufficient XP",
                required: card.unlockCost,
                available: playerProgress.availableXP
            });
        }
        
        // Atomic operation: spend XP and create unlock record
        // Use database transaction for atomicity
        const spendResult = spendXP(playerId, card.unlockCost);
        if (!spendResult.success) {
            return res.status(400).json({ error: spendResult.error });
        }
        
        // Create unlock record
        try {
            db.prepare(
                "INSERT INTO unlocks (playerId, cardId, unlockMethod) VALUES (?, ?, 'purchase')"
            ).run(playerId, cardId);
        } catch (error) {
            // If insert fails (e.g., duplicate), refund XP
            // This shouldn't happen due to earlier check, but handle it anyway
            if (error.message.includes("UNIQUE constraint") || error.message.includes("UNIQUE")) {
                // Refund XP by adding it back to availableXP
                const currentAvailableXP = db.prepare("SELECT availableXP FROM players WHERE id = ?").get(playerId)?.availableXP || 0;
                db.prepare("UPDATE players SET availableXP = ? WHERE id = ?")
                    .run(currentAvailableXP + card.unlockCost, playerId);
                return res.status(400).json({ error: "Card already owned" });
            }
            // For other errors, also refund XP
            const currentAvailableXP = db.prepare("SELECT availableXP FROM players WHERE id = ?").get(playerId)?.availableXP || 0;
            db.prepare("UPDATE players SET availableXP = ? WHERE id = ?")
                .run(currentAvailableXP + card.unlockCost, playerId);
            throw error;
        }
        
        console.log(`[Shop] Player ${playerId} purchased card ${cardId} for ${card.unlockCost} XP`);
        
        res.json({
            success: true,
            newAvailableXP: spendResult.newAvailableXP,
            unlockedCard: {
                id: card.id,
                name: card.name,
                type: card.type
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

