// Card Catalog v1: Effect Processor
// Handles effect.type-based processing for new cards

/**
 * Process a card effect based on its type
 * @param {EffectState} effect - The effect to process
 * @param {QuizRoom} room - The QuizRoom instance
 * @param {CardSystem} cardSystem - The CardSystem instance
 */
export function processEffect(effect, room, cardSystem) {
    if (!effect.effectType) {
        // Legacy card - no effect processing needed (handled by cardId matching)
        return;
    }

    const effectType = effect.effectType;
    const effectParams = effect.effectParams || {};
    const targetTeamId = effect.targetTeamId;
    const casterTeamId = effect.casterTeamId;
    const targetTeam = room.state.teams.get(targetTeamId);
    const casterTeam = room.state.teams.get(casterTeamId);

    if (!targetTeam) {
        console.warn(`[EffectProcessor] Target team ${targetTeamId} not found`);
        return;
    }

    switch (effectType) {
        case "TIMER_ADD":
            processTimerAdd(room, effectParams);
            break;
        case "TIMER_SUBTRACT":
            processTimerSubtract(room, effectParams, targetTeamId, cardSystem);
            break;
        case "TIMER_TEMPO_SWING":
            processTimerTempoSwing(room, effectParams, casterTeamId, targetTeamId, cardSystem);
            break;
        case "TIMER_ADD_CONDITIONAL":
            processTimerAddConditional(room, effectParams, targetTeamId);
            break;
        case "TIMER_ADD_IF_SUGGESTERS_LT":
            processTimerAddIfSuggestersLt(room, effectParams, targetTeamId);
            break;
        case "SUGGESTION_MUTE_RECEIVE":
            processSuggestionMuteReceive(room, effectParams, targetTeamId, effect);
            break;
        case "SUGGESTION_DELAY":
            processSuggestionDelay(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "WRITER_SWAP":
            processWriterSwap(room, effectParams, targetTeamId, effect);
            break;
        case "WRITER_DOUBLE_SWAP":
            processWriterDoubleSwap(room, effectParams, targetTeamId, effect);
            break;
        case "WRITER_ROULETTE":
            processWriterRoulette(room, effectParams, targetTeamId, effect);
            break;
        case "IMMUNITY":
            processImmunity(room, effectParams, targetTeamId, effect);
            break;
        case "SHIELD_NEGATIVE_NEXT":
            processShieldNegativeNext(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "SHIELD_RECHARGE":
            processShieldRecharge(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "GOLD_GAIN":
            processGoldGain(room, effectParams, targetTeamId);
            break;
        case "MULTI":
            processMulti(room, effectParams, casterTeamId, targetTeamId, cardSystem);
            break;
        // Card Catalog v1: Timer Effects
        case "TIMER_PAUSE":
            processTimerPause(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "TIMER_PROTECT":
            processTimerProtect(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "TIMER_RATE_MULT":
            processTimerRateMult(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "TIMER_LOAN":
            processTimerLoan(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "TIMER_OVERTIME_CLAUSE":
            processTimerOvertimeClause(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "TIMER_START_DELAY":
            processTimerStartDelay(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "TIMER_INSURANCE":
            processTimerInsurance(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        // Card Catalog v1: Suggestion Effects
        case "SUGGEST_PANEL_HIDE":
            processSuggestPanelHide(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "SUGGEST_PRIORITY_CHANNEL":
            processSuggestPriorityChannel(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "SUGGEST_QUEUE_CLEAR":
            processSuggestQueueClear(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "SUGGEST_BROADCAST_MODE":
            processSuggestBroadcastMode(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "SUGGEST_PING_MUTE":
            processSuggestPingMute(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "SUGGEST_CHAR_LIMIT":
            processSuggestCharLimit(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        // Card Catalog v1: Writer/Role Effects
        case "WRITER_CHOOSE":
            processWriterChoose(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "WRITER_LOCK":
            processWriterLock(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "WRITER_SCHEDULED_SWAP":
            processWriterScheduledSwap(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "SUGGESTER_HIGHLIGHT":
            processSuggesterHighlight(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "SUGGESTER_SPECTATOR_ENABLE":
            processSuggesterSpectatorEnable(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        // Card Catalog v1: Gold/Economy Effects
        case "GOLD_STEAL":
            processGoldSteal(room, effectParams, casterTeamId, targetTeamId, effect, cardSystem);
            break;
        case "GOLD_COST_MOD":
            processGoldCostMod(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "GOLD_COST_DISCOUNT":
            processGoldCostDiscount(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "GOLD_INTEREST":
            processGoldInterest(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "GOLD_DELAYED_GAIN":
            processGoldDelayedGain(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "GOLD_REFUND_ON_BLOCK":
            processGoldRefundOnBlock(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "GOLD_INFLATION":
            processGoldInflation(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        // Card Catalog v1: Defense Effects
        case "EFFECT_REFLECT":
            processEffectReflect(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "EFFECT_CLEANSE":
            processEffectCleanse(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "EFFECT_IMMUNITY_DISRUPTION":
            processEffectImmunityDisruption(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "EFFECT_IMMUNITY_COMMS":
            processEffectImmunityComms(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "EFFECT_DECOY":
            processEffectDecoy(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        // Card Catalog v1: Deck/Casting Effects
        case "DECK_SHUFFLE":
            processDeckShuffle(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "DECK_MOVE_CARD":
            processDeckMoveCard(room, effectParams, casterTeamId, targetTeamId, effect, cardSystem);
            break;
        case "DECK_SWAP_SLOTS":
            processDeckSwapSlots(room, effectParams, casterTeamId, targetTeamId, effect, cardSystem);
            break;
        case "DECK_RECALL":
            processDeckRecall(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "CAST_LOCKOUT":
            processCastLockout(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        case "CAST_INSTANT":
            processCastInstant(room, effectParams, targetTeamId, effect, cardSystem);
            break;
        // Card Catalog v1: UI Effects (stored in activeEffects, rendered client-side)
        case "UI_OVERLAY_FOG":
        case "UI_CURSOR_MIRAGE":
        case "UI_PANEL_SWAP":
        case "UI_DIM_INPUT":
            // UI effects are stored in activeEffects and rendered client-side
            console.log(`[EffectProcessor] ${effectType}: UI effect stored, will be rendered client-side`);
            break;
        default:
            console.warn(`[EffectProcessor] Unknown effect type: ${effectType}`);
    }
}

// Timer Effects

function processTimerAdd(room, params) {
    if (!params || typeof params.seconds !== "number") {
        console.warn("[EffectProcessor] TIMER_ADD: Invalid params", params);
        return;
    }
    const seconds = Math.max(0, params.seconds);
    room.state.timeRemaining = Math.max(0, room.state.timeRemaining + seconds);
    room.broadcast("TIMER_UPDATE", {
        timeRemaining: room.state.timeRemaining,
        enabled: room.state.timerEnabled
    });
    console.log(`[EffectProcessor] TIMER_ADD: Added ${seconds} seconds, new time: ${room.state.timeRemaining}`);
}

function processTimerSubtract(room, params, targetTeamId, cardSystem) {
    if (!params || typeof params.seconds !== "number") {
        console.warn("[EffectProcessor] TIMER_SUBTRACT: Invalid params", params);
        return;
    }
    
    // Check shield
    if (cardSystem && cardSystem.hasShield(targetTeamId, "TIMER_SUBTRACT")) {
        console.log(`[EffectProcessor] TIMER_SUBTRACT: Blocked by shield for team ${targetTeamId}`);
        return;
    }
    
    // Card Catalog v1: Check timer protection
    if (cardSystem && cardSystem.isTimerProtected(targetTeamId)) {
        console.log(`[EffectProcessor] TIMER_SUBTRACT: Blocked by timer protection for team ${targetTeamId}`);
        return;
    }
    
    // Card Catalog v1: Check timer insurance
    let secondsToSubtract = Math.max(0, params.seconds);
    if (cardSystem && cardSystem.timerInsurance.has(targetTeamId)) {
        const insurance = cardSystem.timerInsurance.get(targetTeamId);
        const refunded = Math.min(insurance.insuredSeconds, secondsToSubtract);
        secondsToSubtract -= refunded;
        insurance.insuredSeconds -= refunded;
        if (insurance.insuredSeconds <= 0) {
            cardSystem.timerInsurance.delete(targetTeamId);
        }
        console.log(`[EffectProcessor] TIMER_SUBTRACT: Insurance refunded ${refunded} seconds, subtracting ${secondsToSubtract} instead`);
    }
    
    const seconds = secondsToSubtract;
    room.state.timeRemaining = Math.max(0, room.state.timeRemaining - seconds);
    room.broadcast("TIMER_UPDATE", {
        timeRemaining: room.state.timeRemaining,
        enabled: room.state.timerEnabled
    });
    console.log(`[EffectProcessor] TIMER_SUBTRACT: Subtracted ${seconds} seconds, new time: ${room.state.timeRemaining}`);
}

function processTimerTempoSwing(room, params, casterTeamId, targetTeamId, cardSystem) {
    if (!params || typeof params.selfAddSeconds !== "number" || typeof params.oppSubSeconds !== "number") {
        console.warn("[EffectProcessor] TIMER_TEMPO_SWING: Invalid params", params);
        return;
    }
    
    // Check shield on target
    if (cardSystem && cardSystem.hasShield(targetTeamId, "TIMER_SUBTRACT")) {
        console.log(`[EffectProcessor] TIMER_TEMPO_SWING: Blocked by shield, adding to caster instead`);
        // If blocked, add to caster instead
        const seconds = Math.max(0, params.selfAddSeconds);
        room.state.timeRemaining = Math.max(0, room.state.timeRemaining + seconds);
        room.broadcast("TIMER_UPDATE", {
            timeRemaining: room.state.timeRemaining,
            enabled: room.state.timerEnabled
        });
        console.log(`[EffectProcessor] TIMER_TEMPO_SWING: Added ${seconds} seconds to caster (shield blocked subtract), new time: ${room.state.timeRemaining}`);
        return;
    }
    
    // For now, server chooses to subtract from opponent (original behavior)
    // TODO: Could add client prompt for choice in future
    const seconds = Math.max(0, params.oppSubSeconds);
    room.state.timeRemaining = Math.max(0, room.state.timeRemaining - seconds);
    room.broadcast("TIMER_UPDATE", {
        timeRemaining: room.state.timeRemaining,
        enabled: room.state.timerEnabled
    });
    console.log(`[EffectProcessor] TIMER_TEMPO_SWING: Subtracted ${seconds} seconds from opponent, new time: ${room.state.timeRemaining}`);
}

function processTimerAddConditional(room, params, targetTeamId) {
    if (!params || typeof params.thresholdBelowSeconds !== "number") {
        console.warn("[EffectProcessor] TIMER_ADD_CONDITIONAL: Invalid params", params);
        return;
    }
    const currentTime = room.state.timeRemaining;
    const threshold = params.thresholdBelowSeconds;
    const addAmount = currentTime < threshold ? params.ifBelowAdd : params.elseAdd;
    
    if (typeof addAmount === "number") {
        room.state.timeRemaining = Math.max(0, room.state.timeRemaining + addAmount);
        room.broadcast("TIMER_UPDATE", {
            timeRemaining: room.state.timeRemaining,
            enabled: room.state.timerEnabled
        });
        console.log(`[EffectProcessor] TIMER_ADD_CONDITIONAL: Added ${addAmount} seconds (current: ${currentTime}, threshold: ${threshold}), new time: ${room.state.timeRemaining}`);
    }
}

function processTimerAddIfSuggestersLt(room, params, targetTeamId) {
    if (!params || typeof params.suggestersLessThan !== "number") {
        console.warn("[EffectProcessor] TIMER_ADD_IF_SUGGESTERS_LT: Invalid params", params);
        return;
    }
    const targetTeam = room.state.teams.get(targetTeamId);
    if (!targetTeam) return;
    
    const suggesterCount = targetTeam.suggesters ? targetTeam.suggesters.length : 0;
    if (suggesterCount < params.suggestersLessThan) {
        const addAmount = params.addSeconds || 0;
        room.state.timeRemaining = Math.max(0, room.state.timeRemaining + addAmount);
        room.broadcast("TIMER_UPDATE", {
            timeRemaining: room.state.timeRemaining,
            enabled: room.state.timerEnabled
        });
        console.log(`[EffectProcessor] TIMER_ADD_IF_SUGGESTERS_LT: Added ${addAmount} seconds (suggesters: ${suggesterCount} < ${params.suggestersLessThan}), new time: ${room.state.timeRemaining}`);
    }
}

// Suggestion Effects

function processSuggestionMuteReceive(room, params, targetTeamId, effect) {
    if (!params || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] SUGGESTION_MUTE_RECEIVE: Invalid params", params);
        return;
    }
    // Store mute effect in activeEffects - QuizRoom will check this
    // Effect already stored in room.state.activeEffects by cardSystem
    console.log(`[EffectProcessor] SUGGESTION_MUTE_RECEIVE: Muting suggestions for team ${targetTeamId} for ${params.durationSeconds} seconds`);
}

function processSuggestionDelay(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.delaySeconds !== "number") {
        console.warn("[EffectProcessor] SUGGESTION_DELAY: Invalid params", params);
        return;
    }
    
    // Check shield
    if (cardSystem && cardSystem.hasShield(targetTeamId, "SUGGESTION_DELAY")) {
        console.log(`[EffectProcessor] SUGGESTION_DELAY: Blocked by shield for team ${targetTeamId}`);
        return;
    }
    
    // Store delay effect - QuizRoom will apply delay when suggestions arrive
    // Effect already stored in room.state.activeEffects by cardSystem
    console.log(`[EffectProcessor] SUGGESTION_DELAY: Delaying suggestions for team ${targetTeamId} by ${params.delaySeconds} seconds`);
}

// Writer Swap Effects

function processWriterSwap(room, params, targetTeamId, effect) {
    if (!room.swapWriter) {
        console.warn("[EffectProcessor] WRITER_SWAP: swapWriter function not available");
        return;
    }
    const mode = params.mode || "swapWithRandomSuggester";
    const durationSeconds = params.durationSeconds;
    const revert = params.revert || false;
    
    room.swapWriter(targetTeamId, mode, durationSeconds, revert, effect);
    console.log(`[EffectProcessor] WRITER_SWAP: Swapping writer for team ${targetTeamId}, mode: ${mode}, duration: ${durationSeconds}, revert: ${revert}`);
}

function processWriterDoubleSwap(room, params, targetTeamId, effect) {
    if (!room.swapWriter) {
        console.warn("[EffectProcessor] WRITER_DOUBLE_SWAP: swapWriter function not available");
        return;
    }
    // First swap immediately
    const firstSwap = params.firstSwap || "randomSuggester";
    room.swapWriter(targetTeamId, firstSwap, null, false, effect);
    
    // Schedule second swap
    const secondSwapAfterSeconds = params.secondSwapAfterSeconds || 8;
    setTimeout(() => {
        const secondSwap = params.secondSwap || "randomSuggester";
        room.swapWriter(targetTeamId, secondSwap, null, false, effect);
        console.log(`[EffectProcessor] WRITER_DOUBLE_SWAP: Second swap executed for team ${targetTeamId}`);
    }, secondSwapAfterSeconds * 1000);
    
    console.log(`[EffectProcessor] WRITER_DOUBLE_SWAP: First swap executed, second swap scheduled in ${secondSwapAfterSeconds} seconds`);
}

function processWriterRoulette(room, params, targetTeamId, effect) {
    if (!room.swapWriter) {
        console.warn("[EffectProcessor] WRITER_ROULETTE: swapWriter function not available");
        return;
    }
    room.swapWriter(targetTeamId, "roulette", null, false, effect);
    console.log(`[EffectProcessor] WRITER_ROULETTE: Roulette swap for team ${targetTeamId}`);
}

function processImmunity(room, params, targetTeamId, effect) {
    // Store immunity effect - will be checked before applying swap effects
    // Effect already stored in room.state.activeEffects by cardSystem
    const blocksEffectTypes = params.blocksEffectTypes || [];
    console.log(`[EffectProcessor] IMMUNITY: Granting immunity to team ${targetTeamId} against: ${blocksEffectTypes.join(", ")}`);
}

// Shield Effects

function processShieldNegativeNext(room, params, targetTeamId, effect, cardSystem) {
    // Store shield in cardSystem's shield tracking
    if (!cardSystem || !cardSystem.addShield) {
        console.warn("[EffectProcessor] SHIELD_NEGATIVE_NEXT: addShield function not available");
        return;
    }
    const expiresSeconds = params.expiresSeconds || null;
    cardSystem.addShield(targetTeamId, "NEGATIVE_NEXT", expiresSeconds);
    console.log(`[EffectProcessor] SHIELD_NEGATIVE_NEXT: Shield granted to team ${targetTeamId}, expires: ${expiresSeconds || "never"}`);
}

function processShieldRecharge(room, params, targetTeamId, effect, cardSystem) {
    if (!cardSystem || !cardSystem.rechargeShield) {
        console.warn("[EffectProcessor] SHIELD_RECHARGE: rechargeShield function not available");
        return;
    }
    const extendSeconds = params.extendSeconds || 10;
    const fallbackGrant = params.fallbackGrant;
    cardSystem.rechargeShield(targetTeamId, extendSeconds, fallbackGrant);
    console.log(`[EffectProcessor] SHIELD_RECHARGE: Recharging shield for team ${targetTeamId}, extend: ${extendSeconds} seconds`);
}

// Gold Effects

function processGoldGain(room, params, targetTeamId) {
    if (!params || typeof params.amount !== "number") {
        console.warn("[EffectProcessor] GOLD_GAIN: Invalid params", params);
        return;
    }
    const targetTeam = room.state.teams.get(targetTeamId);
    if (!targetTeam) return;
    
    const amount = Math.max(0, params.amount);
    targetTeam.gold += amount;
    room.state.gold.set(targetTeamId, targetTeam.gold);
    room.broadcastGoldUpdate();
    console.log(`[EffectProcessor] GOLD_GAIN: Added ${amount} gold to team ${targetTeamId}, new gold: ${targetTeam.gold}`);
}

// Multi Effects

function processMulti(room, params, casterTeamId, targetTeamId, cardSystem) {
    if (!params || !Array.isArray(params.parts)) {
        console.warn("[EffectProcessor] MULTI: Invalid params", params);
        return;
    }
    
    // Process each part sequentially
    params.parts.forEach((part, index) => {
        if (!part.type) {
            console.warn(`[EffectProcessor] MULTI: Part ${index} missing type`, part);
            return;
        }
        
        // Create temporary effect for this part
        const partEffect = {
            effectType: part.type,
            effectParams: { ...part },
            casterTeamId: casterTeamId,
            targetTeamId: targetTeamId
        };
        
        // Process this part
        processEffect(partEffect, room, cardSystem);
    });
    
    console.log(`[EffectProcessor] MULTI: Processed ${params.parts.length} effect parts`);
}

// Card Catalog v1: Timer Effect Handlers

function processTimerPause(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] TIMER_PAUSE: Invalid params", params);
        return;
    }
    const pausedUntil = Date.now() + (params.durationSeconds * 1000);
    cardSystem.timerPaused.set(targetTeamId, { pausedUntil });
    console.log(`[EffectProcessor] TIMER_PAUSE: Timer paused for team ${targetTeamId} until ${new Date(pausedUntil).toISOString()}`);
}

function processTimerProtect(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] TIMER_PROTECT: Invalid params", params);
        return;
    }
    const protectedUntil = Date.now() + (params.durationSeconds * 1000);
    cardSystem.timerProtected.set(targetTeamId, { protectedUntil });
    console.log(`[EffectProcessor] TIMER_PROTECT: Timer protected for team ${targetTeamId} until ${new Date(protectedUntil).toISOString()}`);
}

function processTimerRateMult(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.multiplier !== "number" || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] TIMER_RATE_MULT: Invalid params", params);
        return;
    }
    const expiresAt = Date.now() + (params.durationSeconds * 1000);
    cardSystem.timerRateMultipliers.set(targetTeamId, { multiplier: params.multiplier, expiresAt });
    console.log(`[EffectProcessor] TIMER_RATE_MULT: Timer rate ${params.multiplier}x for team ${targetTeamId} until ${new Date(expiresAt).toISOString()}`);
}

function processTimerLoan(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.gainSeconds !== "number" || typeof params.repaySeconds !== "number" || typeof params.repayAfterSeconds !== "number") {
        console.warn("[EffectProcessor] TIMER_LOAN: Invalid params", params);
        return;
    }
    // Immediately add gain seconds
    const gainSeconds = Math.max(0, params.gainSeconds);
    room.state.timeRemaining = Math.max(0, room.state.timeRemaining + gainSeconds);
    room.broadcast("TIMER_UPDATE", {
        timeRemaining: room.state.timeRemaining,
        enabled: room.state.timerEnabled
    });
    console.log(`[EffectProcessor] TIMER_LOAN: Added ${gainSeconds} seconds immediately, new time: ${room.state.timeRemaining}`);
    
    // Schedule repayment
    setTimeout(() => {
        const repaySeconds = Math.max(0, params.repaySeconds);
        room.state.timeRemaining = Math.max(0, room.state.timeRemaining - repaySeconds);
        room.broadcast("TIMER_UPDATE", {
            timeRemaining: room.state.timeRemaining,
            enabled: room.state.timerEnabled
        });
        console.log(`[EffectProcessor] TIMER_LOAN: Repaid ${repaySeconds} seconds, new time: ${room.state.timeRemaining}`);
    }, params.repayAfterSeconds * 1000);
}

function processTimerOvertimeClause(room, params, targetTeamId, effect, cardSystem) {
    // Effect is stored in activeEffects, checked in timer tick when time hits 0
    // No immediate action needed
    console.log(`[EffectProcessor] TIMER_OVERTIME_CLAUSE: Overtime clause active for team ${targetTeamId}`);
}

function processTimerStartDelay(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.delaySeconds !== "number") {
        console.warn("[EffectProcessor] TIMER_START_DELAY: Invalid params", params);
        return;
    }
    const delayUntil = Date.now() + (params.delaySeconds * 1000);
    cardSystem.timerStartDelayed.set(targetTeamId, { delayUntil });
    console.log(`[EffectProcessor] TIMER_START_DELAY: Timer start delayed for team ${targetTeamId} until ${new Date(delayUntil).toISOString()}`);
}

function processTimerInsurance(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.insuredSeconds !== "number") {
        console.warn("[EffectProcessor] TIMER_INSURANCE: Invalid params", params);
        return;
    }
    cardSystem.timerInsurance.set(targetTeamId, { insuredSeconds: params.insuredSeconds });
    console.log(`[EffectProcessor] TIMER_INSURANCE: ${params.insuredSeconds} seconds insured for team ${targetTeamId}`);
}

// Card Catalog v1: Suggestion Effect Handlers

function processSuggestPanelHide(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] SUGGEST_PANEL_HIDE: Invalid params", params);
        return;
    }
    const hiddenUntil = Date.now() + (params.durationSeconds * 1000);
    cardSystem.suggestionPanelHidden.set(targetTeamId, { hiddenUntil });
    room.broadcastToTeam(targetTeamId, "SUGGESTION_PANEL_HIDDEN", {});
    console.log(`[EffectProcessor] SUGGEST_PANEL_HIDE: Panel hidden for team ${targetTeamId} until ${new Date(hiddenUntil).toISOString()}`);
}

function processSuggestPriorityChannel(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.topCount !== "number" || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] SUGGEST_PRIORITY_CHANNEL: Invalid params", params);
        return;
    }
    const expiresAt = Date.now() + (params.durationSeconds * 1000);
    cardSystem.suggestionPriorityMode.set(targetTeamId, { topCount: params.topCount, expiresAt });
    console.log(`[EffectProcessor] SUGGEST_PRIORITY_CHANNEL: Priority mode (top ${params.topCount}) for team ${targetTeamId} until ${new Date(expiresAt).toISOString()}`);
}

function processSuggestQueueClear(room, params, targetTeamId, effect, cardSystem) {
    const targetTeam = room.state.teams.get(targetTeamId);
    if (!targetTeam) return;
    
    targetTeam.suggestions.clear();
    room.broadcastToTeam(targetTeamId, "SUGGESTION_QUEUE_CLEARED", {});
    console.log(`[EffectProcessor] SUGGEST_QUEUE_CLEAR: Cleared suggestions for team ${targetTeamId}`);
}

function processSuggestBroadcastMode(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] SUGGEST_BROADCAST_MODE: Invalid params", params);
        return;
    }
    const expiresAt = Date.now() + (params.durationSeconds * 1000);
    cardSystem.suggestionBroadcastMode.set(targetTeamId, { expiresAt });
    console.log(`[EffectProcessor] SUGGEST_BROADCAST_MODE: Broadcast mode for team ${targetTeamId} until ${new Date(expiresAt).toISOString()}`);
}

function processSuggestPingMute(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] SUGGEST_PING_MUTE: Invalid params", params);
        return;
    }
    const mutedUntil = Date.now() + (params.durationSeconds * 1000);
    cardSystem.suggestionPingsMuted.set(targetTeamId, { mutedUntil });
    console.log(`[EffectProcessor] SUGGEST_PING_MUTE: Pings muted for team ${targetTeamId} until ${new Date(mutedUntil).toISOString()}`);
}

function processSuggestCharLimit(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.maxChars !== "number" || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] SUGGEST_CHAR_LIMIT: Invalid params", params);
        return;
    }
    const expiresAt = Date.now() + (params.durationSeconds * 1000);
    cardSystem.suggestionCharLimit.set(targetTeamId, { maxChars: params.maxChars, expiresAt });
    console.log(`[EffectProcessor] SUGGEST_CHAR_LIMIT: ${params.maxChars} char limit for team ${targetTeamId} until ${new Date(expiresAt).toISOString()}`);
}

// Card Catalog v1: Writer/Role Effect Handlers

function processWriterChoose(room, params, targetTeamId, effect, cardSystem) {
    const targetTeam = room.state.teams.get(targetTeamId);
    if (!targetTeam) return;
    
    // Send choice request to writer
    const writerClient = room.clients.find(c => c.sessionId === targetTeam.writer);
    if (writerClient) {
        writerClient.send("WRITER_CHOICE_REQUEST", {
            teamId: targetTeamId,
            suggesters: Array.from(targetTeam.suggesters || [])
        });
        console.log(`[EffectProcessor] WRITER_CHOOSE: Choice request sent to writer for team ${targetTeamId}`);
    } else {
        console.warn(`[EffectProcessor] WRITER_CHOOSE: Writer not found for team ${targetTeamId}`);
    }
}

function processWriterLock(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] WRITER_LOCK: Invalid params", params);
        return;
    }
    const lockedUntil = Date.now() + (params.durationSeconds * 1000);
    cardSystem.writerLocked.set(targetTeamId, { lockedUntil });
    console.log(`[EffectProcessor] WRITER_LOCK: Writer locked for team ${targetTeamId} until ${new Date(lockedUntil).toISOString()}`);
}

function processWriterScheduledSwap(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.swapAfterSeconds !== "number") {
        console.warn("[EffectProcessor] WRITER_SCHEDULED_SWAP: Invalid params", params);
        return;
    }
    const roundStartTime = Date.now();
    const swapAt = roundStartTime + (params.swapAfterSeconds * 1000);
    cardSystem.scheduledSwaps.set(targetTeamId, { swapAt, roundStartTime });
    
    // Announce to team
    room.broadcastToTeam(targetTeamId, "WRITER_SWAP_SCHEDULED", {
        swapAfterSeconds: params.swapAfterSeconds
    });
    
    console.log(`[EffectProcessor] WRITER_SCHEDULED_SWAP: Swap scheduled for team ${targetTeamId} in ${params.swapAfterSeconds} seconds`);
    
    // Check scheduled swaps during timer tick (will be handled in QuizRoom timer logic)
}

function processSuggesterHighlight(room, params, targetTeamId, effect, cardSystem) {
    // Requires client choice - send request
    const targetTeam = room.state.teams.get(targetTeamId);
    if (!targetTeam) return;
    
    const writerClient = room.clients.find(c => c.sessionId === targetTeam.writer);
    if (writerClient) {
        writerClient.send("SUGGESTER_HIGHLIGHT_REQUEST", {
            teamId: targetTeamId,
            suggesters: Array.from(targetTeam.suggesters || []),
            durationSeconds: params.durationSeconds || 15
        });
        console.log(`[EffectProcessor] SUGGESTER_HIGHLIGHT: Highlight request sent to writer for team ${targetTeamId}`);
    }
}

function processSuggesterSpectatorEnable(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] SUGGESTER_SPECTATOR_ENABLE: Invalid params", params);
        return;
    }
    const expiresAt = Date.now() + (params.durationSeconds * 1000);
    cardSystem.spectatorSuggestersEnabled.set(targetTeamId, { expiresAt });
    console.log(`[EffectProcessor] SUGGESTER_SPECTATOR_ENABLE: Spectator suggestions enabled for team ${targetTeamId} until ${new Date(expiresAt).toISOString()}`);
}

// Card Catalog v1: Gold/Economy Effect Handlers

function processGoldSteal(room, params, casterTeamId, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.amount !== "number") {
        console.warn("[EffectProcessor] GOLD_STEAL: Invalid params", params);
        return;
    }
    const targetTeam = room.state.teams.get(targetTeamId);
    const casterTeam = room.state.teams.get(casterTeamId);
    if (!targetTeam || !casterTeam) return;
    
    const amount = Math.min(params.amount, targetTeam.gold);
    if (amount <= 0) {
        console.log(`[EffectProcessor] GOLD_STEAL: No gold to steal from team ${targetTeamId}`);
        return;
    }
    
    targetTeam.gold -= amount;
    casterTeam.gold += amount;
    room.state.gold.set(targetTeamId, targetTeam.gold);
    room.state.gold.set(casterTeamId, casterTeam.gold);
    room.broadcastGoldUpdate();
    console.log(`[EffectProcessor] GOLD_STEAL: Stole ${amount} gold from team ${targetTeamId} to team ${casterTeamId}`);
}

function processGoldCostMod(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.modifier !== "number" || typeof params.cardCount !== "number") {
        console.warn("[EffectProcessor] GOLD_COST_MOD: Invalid params", params);
        return;
    }
    if (!cardSystem.teamGoldCostModifiers.has(targetTeamId)) {
        cardSystem.teamGoldCostModifiers.set(targetTeamId, new Map());
    }
    const teamMods = cardSystem.teamGoldCostModifiers.get(targetTeamId);
    // Apply to all cards (cardId = "*" means all cards)
    teamMods.set("*", { modifier: params.modifier, remaining: params.cardCount });
    console.log(`[EffectProcessor] GOLD_COST_MOD: +${params.modifier} gold cost for next ${params.cardCount} cards for team ${targetTeamId}`);
}

function processGoldCostDiscount(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.discount !== "number" || typeof params.cardCount !== "number") {
        console.warn("[EffectProcessor] GOLD_COST_DISCOUNT: Invalid params", params);
        return;
    }
    if (!cardSystem.teamGoldCostModifiers.has(targetTeamId)) {
        cardSystem.teamGoldCostModifiers.set(targetTeamId, new Map());
    }
    const teamMods = cardSystem.teamGoldCostModifiers.get(targetTeamId);
    // Negative modifier = discount
    teamMods.set("*", { modifier: -params.discount, remaining: params.cardCount });
    console.log(`[EffectProcessor] GOLD_COST_DISCOUNT: -${params.discount} gold cost for next ${params.cardCount} cards for team ${targetTeamId}`);
}

function processGoldInterest(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.rate !== "number" || typeof params.maxGain !== "number") {
        console.warn("[EffectProcessor] GOLD_INTEREST: Invalid params", params);
        return;
    }
    cardSystem.goldInterest.set(targetTeamId, { rate: params.rate, maxGain: params.maxGain });
    console.log(`[EffectProcessor] GOLD_INTEREST: Interest active for team ${targetTeamId} (rate: ${params.rate}, max: ${params.maxGain})`);
    // Interest will be calculated at round end
}

function processGoldDelayedGain(room, params, targetTeamId, effect, cardSystem) {
    if (!params || !Array.isArray(params.gains)) {
        console.warn("[EffectProcessor] GOLD_DELAYED_GAIN: Invalid params", params);
        return;
    }
    params.gains.forEach((gain, index) => {
        if (typeof gain.amount === "number" && typeof gain.afterSeconds === "number") {
            setTimeout(() => {
                const targetTeam = room.state.teams.get(targetTeamId);
                if (!targetTeam) return;
                targetTeam.gold += gain.amount;
                room.state.gold.set(targetTeamId, targetTeam.gold);
                room.broadcastGoldUpdate();
                console.log(`[EffectProcessor] GOLD_DELAYED_GAIN: Gained ${gain.amount} gold for team ${targetTeamId} (delayed gain ${index + 1})`);
            }, gain.afterSeconds * 1000);
        }
    });
}

function processGoldRefundOnBlock(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.cardCount !== "number") {
        console.warn("[EffectProcessor] GOLD_REFUND_ON_BLOCK: Invalid params", params);
        return;
    }
    cardSystem.goldRefundOnBlock.set(targetTeamId, { cardCount: params.cardCount, lastCardCost: 0 });
    console.log(`[EffectProcessor] GOLD_REFUND_ON_BLOCK: Refund policy active for team ${targetTeamId} (next ${params.cardCount} cards)`);
}

function processGoldInflation(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.modifier !== "number" || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] GOLD_INFLATION: Invalid params", params);
        return;
    }
    const expiresAt = Date.now() + (params.durationSeconds * 1000);
    cardSystem.goldInflation = { modifier: params.modifier, expiresAt };
    console.log(`[EffectProcessor] GOLD_INFLATION: Global inflation +${params.modifier} gold until ${new Date(expiresAt).toISOString()}`);
}

// Card Catalog v1: Defense Effect Handlers

function processEffectReflect(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.cardCount !== "number") {
        console.warn("[EffectProcessor] EFFECT_REFLECT: Invalid params", params);
        return;
    }
    cardSystem.effectReflect.set(targetTeamId, { cardCount: params.cardCount });
    console.log(`[EffectProcessor] EFFECT_REFLECT: Reflect active for team ${targetTeamId} (next ${params.cardCount} cards)`);
}

function processEffectCleanse(room, params, targetTeamId, effect, cardSystem) {
    const targetTeam = room.state.teams.get(targetTeamId);
    if (!targetTeam) return;
    
    // Remove all negative active effects
    const negativeEffectTypes = [
        "TIMER_SUBTRACT", "SUGGESTION_DELAY", "SUGGESTION_MUTE_RECEIVE",
        "SCREEN_SHAKE", "SCREEN_BLUR", "SCREEN_DISTORT", "MICRO_DISTRACTION",
        "SUGGEST_PANEL_HIDE", "SUGGEST_CHAR_LIMIT", "CAST_LOCKOUT"
    ];
    
    const activeEffect = room.state.activeEffects.get(targetTeamId);
    if (activeEffect && negativeEffectTypes.includes(activeEffect.effectType)) {
        room.state.activeEffects.delete(targetTeamId);
        console.log(`[EffectProcessor] EFFECT_CLEANSE: Removed negative effect ${activeEffect.effectType} from team ${targetTeamId}`);
    }
    
    room.broadcastToTeam(targetTeamId, "EFFECTS_CLEANSED", {});
    console.log(`[EffectProcessor] EFFECT_CLEANSE: Cleansed negative effects for team ${targetTeamId}`);
}

function processEffectImmunityDisruption(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] EFFECT_IMMUNITY_DISRUPTION: Invalid params", params);
        return;
    }
    if (!cardSystem.effectImmunity.has(targetTeamId)) {
        cardSystem.effectImmunity.set(targetTeamId, new Set());
    }
    const immunitySet = cardSystem.effectImmunity.get(targetTeamId);
    const disruptionTypes = ["SCREEN_SHAKE", "SCREEN_BLUR", "SCREEN_DISTORT", "MICRO_DISTRACTION", "UI_OVERLAY_FOG", "UI_CURSOR_MIRAGE", "UI_PANEL_SWAP", "UI_DIM_INPUT"];
    disruptionTypes.forEach(type => immunitySet.add(type));
    console.log(`[EffectProcessor] EFFECT_IMMUNITY_DISRUPTION: Immunity granted to team ${targetTeamId} against disruption effects`);
}

