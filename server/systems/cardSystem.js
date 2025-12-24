// Chapter 11.5: Card System Module
// Handles card casting, effects, and match-level card rules

import { CARDS } from "../config/cards.js";
import { CARD_CATALOG_V1_BY_ID, getLegacyIdFromCatalogId } from "../config/cards.catalog.v1.js";
import { getPlayerUnlockedCards } from "../services/xpService.js";
import { EffectState } from "../schema/EffectState.js";
import { canPerformAction } from "./moderationGate.js";
import { processEffect } from "./effectProcessor.js";

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
        // Card Catalog v1: Shield tracking
        this.shields = new Map(); // Map<teamId, { type: string, expiresAt: number | null }>
        // Card Catalog v1: Card limits tracking (e.g., once per match)
        this.cardUsage = new Map(); // Map<teamId, Set<cardId>>
        
        // Timer effect state tracking
        this.timerPaused = new Map(); // Map<teamId, { pausedUntil: number }>
        this.timerProtected = new Map(); // Map<teamId, { protectedUntil: number }>
        this.timerRateMultipliers = new Map(); // Map<teamId, { multiplier: number, expiresAt: number }>
        this.timerStartDelayed = new Map(); // Map<teamId, { delayUntil: number }>
        this.timerInsurance = new Map(); // Map<teamId, { insuredSeconds: number }>
        this.overtimeClauseUsed = new Map(); // Map<teamId, Set<roundNumber>>
        
        // Suggestion effect state tracking
        this.suggestionPanelHidden = new Map(); // Map<teamId, { hiddenUntil: number }>
        this.suggestionPriorityMode = new Map(); // Map<teamId, { topCount: number, expiresAt: number }>
        this.suggestionBroadcastMode = new Map(); // Map<teamId, { expiresAt: number }>
        this.suggestionPingsMuted = new Map(); // Map<teamId, { mutedUntil: number }>
        this.suggestionCharLimit = new Map(); // Map<teamId, { maxChars: number, expiresAt: number }>
        
        // Writer/Role effect state tracking
        this.writerLocked = new Map(); // Map<teamId, { lockedUntil: number }>
        this.scheduledSwaps = new Map(); // Map<teamId, { swapAt: number, roundStartTime: number }>
        this.highlightedSuggesters = new Map(); // Map<teamId, { suggesterId: string, expiresAt: number }>
        this.spectatorSuggestersEnabled = new Map(); // Map<teamId, { expiresAt: number }>
        
        // Gold effect state tracking
        this.teamGoldCostModifiers = new Map(); // Map<teamId, Map<cardId, { modifier: number, remaining: number }>>
        this.goldInterest = new Map(); // Map<teamId, { rate: number, maxGain: number }>
        this.goldRefundOnBlock = new Map(); // Map<teamId, { cardCount: number, lastCardCost: number }>
        this.goldInflation = null; // { modifier: number, expiresAt: number } | null
        
        // Defense effect state tracking
        this.effectReflect = new Map(); // Map<teamId, { cardCount: number }>
        this.effectImmunity = new Map(); // Map<teamId, Set<effectType>>
        this.effectDecoy = new Map(); // Map<teamId, { cardCount: number }>
        
        // Deck/Casting effect state tracking
        this.recallUsed = new Map(); // Map<teamId, Set<roundNumber>>
        this.lastCastCard = new Map(); // Map<teamId, cardId>
        this.castLockout = new Map(); // Map<teamId, { lockedUntil: number, cardCount: number }>
        this.castInstant = new Map(); // Map<teamId, { cardCount: number }>
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
        // Card Catalog v1: Reset shields and card usage
        this.shields.clear();
        this.cardUsage.clear();
        
        // Reset all effect state tracking
        this.timerPaused.clear();
        this.timerProtected.clear();
        this.timerRateMultipliers.clear();
        this.timerStartDelayed.clear();
        this.timerInsurance.clear();
        this.overtimeClauseUsed.clear();
        this.suggestionPanelHidden.clear();
        this.suggestionPriorityMode.clear();
        this.suggestionBroadcastMode.clear();
        this.suggestionPingsMuted.clear();
        this.suggestionCharLimit.clear();
        this.writerLocked.clear();
        this.scheduledSwaps.clear();
        this.highlightedSuggesters.clear();
        this.spectatorSuggestersEnabled.clear();
        this.teamGoldCostModifiers.clear();
        this.goldInterest.clear();
        this.goldRefundOnBlock.clear();
        this.goldInflation = null;
        this.effectReflect.clear();
        this.effectImmunity.clear();
        this.effectDecoy.clear();
        this.recallUsed.clear();
        this.lastCastCard.clear();
        this.castLockout.clear();
        this.castInstant.clear();
        
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
     * Card Catalog v1: Also check catalog cards
     */
    disableCard(cardId) {
        // Check legacy CARDS first
        if (!CARDS[cardId]) {
            // Check catalog
            if (!CARD_CATALOG_V1_BY_ID[cardId]) {
                throw new Error(`Invalid card ID: ${cardId}`);
            }
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
     * Card Catalog v1: Also check catalog cards
     */
    setCostModifier(cardId, multiplier) {
        // Check legacy CARDS first
        let card = CARDS[cardId];
        if (!card) {
            // Check catalog
            const catalogCard = CARD_CATALOG_V1_BY_ID[cardId];
            if (!catalogCard) {
                throw new Error(`Invalid card ID: ${cardId}`);
            }
            if (catalogCard.kind !== "standard") {
                throw new Error(`Only standard cards can have cost modifiers`);
            }
        } else {
            if (card.type !== "standard") {
                throw new Error(`Only standard cards can have cost modifiers`);
            }
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
            
            // Card Catalog v1: Check both catalog and legacy CARDS
            let card = CARDS[cardId]; // Legacy uppercase IDs
            let catalogCard = null;
            let isCatalogCard = false;
            
            if (!card) {
                // Try catalog (kebab-case IDs)
                catalogCard = CARD_CATALOG_V1_BY_ID[cardId];
                if (catalogCard) {
                    isCatalogCard = true;
                    // Convert catalog card to legacy format for compatibility
                    card = {
                        id: cardId,
                        name: catalogCard.name,
                        type: catalogCard.kind, // "standard" or "cosmetic"
                        cost: catalogCard.baseGoldCost,
                        target: catalogCard.target,
                        unlockCost: catalogCard.unlockXp,
                        effect: catalogCard.effect,
                        description: catalogCard.description
                    };
                }
            }
            
            if (!card) {
                console.log(`[CardSystem] castCard rejected: invalid card ID "${cardId}"`);
                client.send("ERROR", { message: "Invalid card" });
                return;
            }
            
            console.log(`[CardSystem] castCard: card found - ${card.name} (${card.type}), cost: ${card.cost}, catalog: ${isCatalogCard}`);

            // Find team by member (writer or suggester) - use playerId if available (handles reconnects)
            const { team, casterTeamId } = this.findTeamForClient(client);
            
            if (!team) {
                console.log(`[CardSystem] castCard rejected: team not found for client. sessionId=${client.sessionId}, playerId=${client.metadata.playerId}`);
                client.send("ERROR", { message: "You are not in a team" });
                return;
            }

            // Chapter 13: Use centralized moderation gate
            const canPerform = canPerformAction(this.room, {
                playerId: client.metadata.playerId,
                teamId: casterTeamId,
                action: "castCard"
            });
            if (!canPerform.ok) {
                return; // Silent failure
            }

            // Chapter 16: Verify card is in team's deck
            if (!team.deckSlots || !Array.from(team.deckSlots).includes(cardId)) {
                console.log(`[CardSystem] castCard rejected: card ${cardId} not in team deck`);
                client.send("ERROR", { message: "Card not in team deck" });
                return;
            }

            // Check if card is disabled for this match
            if (this.matchCardRules.disabledCards.has(cardId)) {
                console.log(`[CardSystem] castCard rejected: card ${cardId} is disabled for this match`);
                client.send("ERROR", { message: "This card is disabled for this match" });
                return;
            }

            // Card Catalog v1: Check card limits (e.g., once per match)
            if (isCatalogCard && catalogCard.limits) {
                const limits = catalogCard.limits;
                if (limits.scope === "match" && limits.perTeam) {
                    if (!this.cardUsage.has(casterTeamId)) {
                        this.cardUsage.set(casterTeamId, new Set());
                    }
                    const teamUsage = this.cardUsage.get(casterTeamId);
                    const usageCount = Array.from(teamUsage).filter(id => id === cardId).length;
                    if (usageCount >= limits.perTeam) {
                        console.log(`[CardSystem] castCard rejected: card ${cardId} limit reached (${limits.perTeam} per match)`);
                        client.send("ERROR", { message: `This card can only be used ${limits.perTeam} time(s) per match` });
                        return;
                    }
                }
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
            const adjustedCost = this.calculateAdjustedCost(card, casterTeamId);
            
            console.log(`[CardSystem] castCard: team gold = ${team.gold}, base cost = ${card.cost}, adjusted cost = ${adjustedCost}`);
            if (team.gold < adjustedCost) {
                console.log(`[CardSystem] castCard rejected: insufficient gold (have ${team.gold}, need ${adjustedCost})`);
                client.send("ERROR", { message: "Insufficient gold" });
                return;
            }

            // Card Catalog v1: Check for cast lockout
            if (this.isCastLockedOut(casterTeamId)) {
                console.log(`[CardSystem] castCard rejected: team ${casterTeamId} is locked out`);
                client.send("ERROR", { message: "Cannot cast cards right now. Please wait." });
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

            // Track last card cost for refund on block
            if (this.goldRefundOnBlock.has(casterTeamId)) {
                const refund = this.goldRefundOnBlock.get(casterTeamId);
                refund.lastCardCost = adjustedCost;
            }
            
            // Track last cast card for recall
            this.lastCastCard.set(casterTeamId, cardId);
            
            // Deduct gold using adjusted cost
            team.gold -= adjustedCost;
            this.room.state.gold.set(casterTeamId, team.gold);
            
            // Decrement team-specific cost modifiers
            if (this.teamGoldCostModifiers.has(casterTeamId)) {
                const teamMods = this.teamGoldCostModifiers.get(casterTeamId);
                // Check for "*" (all cards) or specific cardId
                if (teamMods.has("*")) {
                    const mod = teamMods.get("*");
                    mod.remaining--;
                    if (mod.remaining <= 0) {
                        teamMods.delete("*");
                    }
                } else if (teamMods.has(cardId)) {
                    const mod = teamMods.get(cardId);
                    mod.remaining--;
                    if (mod.remaining <= 0) {
                        teamMods.delete(cardId);
                    }
                }
            }
            
            // Decrement cast instant count
            if (this.castInstant.has(casterTeamId)) {
                const instant = this.castInstant.get(casterTeamId);
                instant.cardCount--;
                if (instant.cardCount <= 0) {
                    this.castInstant.delete(casterTeamId);
                }
            }

            // Card Catalog v1: Track card usage for limits
            if (isCatalogCard && catalogCard.limits) {
                if (!this.cardUsage.has(casterTeamId)) {
                    this.cardUsage.set(casterTeamId, new Set());
                }
                this.cardUsage.get(casterTeamId).add(cardId);
            }

            // Create effect (gameplay effect for standard cards)
            const finalTargetTeamId = card.target === "self" ? casterTeamId : targetTeamId;
            this.createEffect(cardId, casterTeamId, finalTargetTeamId, isCatalogCard ? catalogCard : null);

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
     * Card Catalog v1: Checks both catalog ID and legacy ID for backwards compatibility
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
        
        // Check if cardId is unlocked
        let isUnlocked = client.metadata.unlockedCards.includes(cardId);
        
        // Card Catalog v1: If catalog card, also check legacy ID
        if (!isUnlocked) {
            const legacyId = getLegacyIdFromCatalogId(cardId);
            if (legacyId) {
                isUnlocked = client.metadata.unlockedCards.includes(legacyId);
            }
        }
        
        // Card Catalog v1: If legacy card, also check catalog ID
        if (!isUnlocked && CARDS[cardId]) {
            // This is a legacy card, check if catalog version is unlocked
            // Find catalog ID from legacy ID by iterating catalog
            for (const catalogId in CARD_CATALOG_V1_BY_ID) {
                const catalogLegacyId = getLegacyIdFromCatalogId(catalogId);
                if (catalogLegacyId === cardId) {
                    isUnlocked = client.metadata.unlockedCards.includes(catalogId);
                    break;
                }
            }
        }
        
        console.log(`[CardSystem] card ${cardId} unlocked? ${isUnlocked}`);
        return isUnlocked;
    }

    /**
     * Calculate adjusted gold cost for a card (with match-level modifier, team modifiers, and inflation)
     * @param {Object} card - Card object
     * @param {string} teamId - Team ID casting the card
     */
    calculateAdjustedCost(card, teamId = null) {
        const baseCost = card.cost;
        let modifier = 0; // Use additive modifier instead of multiplier
        
        // Match-level modifier (multiplier)
        const ruleMultiplier = this.matchCardRules.goldCostModifiers[card.id];
        if (typeof ruleMultiplier === "number" && !Number.isNaN(ruleMultiplier)) {
            // Clamp to [0.5, 2.0] on the server as extra safety
            const clamped = Math.min(2.0, Math.max(0.5, ruleMultiplier));
            modifier += (baseCost * clamped) - baseCost; // Convert multiplier to additive
        }
        
        // Team-specific modifiers (tariff, coupon) - these are additive
        if (teamId && this.teamGoldCostModifiers.has(teamId)) {
            const teamMods = this.teamGoldCostModifiers.get(teamId);
            // Check for "*" (all cards) or specific cardId
            if (teamMods.has("*")) {
                const mod = teamMods.get("*");
                modifier += mod.modifier; // Can be positive (tariff) or negative (coupon)
            } else if (teamMods.has(card.id)) {
                const mod = teamMods.get(card.id);
                modifier += mod.modifier;
            }
        }
        
        // Global inflation (additive)
        if (this.goldInflation && Date.now() < this.goldInflation.expiresAt) {
            modifier += this.goldInflation.modifier;
        }
        
        let adjustedCost = Math.ceil(baseCost + modifier);
        // Prevent negative costs (coupon can reduce to 0, but not below)
        if (adjustedCost < 0) adjustedCost = 0;
        // Enforce minimum cost of 1 for standard cards (prevents free standard cards)
        if (adjustedCost < 1 && card.type === "standard") adjustedCost = 1;
        return adjustedCost;
    }

    /**
     * Create a card effect
     * @param {string} cardId - Card ID (legacy or catalog)
     * @param {string} casterTeamId - Team that cast the card
     * @param {string} targetTeamId - Team targeted by the card
     * @param {Object|null} catalogCard - Catalog card object if this is a catalog card, null for legacy
     */
    createEffect(cardId, casterTeamId, targetTeamId, catalogCard = null) {
        // Card Catalog v1: Check for decoy before applying
        if (this.effectDecoy.has(targetTeamId)) {
            const decoy = this.effectDecoy.get(targetTeamId);
            if (decoy.cardCount > 0) {
                decoy.cardCount--;
                if (decoy.cardCount <= 0) {
                    this.effectDecoy.delete(targetTeamId);
                }
                console.log(`[CardSystem] Effect consumed by decoy for team ${targetTeamId}`);
                return; // Effect consumed, don't apply
            }
        }
        
        // Card Catalog v1: Check for reflect before applying negative effects
        let finalCasterTeamId = casterTeamId;
        let finalTargetTeamId = targetTeamId;
        if (catalogCard && catalogCard.effect) {
            const effectType = catalogCard.effect.type || "";
            // Check if this is a negative effect
            const negativeEffects = ["TIMER_SUBTRACT", "SUGGESTION_DELAY", "SUGGESTION_MUTE_RECEIVE", 
                "SCREEN_SHAKE", "SCREEN_BLUR", "SCREEN_DISTORT", "MICRO_DISTRACTION",
                "SUGGEST_PANEL_HIDE", "SUGGEST_CHAR_LIMIT", "CAST_LOCKOUT", "GOLD_STEAL", "GOLD_COST_MOD"];
            if (negativeEffects.includes(effectType) && this.effectReflect.has(targetTeamId)) {
                const reflect = this.effectReflect.get(targetTeamId);
                if (reflect.cardCount > 0) {
                    // Swap caster and target
                    finalCasterTeamId = targetTeamId;
                    finalTargetTeamId = casterTeamId;
                    reflect.cardCount--;
                    if (reflect.cardCount <= 0) {
                        this.effectReflect.delete(targetTeamId);
                    }
                    console.log(`[CardSystem] Effect reflected from team ${targetTeamId} to team ${casterTeamId}`);
                }
            }
        }
        
        const effect = new EffectState();
        effect.cardId = cardId;
        effect.casterTeamId = finalCasterTeamId;
        effect.targetTeamId = finalTargetTeamId;
        effect.timestamp = Date.now();
        
        // Card Catalog v1: Set effect type and params if catalog card
        if (catalogCard && catalogCard.effect) {
            effect.effectType = catalogCard.effect.type || "";
            effect.effectParams = catalogCard.effect.params || catalogCard.effect;
            
            // Set expiration based on effect duration if specified
            if (catalogCard.effect.durationSeconds) {
                effect.expiresAt = effect.timestamp + (catalogCard.effect.durationSeconds * 1000);
            } else {
                effect.expiresAt = effect.timestamp + EFFECT_DURATION;
            }
        } else {
            // Legacy card - use default duration
            effect.expiresAt = effect.timestamp + EFFECT_DURATION;
        }

        // Card Catalog v1: Check for immunity before processing
        if (effect.effectType && this.hasEffectImmunity(finalTargetTeamId, effect.effectType)) {
            console.log(`[CardSystem] Effect ${effect.effectType} blocked by immunity for team ${finalTargetTeamId}`);
            // Don't store or process blocked effects
            return; // Effect blocked by immunity
        }

        // Replace any existing effect on target
        this.room.state.activeEffects.set(finalTargetTeamId, effect);

        // Card Catalog v1: Process effect if it has a type
        if (effect.effectType) {
            processEffect(effect, this.room, this);
        }
    }

    /**
     * Add a shield to a team
     * @param {string} teamId - Team ID
     * @param {string} shieldType - Type of shield (e.g., "NEGATIVE_NEXT")
     * @param {number|null} expiresSeconds - Seconds until expiration, or null for permanent
     */
    addShield(teamId, shieldType, expiresSeconds = null) {
        const expiresAt = expiresSeconds ? Date.now() + (expiresSeconds * 1000) : null;
        this.shields.set(teamId, { type: shieldType, expiresAt });
        console.log(`[CardSystem] Shield added to team ${teamId}: ${shieldType}, expires: ${expiresAt ? new Date(expiresAt).toISOString() : "never"}`);
    }

    /**
     * Recharge (extend) an existing shield or grant a new one
     * @param {string} teamId - Team ID
     * @param {number} extendSeconds - Seconds to extend shield
     * @param {Object|null} fallbackGrant - Shield to grant if no existing shield
     */
    rechargeShield(teamId, extendSeconds, fallbackGrant = null) {
        const existingShield = this.shields.get(teamId);
        if (existingShield) {
            // Extend existing shield
            if (existingShield.expiresAt) {
                existingShield.expiresAt += (extendSeconds * 1000);
            } else {
                // Permanent shield becomes timed
                existingShield.expiresAt = Date.now() + (extendSeconds * 1000);
            }
            console.log(`[CardSystem] Shield recharged for team ${teamId}, new expires: ${new Date(existingShield.expiresAt).toISOString()}`);
        } else if (fallbackGrant) {
            // Grant new shield
            const expiresSeconds = fallbackGrant.expiresSeconds || null;
            this.addShield(teamId, fallbackGrant.type || "NEGATIVE_NEXT", expiresSeconds);
        }
    }

    /**
     * Check if a team has an active shield that blocks a negative effect
     * @param {string} teamId - Team ID
     * @param {string} effectType - Type of effect to check
     * @returns {boolean} True if shield blocks the effect
     */
    hasShield(teamId, effectType) {
        const shield = this.shields.get(teamId);
        if (!shield) return false;

        // Check expiration
        if (shield.expiresAt && Date.now() >= shield.expiresAt) {
            this.shields.delete(teamId);
            return false;
        }

        // Check if shield type matches
        if (shield.type === "NEGATIVE_NEXT") {
            // Block negative effects (timer subtract, suggestion delay, etc.)
            const negativeEffects = [
                "TIMER_SUBTRACT", "SUGGESTION_DELAY", "SUGGESTION_MUTE_RECEIVE", 
                "SCREEN_SHAKE", "SCREEN_BLUR", "SCREEN_DISTORT", "MICRO_DISTRACTION",
                "SUGGEST_PANEL_HIDE", "SUGGEST_CHAR_LIMIT", "CAST_LOCKOUT", 
                "GOLD_STEAL", "GOLD_COST_MOD", "UI_OVERLAY_FOG", "UI_CURSOR_MIRAGE", 
                "UI_PANEL_SWAP", "UI_DIM_INPUT"
            ];
            if (negativeEffects.includes(effectType)) {
                // Consume shield and refund gold if applicable
                this.shields.delete(teamId);
                this.refundGoldOnBlock(teamId);
                console.log(`[CardSystem] Shield consumed for team ${teamId}, blocked ${effectType}`);
                return true;
            }
        }

        return false;
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
        
        // Clean up expired timer effects
        for (const [teamId, pause] of this.timerPaused.entries()) {
            if (now >= pause.pausedUntil) {
                this.timerPaused.delete(teamId);
            }
        }
        for (const [teamId, protect] of this.timerProtected.entries()) {
            if (now >= protect.protectedUntil) {
                this.timerProtected.delete(teamId);
            }
        }
        for (const [teamId, rate] of this.timerRateMultipliers.entries()) {
            if (now >= rate.expiresAt) {
                this.timerRateMultipliers.delete(teamId);
            }
        }
        for (const [teamId, delay] of this.timerStartDelayed.entries()) {
            if (now >= delay.delayUntil) {
                this.timerStartDelayed.delete(teamId);
            }
        }
        
        // Clean up expired suggestion effects
        for (const [teamId, hidden] of this.suggestionPanelHidden.entries()) {
            if (now >= hidden.hiddenUntil) {
                this.suggestionPanelHidden.delete(teamId);
                this.room.broadcastToTeam(teamId, "SUGGESTION_PANEL_VISIBLE", {});
            }
        }
        for (const [teamId, priority] of this.suggestionPriorityMode.entries()) {
            if (now >= priority.expiresAt) {
                this.suggestionPriorityMode.delete(teamId);
            }
        }
        for (const [teamId, broadcast] of this.suggestionBroadcastMode.entries()) {
            if (now >= broadcast.expiresAt) {
                this.suggestionBroadcastMode.delete(teamId);
            }
        }
        for (const [teamId, mute] of this.suggestionPingsMuted.entries()) {
            if (now >= mute.mutedUntil) {
                this.suggestionPingsMuted.delete(teamId);
            }
        }
        for (const [teamId, limit] of this.suggestionCharLimit.entries()) {
            if (now >= limit.expiresAt) {
                this.suggestionCharLimit.delete(teamId);
            }
        }
        
        // Clean up expired writer effects
        for (const [teamId, lock] of this.writerLocked.entries()) {
            if (now >= lock.lockedUntil) {
                this.writerLocked.delete(teamId);
            }
        }
        for (const [teamId, highlight] of this.highlightedSuggesters.entries()) {
            if (now >= highlight.expiresAt) {
                this.highlightedSuggesters.delete(teamId);
            }
        }
        for (const [teamId, spectator] of this.spectatorSuggestersEnabled.entries()) {
            if (now >= spectator.expiresAt) {
                this.spectatorSuggestersEnabled.delete(teamId);
            }
        }
        
        // Clean up expired gold inflation
        if (this.goldInflation && now >= this.goldInflation.expiresAt) {
            this.goldInflation = null;
        }
        
        // Clean up expired immunity effects
        for (const [teamId, immunitySet] of this.effectImmunity.entries()) {
            // Immunity sets are managed by effect expiration, but we can check activeEffects
            const activeEffect = this.room.state.activeEffects.get(teamId);
            if (!activeEffect || now >= activeEffect.expiresAt) {
                // Effect expired, but immunity might be from a different effect
                // Keep immunity set until explicitly removed
            }
        }
    }
    
    /**
     * Check if timer is paused for a team
     */
    isTimerPaused(teamId) {
        const pause = this.timerPaused.get(teamId);
        if (!pause) return false;
        if (Date.now() >= pause.pausedUntil) {
            this.timerPaused.delete(teamId);
            return false;
        }
        return true;
    }
    
    /**
     * Check if timer is protected for a team
     */
    isTimerProtected(teamId) {
        const protect = this.timerProtected.get(teamId);
        if (!protect) return false;
        if (Date.now() >= protect.protectedUntil) {
            this.timerProtected.delete(teamId);
            return false;
        }
        return true;
    }
    
    /**
     * Get timer rate multiplier for a team
     */
    getTimerRateMultiplier(teamId) {
        const rate = this.timerRateMultipliers.get(teamId);
        if (!rate) return 1.0;
        if (Date.now() >= rate.expiresAt) {
            this.timerRateMultipliers.delete(teamId);
            return 1.0;
        }
        return rate.multiplier;
    }
    
    /**
     * Check if timer start is delayed for a team
     */
    isTimerStartDelayed(teamId) {
        const delay = this.timerStartDelayed.get(teamId);
        if (!delay) return false;
        if (Date.now() >= delay.delayUntil) {
            this.timerStartDelayed.delete(teamId);
            return false;
        }
        return true;
    }
    
    /**
     * Check if team has suggestion char limit
     */
    getSuggestionCharLimit(teamId) {
        const limit = this.suggestionCharLimit.get(teamId);
        if (!limit) return null;
        if (Date.now() >= limit.expiresAt) {
            this.suggestionCharLimit.delete(teamId);
            return null;
        }
        return limit.maxChars;
    }
    
    /**
     * Check if team has writer locked
     */
    isWriterLocked(teamId) {
        const lock = this.writerLocked.get(teamId);
        if (!lock) return false;
        if (Date.now() >= lock.lockedUntil) {
            this.writerLocked.delete(teamId);
            return false;
        }
        return true;
    }
    
    /**
     * Check if team has cast lockout
     */
    isCastLockedOut(teamId) {
        const lockout = this.castLockout.get(teamId);
        if (!lockout) return false;
        if (Date.now() >= lockout.lockedUntil) {
            this.castLockout.delete(teamId);
            return false;
        }
        return true;
    }
    
    /**
     * Check if team has effect immunity for a specific effect type
     */
    hasEffectImmunity(teamId, effectType) {
        const immunitySet = this.effectImmunity.get(teamId);
        if (!immunitySet) return false;
        return immunitySet.has(effectType);
    }
    
    /**
     * Refund gold if card was blocked
     */
    refundGoldOnBlock(teamId) {
        const refund = this.goldRefundOnBlock.get(teamId);
        if (!refund || refund.cardCount <= 0) return false;
        
        const team = this.room.state.teams.get(teamId);
        if (!team) return false;
        
        team.gold += refund.lastCardCost;
        this.room.state.gold.set(teamId, team.gold);
        this.room.broadcastGoldUpdate();
        
        refund.cardCount--;
        if (refund.cardCount <= 0) {
            this.goldRefundOnBlock.delete(teamId);
        }
        
        console.log(`[CardSystem] Refunded ${refund.lastCardCost} gold to team ${teamId} (blocked card)`);
        return true;
    }
}

