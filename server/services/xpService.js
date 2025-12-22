import { db } from "../db/database.js";
import { getLevelForXP } from "../config/levels.js";

/**
 * Award XP to a player and check for level ups
 * Chapter 10: Also updates availableXP (spendable XP)
 * Returns { newXP, newLevel, newAvailableXP, levelUp: boolean }
 */
export function awardXP(playerId, amount, reason) {
    if (!playerId || amount <= 0) {
        return null;
    }

    // Log XP award
    console.log(`[XP] Player ${playerId}: +${amount} XP (reason: ${reason})`);

    // Get current player data
    const player = db.prepare("SELECT xp, level, availableXP FROM players WHERE id = ?").get(playerId);
    if (!player) {
        console.error(`[XP] Player not found: ${playerId}`);
        return null;
    }

    const oldXP = player.xp;
    const oldLevel = player.level;
    const oldAvailableXP = player.availableXP || 0;
    const newXP = oldXP + amount;
    const newAvailableXP = oldAvailableXP + amount; // Chapter 10: Also add to availableXP
    const newLevel = getLevelForXP(newXP);

    // Update XP in database (both total and available)
    db.prepare("UPDATE players SET xp = ?, level = ?, availableXP = ? WHERE id = ?")
        .run(newXP, newLevel, newAvailableXP, playerId);

    const levelUp = newLevel > oldLevel;

    return {
        newXP,
        newLevel,
        newAvailableXP,
        levelUp
    };
}

/**
 * Spend XP (deduct from availableXP only, not totalXP)
 * Chapter 10: Used for card purchases
 * Returns { success: boolean, newAvailableXP: number, error?: string }
 */
export function spendXP(playerId, amount) {
    if (!playerId || amount <= 0) {
        return { success: false, error: "Invalid player ID or amount" };
    }

    // Get current availableXP
    const player = db.prepare("SELECT availableXP FROM players WHERE id = ?").get(playerId);
    if (!player) {
        return { success: false, error: "Player not found" };
    }

    const currentAvailableXP = player.availableXP || 0;

    if (currentAvailableXP < amount) {
        return { 
            success: false, 
            error: "Insufficient XP",
            newAvailableXP: currentAvailableXP
        };
    }

    const newAvailableXP = currentAvailableXP - amount;

    // Deduct from availableXP only (not totalXP)
    db.prepare("UPDATE players SET availableXP = ? WHERE id = ?")
        .run(newAvailableXP, playerId);

    console.log(`[XP] Player ${playerId} spent ${amount} XP. Remaining: ${newAvailableXP}`);

    return {
        success: true,
        newAvailableXP
    };
}

/**
 * Get player progress (XP and unlocked cards)
 * Chapter 10: Returns totalXP, availableXP, level, and unlocked cards
 */
export function getPlayerProgress(playerId) {
    if (!playerId) {
        return null;
    }

    const player = db.prepare("SELECT xp, level, availableXP FROM players WHERE id = ?").get(playerId);
    if (!player) {
        return null;
    }

    // Get unlocked cards
    const unlocks = db.prepare(
        "SELECT cardId FROM unlocks WHERE playerId = ?"
    ).all(playerId);

    const unlockedCards = unlocks.map(row => row.cardId);

    return {
        totalXP: player.xp || 0,
        availableXP: player.availableXP || 0,
        level: player.level || 1,
        unlockedCards
    };
}

/**
 * Flush accumulated XP from cache to database
 * Chapter 10: Now also updates availableXP
 * xpCache format: { totalXP: number, reasons: string[] }
 */
export function flushXP(playerId, xpCache) {
    if (!playerId || !xpCache || xpCache.totalXP <= 0) {
        return null;
    }

    // Combine all reasons into a single log message
    const reasonsStr = xpCache.reasons.join(", ");
    
    // Award the accumulated XP (now also updates availableXP)
    const result = awardXP(playerId, xpCache.totalXP, `Match completion: ${reasonsStr}`);
    
    console.log(`[XP] Flushed ${xpCache.totalXP} XP for player ${playerId}`);
    
    return result;
}

/**
 * Get player's unlocked cards
 */
export function getPlayerUnlockedCards(playerId) {
    const unlocks = db.prepare(
        "SELECT cardId FROM unlocks WHERE playerId = ?"
    ).all(playerId);
    
    return unlocks.map(row => row.cardId);
}