function processEffectImmunityComms(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.durationSeconds !== "number") {
        console.warn("[EffectProcessor] EFFECT_IMMUNITY_COMMS: Invalid params", params);
        return;
    }
    if (!cardSystem.effectImmunity.has(targetTeamId)) {
        cardSystem.effectImmunity.set(targetTeamId, new Set());
    }
    const immunitySet = cardSystem.effectImmunity.get(targetTeamId);
    const commsTypes = ["SUGGESTION_MUTE_RECEIVE", "SUGGESTION_DELAY", "SUGGEST_PANEL_HIDE", "SUGGEST_CHAR_LIMIT", "SUGGEST_PING_MUTE"];
    commsTypes.forEach(type => immunitySet.add(type));
    console.log(`[EffectProcessor] EFFECT_IMMUNITY_COMMS: Immunity granted to team ${targetTeamId} against comms effects`);
}

function processEffectDecoy(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.cardCount !== "number") {
        console.warn("[EffectProcessor] EFFECT_DECOY: Invalid params", params);
        return;
    }
    cardSystem.effectDecoy.set(targetTeamId, { cardCount: params.cardCount });
    console.log(`[EffectProcessor] EFFECT_DECOY: Decoy active for team ${targetTeamId} (next ${params.cardCount} cards)`);
}

