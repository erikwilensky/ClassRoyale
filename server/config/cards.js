// Chapter 10: Card definitions with XP-based unlock system
// Cards are purchased via shop, not unlocked by level

export const CARDS = {
    // Standard Cards (6) - Require unlock, cost gold in-match, have gameplay effects
    BRAINWAVE_BOOST: {
        id: "BRAINWAVE_BOOST",
        name: "Brainwave Boost",
        unlockCost: 150,
        type: "standard",
        cost: 2, // Gold cost in-match
        target: "opponent",
        effect: "+5 seconds on timer OR -5 seconds on opponent timer",
        description: "Gain a small time advantage or slow down your opponent"
    },
    IDEA_SHIELD: {
        id: "IDEA_SHIELD",
        name: "Idea Shield",
        unlockCost: 200,
        type: "standard",
        cost: 3,
        target: "self",
        effect: "Blocks the next negative card played against your team",
        description: "Protect your team from one negative effect"
    },
    SWAP_WRITER: {
        id: "SWAP_WRITER",
        name: "Swap Writer",
        unlockCost: 180,
        type: "standard",
        cost: 3,
        target: "self",
        effect: "Swap writer and a random suggester for this round",
        description: "Rotate team roles mid-round"
    },
    FOCUS_DRAFT: {
        id: "FOCUS_DRAFT",
        name: "Focus Draft",
        unlockCost: 120,
        type: "standard",
        cost: 2,
        target: "self",
        effect: "Writer cannot receive suggestions for 10 seconds",
        description: "Focus mode: writer works alone briefly"
    },
    SLOW_SUGGESTION: {
        id: "SLOW_SUGGESTION",
        name: "Slow Suggestion",
        unlockCost: 160,
        type: "standard",
        cost: 2,
        target: "opponent",
        effect: "Opponent suggestions delayed by 2 seconds",
        description: "Create subtle friction for opponent team"
    },
    GOLD_RUSH: {
        id: "GOLD_RUSH",
        name: "Gold Rush",
        unlockCost: 250,
        type: "standard",
        cost: 0, // Free to cast once unlocked
        target: "self",
        effect: "+1 gold immediately",
        description: "Quick gold boost for your team"
    },
    // Legacy cards re-introduced with XP costs
    SHAKE: {
        id: "SHAKE",
        name: "Shake",
        unlockCost: 100,
        type: "standard",
        cost: 3,
        target: "opponent",
        effect: "Disrupts opponent's writing with screen shake effect",
        description: "Shake your opponent's screen to disrupt their focus"
    },
    BLUR: {
        id: "BLUR",
        name: "Blur",
        unlockCost: 80,
        type: "standard",
        cost: 2,
        target: "opponent",
        effect: "Blurs opponent's screen temporarily",
        description: "Blur your opponent's vision to slow them down"
    },
    DISTRACT: {
        id: "DISTRACT",
        name: "Distract",
        unlockCost: 60,
        type: "standard",
        cost: 1,
        target: "self",
        effect: "Brief distraction effect (cosmetic)",
        description: "A subtle distraction effect"
    },
    OVERCLOCK: {
        id: "OVERCLOCK",
        name: "Overclock",
        unlockCost: 220,
        type: "standard",
        cost: 4,
        target: "opponent",
        effect: "Intense disruption effect on opponent",
        description: "Maximum disruption power - expensive but effective"
    },

    // Cosmetic Cards (4) - Always usable, no gold cost, no gameplay impact
    WRITER_SPOTLIGHT: {
        id: "WRITER_SPOTLIGHT",
        name: "Writer Spotlight",
        unlockCost: 40,
        type: "cosmetic",
        cost: 0, // No gold cost
        target: "self",
        effect: "Coliseum-style spotlight ring around writer",
        description: "Make your writer shine!"
    },
    TEAM_BANNER_COLOR: {
        id: "TEAM_BANNER_COLOR",
        name: "Team Banner Color",
        unlockCost: 60,
        type: "cosmetic",
        cost: 0,
        target: "self",
        effect: "Team name text gets alternate color",
        description: "Customize your team's visual identity"
    },
    VICTORY_FLOURISH: {
        id: "VICTORY_FLOURISH",
        name: "Victory Flourish",
        unlockCost: 100,
        type: "cosmetic",
        cost: 0,
        target: "self",
        effect: "Confetti animation on match win",
        description: "Celebrate victory in style"
    },
    SIGNATURE_STYLE: {
        id: "SIGNATURE_STYLE",
        name: "Signature Style",
        unlockCost: 80,
        type: "cosmetic",
        cost: 0,
        target: "self",
        effect: "Writer input box glow or border variant",
        description: "Personalize your writing experience"
    }
};

/**
 * Get all cards
 * Chapter 10: Returns all cards with their properties
 */
export function getAllCards() {
    return Object.values(CARDS);
}

/**
 * Get card by ID
 * Chapter 10: Returns card object or null
 */
export function getCardById(cardId) {
    return CARDS[cardId] || null;
}

/**
 * Get cards by type
 * Chapter 10: Returns cards filtered by type (standard or cosmetic)
 */
export function getCardsByType(type) {
    return Object.values(CARDS).filter(card => card.type === type);
}

/**
 * Get unlock cost for a card
 * Chapter 10: Returns XP cost to unlock card
 */
export function getCardUnlockCost(cardId) {
    const card = CARDS[cardId];
    return card ? card.unlockCost : null;
}
