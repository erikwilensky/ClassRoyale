// Chapter 11.5: Effect State Schema
import { Schema } from "@colyseus/schema";

export class EffectState extends Schema {
    cardId = "";
    casterTeamId = "";
    targetTeamId = "";
    timestamp = 0;
    expiresAt = 0;
    // Card Catalog v1: Support effect.type-based processing
    effectType = ""; // Effect type from catalog (e.g., "TIMER_ADD", "SUGGESTION_MUTE_RECEIVE")
    effectParams = {}; // Effect parameters from catalog (e.g., { seconds: 5 })
}