// Card Catalog v1: Deck/Casting Effect Handlers

function processDeckShuffle(room, params, targetTeamId, effect, cardSystem) {
    const targetTeam = room.state.teams.get(targetTeamId);
    if (!targetTeam || !targetTeam.deckSlots) return;
    
    // Get all non-null cards
    const cards = Array.from(targetTeam.deckSlots).filter(c => c !== null);
    if (cards.length === 0) return;
    
    // Fisher-Yates shuffle
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    
    // Reassign to deck slots
    targetTeam.deckSlots.clear();
    for (let i = 0; i < 4; i++) {
        targetTeam.deckSlots.push(i < cards.length ? cards[i] : null);
    }
    
    room.broadcastToTeam(targetTeamId, "DECK_SHUFFLED", {});
    console.log(`[EffectProcessor] DECK_SHUFFLE: Shuffled deck for team ${targetTeamId}`);
}

function processDeckMoveCard(room, params, casterTeamId, targetTeamId, effect, cardSystem) {
    // Requires client choice - send request
    const casterClient = room.clients.find(c => {
        const { team } = cardSystem.findTeamForClient(c);
        return team && Array.from(room.state.teams.entries()).find(([id, t]) => t === team)?.[0] === casterTeamId;
    });
    if (casterClient) {
        const targetTeam = room.state.teams.get(targetTeamId);
        if (targetTeam && targetTeam.deckSlots) {
            const deckCards = Array.from(targetTeam.deckSlots).map((card, index) => ({ card, index })).filter(({ card }) => card !== null);
            casterClient.send("DECK_CARD_CHOICE_REQUEST", {
                teamId: targetTeamId,
                deckCards: deckCards.map(({ card }) => card)
            });
            console.log(`[EffectProcessor] DECK_MOVE_CARD: Choice request sent to caster for team ${targetTeamId}`);
        }
    }
}

