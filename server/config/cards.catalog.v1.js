// Card Catalog v1 (50 cards) - Updated specification
// 40 Standard gameplay cards (10 existing + 30 new)
// 10 Cosmetic cards (4 existing + 6 from previous catalog)
// Schema is intentionally explicit so client/shop/deck builder can render reliably,
// and server can validate decks + casts consistently.
//
// Implementation Status:
// - Cards marked with meta.implemented = true are the original 10 cards that work via cardId matching
// - Cards with meta.implemented = false have effect types not yet implemented in cardSystem

// Mapping of catalog IDs to legacy IDs for the 10 existing standard cards
const LEGACY_ID_MAP = {
  "brainwave-boost": "BRAINWAVE_BOOST",
  "focus-draft": "FOCUS_DRAFT",
  "slow-suggestion": "SLOW_SUGGESTION",
  "swap-writer": "SWAP_WRITER",
  "idea-shield": "IDEA_SHIELD",
  "gold-rush": "GOLD_RUSH",
  "shake": "SHAKE",
  "overclock": "OVERCLOCK",
  "blur": "BLUR",
  "distract": "DISTRACT"
};

// Set of catalog IDs that are the original 10 standard cards (implemented)
const IMPLEMENTED_CARD_IDS = new Set(Object.keys(LEGACY_ID_MAP));

// Helper to determine if a card is implemented
function isCardImplemented(cardId) {
  return IMPLEMENTED_CARD_IDS.has(cardId);
}

// Helper to get legacy ID from catalog ID
export function getLegacyIdFromCatalogId(catalogId) {
  return LEGACY_ID_MAP[catalogId] || null;
}

// Helper to get catalog ID from legacy ID
export function getCatalogIdFromLegacyId(legacyId) {
  for (const [catalogId, mappedLegacyId] of Object.entries(LEGACY_ID_MAP)) {
    if (mappedLegacyId === legacyId) {
      return catalogId;
    }
  }
  return null;
}

