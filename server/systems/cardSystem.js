// Chapter 11.5: Card System Module
// Handles card casting, effects, and match-level card rules

import { CARDS } from "../config/cards.js";
import { getPlayerUnlockedCards } from "../services/xpService.js";
import { EffectState } from "../schema/EffectState.js";

// Effect duration (10 seconds)
export const EFFECT_DURATION = 10000;

/**
 * CardSystem - Manages card casting, effects, and match-level rules
 */
export class CardSystem {
    constructor(room) {
        this.room = room; // Reference to QuizRoom instance
        this.matchCardRules = {
            disabledCards: new Map(), // MapSchema-compatible: Map<cardId, true>
            goldCostModifiers: {} // Map: cardId -> multiplier (0.5-2.0)
        };
    }

    /**
     * Initialize match card rules (called from QuizRoom.onCreate)
     */
    initializeRules() {
        this.matchCardRules = {
            disabledCards: new Map(),
            goldCostModifiers: {}
        };
    }

    /**
     * Reset match card rules (called from RESET_MATCH)
     */
    resetRules() {
        if (this.matchCardRules.disabledCards) {
            this.matchCardRules.disabledCards.clear();
        }
        this.matchCardRules.goldCostModifiers = {};
        this.broadcastRulesUpdate();
    }

    /**
     * Get current match card rules
     */
    getRules() {
        return {
            disabledCards: Array.from(this.matchCardRules.disabledCards.keys()),
            goldCostModifiers: { ...this.matchCardRules.goldCostModifiers }
        };
    }

    /**
     * Disable a card for this match
     */
    disableCard(cardId) {
        if (!CARDS[cardId]) {
            throw new Error(`Invalid card ID: ${cardId}`);
        }
        this.matchCardRules.disabledCards.set(cardId, true);
        this.broadcastRulesUpdate();
    }

    /**
     * Enable a card for this match (remove from disabled)
     */
    enableCard(cardId) {
        this.matchCardRules.disabledCards.delete(cardId);
        this.broadcastRulesUpdate();
    }

    /**
     * Set gold cost modifier for a standard card
     */
    setCostModifier(cardId, multiplier) {
        if (!CARDS[cardId]) {
            throw new Error(`Invalid card ID: ${cardId}`);
        }
        if (CARDS[cardId].type !== "standard") {
            throw new Error(`Only standard cards can have cost modifiers`);
        }
        // Clamp multiplier to [0.5, 2.0]
        const clamped = Math.min(2.0, Math.max(0.5, multiplier));
        this.matchCardRules.goldCostModifiers[cardId] = clamped;
        this.broadcastRulesUpdate();
    }

    /**
     * Broadcast card rules update to all clients
     */
    broadcastRulesUpdate() {
        this.room.broadcast("CARD_RULES_UPDATE", {
            disabledCards: Array.from(this.matchCardRules.disabledCards.keys()),
            goldCostModifiers: { ...this.matchCardRules.goldCostModifiers }
        });
    }

    /**
     * Handle castCard message from client
     */
    handleCastCard(client, message) {
        try {
            console.log(`[CardSystem] castCard received from client ${client.sessionId}:`, message);
            
            if (client.metadata.role !== "student") {
                console.log(`[CardSystem] castCard rejected: not a student (role: ${client.metadata.role})`);
                return;
            }

            const { cardId, targetTeamId } = message;
            const card = CARDS[cardId];

            if (!card) {
                console.log(`[CardSystem] castCard rejected: invalid card ID "${cardId}"`);
                client.send("ERROR", { message: "Invalid card" });
                return;
            }
            
            console.log(`[CardSystem] castCard: card found - ${card.name} (${card.type}), cost: ${card.cost}`);

            // Find team by member (writer or suggester) - use playerId if available (handles reconnects)
            const { team, casterTeamId } = this.findTeamForClient(client);
            
            if (!team) {
                console.log(`[CardSystem] castCard rejected: team not found for client. sessionId=${client.sessionId}, playerId=${client.metadata.playerId}`);
                client.send("ERROR", { message: "You are not in a team" });
                return;
            }

            // Check if card is disabled for this match
            if (this.matchCardRules.disabledCards.has(cardId)) {
                console.log(`[CardSystem] castCard rejected: card ${cardId} is disabled for this match`);
                client.send("ERROR", { message: "This card is disabled for this match" });
                return;
            }

            // Verify card is unlocked
            if (!this.isCardUnlocked(client, cardId)) {
                console.log(`[CardSystem] castCard rejected: card ${cardId} not unlocked`);
                client.send("ERROR", { message: "Card not unlocked" });
                return;
            }

            // Handle cosmetic cards (no gold cost, no gameplay effect)
            if (card.type === "cosmetic") {
                this.room.broadcast("CARD_CAST", {
                    cardId,
                    casterTeamId,
                    targetTeamId: card.target === "self" ? casterTeamId : (targetTeamId || casterTeamId),
                    isCosmetic: true
                });
                return; // Early return - no gold deduction, no gameplay effect
            }

            // Standard cards: require gold and may have per-match cost modifier
            const adjustedCost = this.calculateAdjustedCost(card);
            
            console.log(`[CardSystem] castCard: team gold = ${team.gold}, base cost = ${card.cost}, adjusted cost = ${adjustedCost}`);
            if (team.gold < adjustedCost) {
                console.log(`[CardSystem] castCard rejected: insufficient gold (have ${team.gold}, need ${adjustedCost})`);
                client.send("ERROR", { message: "Insufficient gold" });
                return;
            }

            // Verify target for opponent cards
            if (card.target === "opponent") {
                if (!targetTeamId || targetTeamId === casterTeamId) {
                    client.send("ERROR", { message: "Invalid target" });
                    return;
                }
                if (!this.room.state.teams.has(targetTeamId)) {
                    client.send("ERROR", { message: "Target team not found" });
                    return;
                }
            }

            // Deduct gold using adjusted cost
            team.gold -= adjustedCost;
            this.room.state.gold.set(casterTeamId, team.gold);

            // Create effect (gameplay effect for standard cards)
            this.createEffect(cardId, casterTeamId, card.target === "self" ? casterTeamId : targetTeamId);

            // Award XP (+1) for casting card (delegate to scoring system)
            if (this.room.scoringSystem) {
                this.room.scoringSystem.addXPToCache(client.metadata.playerId, 1, "cardCast");
            }

            // Broadcast card cast
            this.room.broadcast("CARD_CAST", {
                cardId,
                casterTeamId,
                targetTeamId: card.target === "self" ? casterTeamId : targetTeamId
            });

            this.room.broadcastGoldUpdate();
            this.room.broadcastTeamUpdate();
        } catch (error) {
            console.error(`[CardSystem] castCard error:`, error);
            console.error(`[CardSystem] castCard error stack:`, error.stack);
            client.send("ERROR", { message: "Failed to cast card: " + error.message });
        }
    }