function processDeckSwapSlots(room, params, casterTeamId, targetTeamId, effect, cardSystem) {
    // Requires client choice - send request
    const casterClient = room.clients.find(c => {
        const { team } = cardSystem.findTeamForClient(c);
        return team && Array.from(room.state.teams.entries()).find(([id, t]) => t === team)?.[0] === casterTeamId;
    });
    if (casterClient) {
        const targetTeam = room.state.teams.get(targetTeamId);
        if (targetTeam && targetTeam.deckSlots) {
            casterClient.send("DECK_SLOT_SWAP_REQUEST", {
                teamId: targetTeamId,
                deckSlots: Array.from(targetTeam.deckSlots)
            });
            console.log(`[EffectProcessor] DECK_SWAP_SLOTS: Swap request sent to caster for team ${targetTeamId}`);
        }
    }
}

function processDeckRecall(room, params, targetTeamId, effect, cardSystem) {
    const targetTeam = room.state.teams.get(targetTeamId);
    if (!targetTeam || !targetTeam.deckSlots) return;
    
    // Check if already used this round
    const currentRound = room.scores?.roundNumber || 0;
    if (!cardSystem.recallUsed.has(targetTeamId)) {
        cardSystem.recallUsed.set(targetTeamId, new Set());
    }
    if (cardSystem.recallUsed.get(targetTeamId).has(currentRound)) {
        console.log(`[EffectProcessor] DECK_RECALL: Already used this round for team ${targetTeamId}`);
        return;
    }
    
    // Get last cast card
    const lastCard = cardSystem.lastCastCard.get(targetTeamId);
    if (!lastCard) {
        console.log(`[EffectProcessor] DECK_RECALL: No last cast card for team ${targetTeamId}`);
        return;
    }
    
    // Find card in deck
    const deckArray = Array.from(targetTeam.deckSlots);
    const cardIndex = deckArray.findIndex(c => c === lastCard);
    if (cardIndex === -1) {
        console.log(`[EffectProcessor] DECK_RECALL: Card ${lastCard} not found in deck for team ${targetTeamId}`);
        return;
    }
    
    // Move to top
    deckArray.splice(cardIndex, 1);
    deckArray.unshift(lastCard);
    
    targetTeam.deckSlots.clear();
    deckArray.forEach(card => targetTeam.deckSlots.push(card));
    
    cardSystem.recallUsed.get(targetTeamId).add(currentRound);
    console.log(`[EffectProcessor] DECK_RECALL: Moved card ${lastCard} to top of deck for team ${targetTeamId}`);
}

function processCastLockout(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.durationSeconds !== "number" || typeof params.cardCount !== "number") {
        console.warn("[EffectProcessor] CAST_LOCKOUT: Invalid params", params);
        return;
    }
    const lockedUntil = Date.now() + (params.durationSeconds * 1000);
    cardSystem.castLockout.set(targetTeamId, { lockedUntil, cardCount: params.cardCount });
    console.log(`[EffectProcessor] CAST_LOCKOUT: Cast lockout for team ${targetTeamId} until ${new Date(lockedUntil).toISOString()} (${params.cardCount} cards)`);
}

function processCastInstant(room, params, targetTeamId, effect, cardSystem) {
    if (!params || typeof params.cardCount !== "number") {
        console.warn("[EffectProcessor] CAST_INSTANT: Invalid params", params);
        return;
    }
    cardSystem.castInstant.set(targetTeamId, { cardCount: params.cardCount });
    console.log(`[EffectProcessor] CAST_INSTANT: Instant cast for team ${targetTeamId} (next ${params.cardCount} cards)`);
}