const CARD_CATALOG_V1_ARRAY = [
  // -----------------------------
  // A) STANDARD (Gameplay) — 40
  // -----------------------------

  // 1) Tempo and Time Control (8)
  {
    id: "brainwave-boost",
    name: "Brainwave Boost",
    kind: "standard",
    category: "tempo_time_control",
    target: "opponent",
    unlockXp: 150,
    baseGoldCost: 2,
    description: "Small tempo swing.",
    effect: { type: "TIMER_TEMPO_SWING", selfAddSeconds: 5, oppSubSeconds: 5 },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "time-freeze",
    name: "Time Freeze",
    kind: "standard",
    category: "tempo_time_control",
    target: "opponent",
    unlockXp: 320,
    baseGoldCost: 4,
    description: "Pause opponent timer for 3 seconds (timer does not tick down).",
    effect: { type: "TIMER_PAUSE", durationSeconds: 3 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "time-anchor",
    name: "Time Anchor",
    kind: "standard",
    category: "tempo_time_control",
    target: "self",
    unlockXp: 260,
    baseGoldCost: 3,
    description: "Your team is immune to time subtraction effects for 12 seconds.",
    effect: { type: "TIMER_PROTECT", durationSeconds: 12 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "accelerate",
    name: "Accelerate",
    kind: "standard",
    category: "tempo_time_control",
    target: "opponent",
    unlockXp: 340,
    baseGoldCost: 4,
    description: "Opponent timer ticks 25% faster for 10 seconds.",
    effect: { type: "TIMER_RATE_MULT", multiplier: 1.25, durationSeconds: 10 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "borrowed-seconds",
    name: "Borrowed Seconds",
    kind: "standard",
    category: "tempo_time_control",
    target: "self",
    unlockXp: 220,
    baseGoldCost: 2,
    description: "Gain +8s now, but after 12s lose -4s.",
    effect: { type: "TIMER_LOAN", gainSeconds: 8, repaySeconds: 4, repayAfterSeconds: 12 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "overtime-clause",
    name: "Overtime Clause",
    kind: "standard",
    category: "tempo_time_control",
    target: "self",
    unlockXp: 280,
    baseGoldCost: 3,
    description: "If your timer would hit 0 this round, set it to 5 seconds instead (once per round).",
    effect: { type: "TIMER_OVERTIME_CLAUSE", safetySeconds: 5 },
    limits: { scope: "round", perTeam: 1 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "starting-delay",
    name: "Starting Delay",
    kind: "standard",
    category: "tempo_time_control",
    target: "opponent",
    unlockXp: 250,
    baseGoldCost: 3,
    description: "Opponent timer does not start ticking down for the next 3 seconds.",
    effect: { type: "TIMER_START_DELAY", delaySeconds: 3 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "time-insurance",
    name: "Time Insurance",
    kind: "standard",
    category: "tempo_time_control",
    target: "self",
    unlockXp: 200,
    baseGoldCost: 2,
    description: "Store 4 \"insured seconds\". The next time you lose time, refund up to 4s.",
    effect: { type: "TIMER_INSURANCE", insuredSeconds: 4 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },

  // 2) Suggestion and Communication Control (8)
  {
    id: "focus-draft",
    name: "Focus Draft",
    kind: "standard",
    category: "suggestion_communication_control",
    target: "self",
    unlockXp: 120,
    baseGoldCost: 2,
    description: "Writer cannot receive suggestions for 10s",
    effect: { type: "SUGGESTION_MUTE_RECEIVE", durationSeconds: 10 },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "slow-suggestion",
    name: "Slow Suggestion",
    kind: "standard",
    category: "suggestion_communication_control",
    target: "opponent",
    unlockXp: 160,
    baseGoldCost: 2,
    description: "Opponent suggestions delayed by 2s",
    effect: { type: "SUGGESTION_DELAY", delaySeconds: 2 },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "signal-jammer",
    name: "Signal Jammer",
    kind: "standard",
    category: "suggestion_communication_control",
    target: "opponent",
    unlockXp: 260,
    baseGoldCost: 3,
    description: "Opponent suggestion panel collapses/hidden for 6 seconds (suggesters can still type).",
    effect: { type: "SUGGEST_PANEL_HIDE", durationSeconds: 6 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "priority-channel",
    name: "Priority Channel",
    kind: "standard",
    category: "suggestion_communication_control",
    target: "self",
    unlockXp: 180,
    baseGoldCost: 2,
    description: "For 10 seconds, only the top 1 suggester's messages appear to the writer (others still send).",
    effect: { type: "SUGGEST_PRIORITY_CHANNEL", topCount: 1, durationSeconds: 10 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "suggestion-queue-flush",
    name: "Suggestion Queue Flush",
    kind: "standard",
    category: "suggestion_communication_control",
    target: "opponent",
    unlockXp: 280,
    baseGoldCost: 3,
    description: "Clears opponent writer's current suggestion inbox (does not stop new suggestions).",
    effect: { type: "SUGGEST_QUEUE_CLEAR" },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "broadcast-mode",
    name: "Broadcast Mode",
    kind: "standard",
    category: "suggestion_communication_control",
    target: "self",
    unlockXp: 210,
    baseGoldCost: 2,
    description: "For 8 seconds, suggestions appear larger and pinned (writer sees fewer but clearer).",
    effect: { type: "SUGGEST_BROADCAST_MODE", durationSeconds: 8 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "mute-pings",
    name: "Mute Pings",
    kind: "standard",
    category: "suggestion_communication_control",
    target: "opponent",
    unlockXp: 190,
    baseGoldCost: 2,
    description: "Opponent loses suggestion notification sounds/visual pings for 12 seconds.",
    effect: { type: "SUGGEST_PING_MUTE", durationSeconds: 12 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "one-line-rule",
    name: "One-Line Rule",
    kind: "standard",
    category: "suggestion_communication_control",
    target: "opponent",
    unlockXp: 260,
    baseGoldCost: 3,
    description: "For 10 seconds, opponent suggestions are limited to 60 characters each (server enforced).",
    effect: { type: "SUGGEST_CHAR_LIMIT", maxChars: 60, durationSeconds: 10 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },

  // 3) Roles and Team Coordination (6)
  {
    id: "swap-writer",
    name: "Swap Writer",
    kind: "standard",
    category: "roles_team_coordination",
    target: "self",
    unlockXp: 180,
    baseGoldCost: 3,
    description: "Swap writer with a random suggester for this round",
    effect: { type: "WRITER_SWAP", mode: "swapWithRandomSuggester", durationSeconds: null },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "captains-call",
    name: "Captain's Call",
    kind: "standard",
    category: "roles_team_coordination",
    target: "self",
    unlockXp: 200,
    baseGoldCost: 2,
    description: "Team leader chooses the writer (one-time immediate swap, no randomness).",
    effect: { type: "WRITER_CHOOSE", requiresClientChoice: true },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "role-lock",
    name: "Role Lock",
    kind: "standard",
    category: "roles_team_coordination",
    target: "self",
    unlockXp: 220,
    baseGoldCost: 2,
    description: "Prevent your writer role from being changed by any effect for 15 seconds.",
    effect: { type: "WRITER_LOCK", durationSeconds: 15 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "tag-team",
    name: "Tag Team",
    kind: "standard",
    category: "roles_team_coordination",
    target: "self",
    unlockXp: 260,
    baseGoldCost: 3,
    description: "Schedule an automatic writer swap at the 10-second mark (announced to your team).",
    effect: { type: "WRITER_SCHEDULED_SWAP", swapAfterSeconds: 10 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "suggester-spotlight",
    name: "Suggester Spotlight",
    kind: "standard",
    category: "roles_team_coordination",
    target: "self",
    unlockXp: 160,
    baseGoldCost: 1,
    description: "Highlight one suggester's messages (their suggestions get a \"star\" marker for 15s).",
    effect: { type: "SUGGESTER_HIGHLIGHT", durationSeconds: 15, requiresClientChoice: true },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "bench-coach",
    name: "Bench Coach",
    kind: "standard",
    category: "roles_team_coordination",
    target: "self",
    unlockXp: 210,
    baseGoldCost: 2,
    description: "Allow a non-participating teammate (spectator) to send suggestions for 12 seconds.",
    effect: { type: "SUGGESTER_SPECTATOR_ENABLE", durationSeconds: 12 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },

  // 4) Economy and Cost Manipulation (8)
  {
    id: "gold-rush",
    name: "Gold Rush",
    kind: "standard",
    category: "economy_cost_manipulation",
    target: "self",
    unlockXp: 250,
    baseGoldCost: 0,
    description: "+1 gold immediately",
    effect: { type: "GOLD_GAIN", amount: 1 },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "pickpocket",
    name: "Pickpocket",
    kind: "standard",
    category: "economy_cost_manipulation",
    target: "opponent",
    unlockXp: 240,
    baseGoldCost: 2,
    description: "Steal 1 gold from opponent (if they have it).",
    effect: { type: "GOLD_STEAL", amount: 1 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "tariff",
    name: "Tariff",
    kind: "standard",
    category: "economy_cost_manipulation",
    target: "opponent",
    unlockXp: 280,
    baseGoldCost: 3,
    description: "Opponent's next 2 cards cost +1 gold each.",
    effect: { type: "GOLD_COST_MOD", modifier: 1, cardCount: 2 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "coupon",
    name: "Coupon",
    kind: "standard",
    category: "economy_cost_manipulation",
    target: "self",
    unlockXp: 190,
    baseGoldCost: 1,
    description: "Your next card costs -1 gold (min 0).",
    effect: { type: "GOLD_COST_DISCOUNT", discount: 1, cardCount: 1 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "interest",
    name: "Interest",
    kind: "standard",
    category: "economy_cost_manipulation",
    target: "self",
    unlockXp: 320,
    baseGoldCost: 0,
    description: "At end of round, gain +1 gold for every 3 unspent gold (max +2).",
    effect: { type: "GOLD_INTEREST", rate: 3, maxGain: 2, trigger: "round_end" },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "gold-drip",
    name: "Gold Drip",
    kind: "standard",
    category: "economy_cost_manipulation",
    target: "self",
    unlockXp: 260,
    baseGoldCost: 2,
    description: "Gain +1 gold after 5 seconds, and +1 more after 10 seconds.",
    effect: { type: "GOLD_DELAYED_GAIN", gains: [{ amount: 1, afterSeconds: 5 }, { amount: 1, afterSeconds: 10 }] },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "refund-policy",
    name: "Refund Policy",
    kind: "standard",
    category: "economy_cost_manipulation",
    target: "self",
    unlockXp: 240,
    baseGoldCost: 2,
    description: "If your next card gets blocked/reflected, refund its gold cost.",
    effect: { type: "GOLD_REFUND_ON_BLOCK", cardCount: 1 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "inflation",
    name: "Inflation",
    kind: "standard",
    category: "economy_cost_manipulation",
    target: "both",
    unlockXp: 300,
    baseGoldCost: 3,
    description: "For 15 seconds, all cards cost +1 gold for everyone.",
    effect: { type: "GOLD_INFLATION", modifier: 1, durationSeconds: 15 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },

  // 5) Defense and Counterplay (6)
  {
    id: "idea-shield",
    name: "Idea Shield",
    kind: "standard",
    category: "defense_counterplay",
    target: "self",
    unlockXp: 200,
    baseGoldCost: 3,
    description: "Block next negative card",
    effect: { type: "SHIELD_NEGATIVE_NEXT", expiresSeconds: null },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "mirror-shield",
    name: "Mirror Shield",
    kind: "standard",
    category: "defense_counterplay",
    target: "self",
    unlockXp: 340,
    baseGoldCost: 4,
    description: "Reflect the next negative card back to the caster (once).",
    effect: { type: "EFFECT_REFLECT", cardCount: 1 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "cleanse",
    name: "Cleanse",
    kind: "standard",
    category: "defense_counterplay",
    target: "self",
    unlockXp: 280,
    baseGoldCost: 3,
    description: "Remove all active negative effects on your team immediately.",
    effect: { type: "EFFECT_CLEANSE" },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "disruption-immunity",
    name: "Disruption Immunity",
    kind: "standard",
    category: "defense_counterplay",
    target: "self",
    unlockXp: 220,
    baseGoldCost: 2,
    description: "Immune to visual disruption effects (blur, shake, etc.) for 15 seconds.",
    effect: { type: "EFFECT_IMMUNITY_DISRUPTION", durationSeconds: 15 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "comms-firewall",
    name: "Comms Firewall",
    kind: "standard",
    category: "defense_counterplay",
    target: "self",
    unlockXp: 260,
    baseGoldCost: 3,
    description: "Immune to suggestion interference (block/delay/panel hide) for 12 seconds.",
    effect: { type: "EFFECT_IMMUNITY_COMMS", durationSeconds: 12 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "decoy-target",
    name: "Decoy Target",
    kind: "standard",
    category: "defense_counterplay",
    target: "self",
    unlockXp: 230,
    baseGoldCost: 2,
    description: "The next opponent card targets a decoy and has no effect (once).",
    effect: { type: "EFFECT_DECOY", cardCount: 1 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },

  // 6) Deck and Casting Tactics (6)
  {
    id: "shuffle-deck",
    name: "Shuffle Deck",
    kind: "standard",
    category: "deck_casting_tactics",
    target: "self",
    unlockXp: 240,
    baseGoldCost: 2,
    description: "Shuffle your in-match deck order (filled cards only).",
    effect: { type: "DECK_SHUFFLE" },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "stack-the-top",
    name: "Stack the Top",
    kind: "standard",
    category: "deck_casting_tactics",
    target: "self",
    unlockXp: 260,
    baseGoldCost: 2,
    description: "Choose one deck card and move it to the top position.",
    effect: { type: "DECK_MOVE_CARD", position: "top", requiresClientChoice: true },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "swap-slots",
    name: "Swap Slots",
    kind: "standard",
    category: "deck_casting_tactics",
    target: "self",
    unlockXp: 190,
    baseGoldCost: 1,
    description: "Swap two deck positions (choose both).",
    effect: { type: "DECK_SWAP_SLOTS", requiresClientChoice: true },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "recall",
    name: "Recall",
    kind: "standard",
    category: "deck_casting_tactics",
    target: "self",
    unlockXp: 280,
    baseGoldCost: 3,
    description: "Return the last card you played to the top of your deck (once per round).",
    effect: { type: "DECK_RECALL" },
    limits: { scope: "round", perTeam: 1 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "lockout",
    name: "Lockout",
    kind: "standard",
    category: "deck_casting_tactics",
    target: "opponent",
    unlockXp: 350,
    baseGoldCost: 4,
    description: "Opponent cannot cast their next card for 4 seconds (they can still think/plan).",
    effect: { type: "CAST_LOCKOUT", durationSeconds: 4, cardCount: 1 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "quick-cast",
    name: "Quick Cast",
    kind: "standard",
    category: "deck_casting_tactics",
    target: "self",
    unlockXp: 240,
    baseGoldCost: 2,
    description: "Your next card casts instantly with no wind-up/animation delay.",
    effect: { type: "CAST_INSTANT", cardCount: 1 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },

  // 7) Classroom-Safe Disruption (8)
  {
    id: "shake",
    name: "Shake",
    kind: "standard",
    category: "classroom_safe_disruption",
    target: "opponent",
    unlockXp: 100,
    baseGoldCost: 3,
    description: "Screen shake",
    effect: { type: "SCREEN_SHAKE", intensity: "medium", durationSeconds: 3 },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "blur",
    name: "Blur",
    kind: "standard",
    category: "classroom_safe_disruption",
    target: "opponent",
    unlockXp: 80,
    baseGoldCost: 2,
    description: "Blur overlay",
    effect: { type: "SCREEN_BLUR", intensity: "medium", durationSeconds: 6 },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "overclock",
    name: "Overclock",
    kind: "standard",
    category: "classroom_safe_disruption",
    target: "opponent",
    unlockXp: 220,
    baseGoldCost: 4,
    description: "Intense disruption",
    effect: { type: "SCREEN_DISTORT", intensity: "high", durationSeconds: 4 },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "distract",
    name: "Distract",
    kind: "standard",
    category: "classroom_safe_disruption",
    target: "self",
    unlockXp: 60,
    baseGoldCost: 1,
    description: "Brief distraction effect (cosmetic/light)",
    effect: { type: "MICRO_DISTRACTION", intensity: "low", durationSeconds: 2 },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "fog-glass",
    name: "Fog Glass",
    kind: "standard",
    category: "classroom_safe_disruption",
    target: "opponent",
    unlockXp: 190,
    baseGoldCost: 2,
    description: "Add a light \"fog\" overlay for 10 seconds (lower contrast).",
    effect: { type: "UI_OVERLAY_FOG", durationSeconds: 10 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "cursor-mirage",
    name: "Cursor Mirage",
    kind: "standard",
    category: "classroom_safe_disruption",
    target: "opponent",
    unlockXp: 210,
    baseGoldCost: 2,
    description: "Show a fake ghost cursor offset while typing for 8 seconds (real typing unaffected).",
    effect: { type: "UI_CURSOR_MIRAGE", durationSeconds: 8 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "panel-shuffle",
    name: "Panel Shuffle",
    kind: "standard",
    category: "classroom_safe_disruption",
    target: "opponent",
    unlockXp: 260,
    baseGoldCost: 3,
    description: "Temporarily swap the position of their suggestion panel and timer UI for 8 seconds.",
    effect: { type: "UI_PANEL_SWAP", durationSeconds: 8 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "spotlight-theft",
    name: "Spotlight Theft",
    kind: "standard",
    category: "classroom_safe_disruption",
    target: "opponent",
    unlockXp: 280,
    baseGoldCost: 3,
    description: "Dim opponent writer input box and highlight their timer for 10 seconds.",
    effect: { type: "UI_DIM_INPUT", durationSeconds: 10 },
    meta: { implemented: true, notes: "Effect type implemented" }
  },

  // --------------------------------
  // B) COSMETIC (No gameplay) — 10
  // --------------------------------
  {
    id: "writer-spotlight",
    name: "Writer Spotlight",
    kind: "cosmetic",
    category: "cosmetic",
    target: "self",
    unlockXp: 40,
    baseGoldCost: 0,
    description: "Spotlight ring around writer.",
    effect: { type: "COSMETIC", cosmeticKey: "writer_spotlight" },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "team-banner-color",
    name: "Team Banner Color",
    kind: "cosmetic",
    category: "cosmetic",
    target: "self",
    unlockXp: 60,
    baseGoldCost: 0,
    description: "Team name text alternate color.",
    effect: { type: "COSMETIC", cosmeticKey: "team_banner_color" },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "victory-flourish",
    name: "Victory Flourish",
    kind: "cosmetic",
    category: "cosmetic",
    target: "self",
    unlockXp: 100,
    baseGoldCost: 0,
    description: "Confetti animation on match win.",
    effect: { type: "COSMETIC", cosmeticKey: "victory_confetti" },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "signature-style",
    name: "Signature Style",
    kind: "cosmetic",
    category: "cosmetic",
    target: "self",
    unlockXp: 80,
    baseGoldCost: 0,
    description: "Writer input box glow/border variant.",
    effect: { type: "COSMETIC", cosmeticKey: "writer_box_glow" },
    meta: { implemented: true, notes: "Original card - works via cardId matching" }
  },
  {
    id: "ink-trail-cursor",
    name: "Ink Trail Cursor",
    kind: "cosmetic",
    category: "cosmetic",
    target: "self",
    unlockXp: 70,
    baseGoldCost: 0,
    description: "Cursor leaves a subtle ink trail while typing.",
    effect: { type: "COSMETIC", cosmeticKey: "ink_trail_cursor" },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "typewriter-mode",
    name: "Typewriter Mode",
    kind: "cosmetic",
    category: "cosmetic",
    target: "self",
    unlockXp: 120,
    baseGoldCost: 0,
    description: "Typewriter audio + tiny shake (local only).",
    effect: { type: "COSMETIC", cosmeticKey: "typewriter_mode" },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "banner-pattern-pack",
    name: "Banner Pattern Pack",
    kind: "cosmetic",
    category: "cosmetic",
    target: "self",
    unlockXp: 130,
    baseGoldCost: 0,
    description: "Adds pattern overlay option to your banner.",
    effect: { type: "COSMETIC", cosmeticKey: "banner_patterns" },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "calm-theme",
    name: "Calm Theme",
    kind: "cosmetic",
    category: "cosmetic",
    target: "self",
    unlockXp: 160,
    baseGoldCost: 0,
    description: "Softer UI background for your team panel.",
    effect: { type: "COSMETIC", cosmeticKey: "calm_theme" },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "victory-pose-frame",
    name: "Victory Pose Frame",
    kind: "cosmetic",
    category: "cosmetic",
    target: "self",
    unlockXp: 180,
    baseGoldCost: 0,
    description: "Winner frame when you win.",
    effect: { type: "COSMETIC", cosmeticKey: "victory_frame" },
    meta: { implemented: true, notes: "Effect type implemented" }
  },
  {
    id: "team-entrance-stinger",
    name: "Team Entrance Stinger",
    kind: "cosmetic",
    category: "cosmetic",
    target: "self",
    unlockXp: 110,
    baseGoldCost: 0,
    description: "Short intro sound + banner slide-in at match start.",
    effect: { type: "COSMETIC", cosmeticKey: "team_entrance_stinger" },
    meta: { implemented: true, notes: "Effect type implemented" }
  }
];

// Create by-ID map
export const CARD_CATALOG_V1_BY_ID = {};
CARD_CATALOG_V1_ARRAY.forEach(card => {
  CARD_CATALOG_V1_BY_ID[card.id] = card;
});

// Export as array
export const CARD_CATALOG_V1 = CARD_CATALOG_V1_ARRAY;
