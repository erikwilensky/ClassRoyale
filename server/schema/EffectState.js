// Chapter 11.5: Effect State Schema
import { Schema } from "@colyseus/schema";

export class EffectState extends Schema {
    cardId = "";
    casterTeamId = "";
    targetTeamId = "";
    timestamp = 0;
    expiresAt = 0;
}