    /**
     * Find team for a client (by writer or suggester)
     */
    findTeamForClient(client) {
        const playerId = client.metadata.playerId;
        console.log(`[CardSystem] Looking for team. client.sessionId=${client.sessionId}, playerId=${playerId}, teams count=${this.room.state.teams.size}`);
        
        for (const [tId, t] of this.room.state.teams.entries()) {
            const isWriterBySession = t.writer === client.sessionId;
            const isWriterByPlayerId = playerId && t.writerPlayerId === playerId;
            const isSuggester = t.suggesters.findIndex(s => s === client.sessionId) >= 0;
            
            console.log(`[CardSystem] Checking team ${tId}, writer=${t.writer}, writerPlayerId=${t.writerPlayerId}, isWriterBySession=${isWriterBySession}, isWriterByPlayerId=${isWriterByPlayerId}, isSuggester=${isSuggester}`);
            
            if (isWriterBySession || isWriterByPlayerId || isSuggester) {
                // If we found by playerId but sessionId doesn't match, update it
                if (isWriterByPlayerId && t.writer !== client.sessionId) {
                    console.log(`[CardSystem] Updating writer sessionId from ${t.writer} to ${client.sessionId} (reconnect)`);
                    t.writer = client.sessionId;
                }
                console.log(`[CardSystem] Found team ${tId} for client ${client.sessionId}`);
                return { team: t, casterTeamId: tId };
            }
        }
        
        return { team: null, casterTeamId: null };
    }

    /**
     * Check if a card is unlocked for a client
     */
    isCardUnlocked(client, cardId) {
        // Require unlockedCards to be set (should be set in onJoin)
        if (!client.metadata.unlockedCards) {
            console.warn(`[CardSystem] Client ${client.sessionId} has no unlockedCards metadata. Loading from database...`);
            // Fallback: load unlocked cards if not set
            if (client.metadata.playerId) {
                const unlockedCards = getPlayerUnlockedCards(client.metadata.playerId);
                client.metadata.unlockedCards = unlockedCards;
                console.log(`[CardSystem] Loaded unlockedCards from DB for player ${client.metadata.playerId}:`, unlockedCards);
            } else {
                console.log(`[CardSystem] No playerId in metadata`);
                return false;
            }
        }
        
        if (!Array.isArray(client.metadata.unlockedCards)) {
            console.log(`[CardSystem] unlockedCards is not an array, reloading...`);
            if (client.metadata.playerId) {
                const unlockedCards = getPlayerUnlockedCards(client.metadata.playerId);
                client.metadata.unlockedCards = unlockedCards;
                console.log(`[CardSystem] reloaded unlockedCards:`, unlockedCards);
            } else {
                return false;
            }
        }
        
        const isUnlocked = client.metadata.unlockedCards.includes(cardId);
        console.log(`[CardSystem] card ${cardId} unlocked? ${isUnlocked}`);
        return isUnlocked;
    }

    /**
     * Calculate adjusted gold cost for a card (with match-level modifier)
     */
    calculateAdjustedCost(card) {
        const baseCost = card.cost;
        let multiplier = 1.0;
        const ruleMultiplier = this.matchCardRules.goldCostModifiers[card.id];
        if (typeof ruleMultiplier === "number" && !Number.isNaN(ruleMultiplier)) {
            // Clamp to [0.5, 2.0] on the server as extra safety
            multiplier = Math.min(2.0, Math.max(0.5, ruleMultiplier));
        }
        let adjustedCost = Math.ceil(baseCost * multiplier);
        // Prevent zero-cost exploitation
        if (adjustedCost < 1) adjustedCost = 1;
        return adjustedCost;
    }

    /**
     * Create a card effect
     */
    createEffect(cardId, casterTeamId, targetTeamId) {
        const effect = new EffectState();
        effect.cardId = cardId;
        effect.casterTeamId = casterTeamId;
        effect.targetTeamId = targetTeamId;
        effect.timestamp = Date.now();
        effect.expiresAt = effect.timestamp + EFFECT_DURATION;

        // Replace any existing effect on target
        this.room.state.activeEffects.set(targetTeamId, effect);
    }

    /**
     * Check and remove expired effects
     */
    checkEffectExpiration() {
        const now = Date.now();
        const expiredEffects = [];

        for (const [targetTeamId, effect] of this.room.state.activeEffects.entries()) {
            if (now >= effect.expiresAt) {
                expiredEffects.push(targetTeamId);
            }
        }

        expiredEffects.forEach(teamId => {
            this.room.state.activeEffects.delete(teamId);
        });
    }
}

