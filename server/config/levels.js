// Level thresholds configuration
export const LEVEL_THRESHOLDS = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 100 },
    { level: 3, xpRequired: 250 },
    { level: 4, xpRequired: 450 },
    { level: 5, xpRequired: 700 },
    { level: 6, xpRequired: 1000 },
    { level: 7, xpRequired: 1350 },
    { level: 8, xpRequired: 1750 },
    { level: 9, xpRequired: 2200 },
    { level: 10, xpRequired: 2700 }
];

/**
 * Get the level for a given XP amount
 */
export function getLevelForXP(xp) {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (xp >= LEVEL_THRESHOLDS[i].xpRequired) {
            return LEVEL_THRESHOLDS[i].level;
        }
    }
    return 1;
}

/**
 * Get the XP required for the next level
 */
export function getXPForNextLevel(currentXP) {
    const currentLevel = getLevelForXP(currentXP);
    const nextLevelThreshold = LEVEL_THRESHOLDS.find(t => t.level === currentLevel + 1);
    
    if (!nextLevelThreshold) {
        return null; // Max level reached
    }
    
    return nextLevelThreshold.xpRequired - currentXP;
}

/**
 * Get the current level's XP range
 */
export function getLevelRange(level) {
    const threshold = LEVEL_THRESHOLDS.find(t => t.level === level);
    const nextThreshold = LEVEL_THRESHOLDS.find(t => t.level === level + 1);
    
    return {
        minXP: threshold ? threshold.xpRequired : 0,
        maxXP: nextThreshold ? nextThreshold.xpRequired - 1 : Infinity
    };
}



