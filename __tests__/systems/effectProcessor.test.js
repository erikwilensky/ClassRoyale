import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { processEffect } from '../../server/systems/effectProcessor.js';
import { EffectState } from '../../server/schema/EffectState.js';
import { MockRoom } from '../helpers/mockRoom.js';
import { CardSystem } from '../../server/systems/cardSystem.js';

describe('EffectProcessor', () => {
  let mockRoom;
  let cardSystem;

  beforeEach(() => {
    mockRoom = new MockRoom();
    cardSystem = new CardSystem(mockRoom);
    cardSystem.initializeRules();
    mockRoom.clearBroadcasts();
    
    // Set up basic room state
    mockRoom.state.timeRemaining = 60;
    mockRoom.state.timerEnabled = true;
    mockRoom.state.roundState = "ROUND_ACTIVE";
    
    // Set up test teams (using ArraySchema-like structure)
    const team1 = {
      id: "team_1",
      gold: 5,
      suggestions: [], // Array-like, will be cleared in tests
      deckSlots: [] // Array-like
    };
    const team2 = {
      id: "team_2",
      gold: 3,
      suggestions: [],
      deckSlots: []
    };
    mockRoom.state.teams.set("team_1", team1);
    mockRoom.state.teams.set("team_2", team2);
    mockRoom.state.gold.set("team_1", 5);
    mockRoom.state.gold.set("team_2", 3);
  });

  describe('Timer Effects', () => {
    it('should pause timer for specified duration (TIMER_PAUSE)', () => {
      const effect = new EffectState();
      effect.effectType = "TIMER_PAUSE";
      effect.effectParams = { durationSeconds: 3 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.timerPaused.has("team_1")).toBe(true);
      const pause = cardSystem.timerPaused.get("team_1");
      expect(pause.pausedUntil).toBeGreaterThan(Date.now());
    });

    it('should protect timer from subtraction (TIMER_PROTECT)', () => {
      const effect = new EffectState();
      effect.effectType = "TIMER_PROTECT";
      effect.effectParams = { durationSeconds: 12 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.timerProtected.has("team_1")).toBe(true);
      expect(cardSystem.isTimerProtected("team_1")).toBe(true);
    });

    it('should apply timer rate multiplier (TIMER_RATE_MULT)', () => {
      const effect = new EffectState();
      effect.effectType = "TIMER_RATE_MULT";
      effect.effectParams = { multiplier: 1.25, durationSeconds: 10 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.timerRateMultipliers.has("team_1")).toBe(true);
      const rate = cardSystem.timerRateMultipliers.get("team_1");
      expect(rate.multiplier).toBe(1.25);
    });

    it('should handle timer loan (TIMER_LOAN)', () => {
      const initialTime = mockRoom.state.timeRemaining;
      const effect = new EffectState();
      effect.effectType = "TIMER_LOAN";
      effect.effectParams = { gainSeconds: 8, repaySeconds: 4, repayAfterSeconds: 12 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      // Should immediately add gain seconds
      expect(mockRoom.state.timeRemaining).toBe(initialTime + 8);
    });

    it('should delay timer start (TIMER_START_DELAY)', () => {
      const effect = new EffectState();
      effect.effectType = "TIMER_START_DELAY";
      effect.effectParams = { delaySeconds: 3 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.timerStartDelayed.has("team_1")).toBe(true);
      expect(cardSystem.isTimerStartDelayed("team_1")).toBe(true);
    });

    it('should set timer insurance (TIMER_INSURANCE)', () => {
      const effect = new EffectState();
      effect.effectType = "TIMER_INSURANCE";
      effect.effectParams = { insuredSeconds: 4 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.timerInsurance.has("team_1")).toBe(true);
      const insurance = cardSystem.timerInsurance.get("team_1");
      expect(insurance.insuredSeconds).toBe(4);
    });
  });

  describe('Suggestion Effects', () => {
    it('should hide suggestion panel (SUGGEST_PANEL_HIDE)', () => {
      const effect = new EffectState();
      effect.effectType = "SUGGEST_PANEL_HIDE";
      effect.effectParams = { durationSeconds: 6 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.suggestionPanelHidden.has("team_1")).toBe(true);
    });

    it('should set suggestion priority channel (SUGGEST_PRIORITY_CHANNEL)', () => {
      const effect = new EffectState();
      effect.effectType = "SUGGEST_PRIORITY_CHANNEL";
      effect.effectParams = { topCount: 1, durationSeconds: 10 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.suggestionPriorityMode.has("team_1")).toBe(true);
      const priority = cardSystem.suggestionPriorityMode.get("team_1");
      expect(priority.topCount).toBe(1);
    });

    it('should clear suggestion queue (SUGGEST_QUEUE_CLEAR)', () => {
      const team = mockRoom.state.teams.get("team_1");
      if (team) {
        // Mock ArraySchema clear method
        team.suggestions = [{ text: "test", suggesterId: "s1", timestamp: Date.now() }];
        team.suggestions.clear = function() { this.length = 0; };
        
        const effect = new EffectState();
        effect.effectType = "SUGGEST_QUEUE_CLEAR";
        effect.effectParams = {};
        effect.targetTeamId = "team_1";
        effect.timestamp = Date.now();

        processEffect(effect, mockRoom, cardSystem);

        expect(team.suggestions.length).toBe(0);
      }
    });

    it('should set suggestion broadcast mode (SUGGEST_BROADCAST_MODE)', () => {
      const effect = new EffectState();
      effect.effectType = "SUGGEST_BROADCAST_MODE";
      effect.effectParams = { durationSeconds: 8 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.suggestionBroadcastMode.has("team_1")).toBe(true);
    });

    it('should mute suggestion pings (SUGGEST_PING_MUTE)', () => {
      const effect = new EffectState();
      effect.effectType = "SUGGEST_PING_MUTE";
      effect.effectParams = { durationSeconds: 12 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.suggestionPingsMuted.has("team_1")).toBe(true);
    });

    it('should set suggestion character limit (SUGGEST_CHAR_LIMIT)', () => {
      const effect = new EffectState();
      effect.effectType = "SUGGEST_CHAR_LIMIT";
      effect.effectParams = { maxChars: 60, durationSeconds: 10 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.suggestionCharLimit.has("team_1")).toBe(true);
      expect(cardSystem.getSuggestionCharLimit("team_1")).toBe(60);
    });
  });

  describe('Gold/Economy Effects', () => {
    it('should steal gold from target (GOLD_STEAL)', () => {
      const targetTeam = mockRoom.state.teams.get("team_1");
      const casterTeam = mockRoom.state.teams.get("team_2");
      if (targetTeam && casterTeam) {
        targetTeam.gold = 5;
        casterTeam.gold = 3;

        const effect = new EffectState();
        effect.effectType = "GOLD_STEAL";
        effect.effectParams = { amount: 1 };
        effect.targetTeamId = "team_1";
        effect.casterTeamId = "team_2";
        effect.timestamp = Date.now();

        processEffect(effect, mockRoom, cardSystem);

        expect(targetTeam.gold).toBe(4);
        expect(casterTeam.gold).toBe(4);
      }
    });

    it('should set gold cost modifier (GOLD_COST_MOD)', () => {
      const effect = new EffectState();
      effect.effectType = "GOLD_COST_MOD";
      effect.effectParams = { modifier: 1, cardCount: 2 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.teamGoldCostModifiers.has("team_1")).toBe(true);
      const mods = cardSystem.teamGoldCostModifiers.get("team_1");
      expect(mods.has("*")).toBe(true);
    });

    it('should set gold cost discount (GOLD_COST_DISCOUNT)', () => {
      const effect = new EffectState();
      effect.effectType = "GOLD_COST_DISCOUNT";
      effect.effectParams = { discount: 1, cardCount: 1 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.teamGoldCostModifiers.has("team_1")).toBe(true);
      const mods = cardSystem.teamGoldCostModifiers.get("team_1");
      const mod = mods.get("*");
      expect(mod.modifier).toBe(-1);
    });

    it('should set gold interest (GOLD_INTEREST)', () => {
      const effect = new EffectState();
      effect.effectType = "GOLD_INTEREST";
      effect.effectParams = { rate: 3, maxGain: 2 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.goldInterest.has("team_1")).toBe(true);
      const interest = cardSystem.goldInterest.get("team_1");
      expect(interest.rate).toBe(3);
      expect(interest.maxGain).toBe(2);
    });

    it('should set gold refund on block (GOLD_REFUND_ON_BLOCK)', () => {
      const effect = new EffectState();
      effect.effectType = "GOLD_REFUND_ON_BLOCK";
      effect.effectParams = { cardCount: 1 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.goldRefundOnBlock.has("team_1")).toBe(true);
    });

    it('should set gold inflation (GOLD_INFLATION)', () => {
      const effect = new EffectState();
      effect.effectType = "GOLD_INFLATION";
      effect.effectParams = { modifier: 1, durationSeconds: 15 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.goldInflation).not.toBeNull();
      expect(cardSystem.goldInflation.modifier).toBe(1);
    });
  });

  describe('Defense Effects', () => {
    it('should set effect reflect (EFFECT_REFLECT)', () => {
      const effect = new EffectState();
      effect.effectType = "EFFECT_REFLECT";
      effect.effectParams = { cardCount: 1 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.effectReflect.has("team_1")).toBe(true);
    });

    it('should cleanse negative effects (EFFECT_CLEANSE)', () => {
      // Add a negative effect first
      const negativeEffect = new EffectState();
      negativeEffect.effectType = "TIMER_SUBTRACT";
      negativeEffect.targetTeamId = "team_1";
      negativeEffect.timestamp = Date.now();
      negativeEffect.expiresAt = Date.now() + 10000;
      mockRoom.state.activeEffects.set("team_1", negativeEffect);

      const effect = new EffectState();
      effect.effectType = "EFFECT_CLEANSE";
      effect.effectParams = {};
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      // Cleanse should remove the negative effect
      expect(mockRoom.state.activeEffects.has("team_1")).toBe(false);
    });

    it('should set disruption immunity (EFFECT_IMMUNITY_DISRUPTION)', () => {
      const effect = new EffectState();
      effect.effectType = "EFFECT_IMMUNITY_DISRUPTION";
      effect.effectParams = { durationSeconds: 15 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.effectImmunity.has("team_1")).toBe(true);
      const immunity = cardSystem.effectImmunity.get("team_1");
      expect(immunity.has("SCREEN_SHAKE")).toBe(true);
    });

    it('should set comms immunity (EFFECT_IMMUNITY_COMMS)', () => {
      const effect = new EffectState();
      effect.effectType = "EFFECT_IMMUNITY_COMMS";
      effect.effectParams = { durationSeconds: 12 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.effectImmunity.has("team_1")).toBe(true);
      const immunity = cardSystem.effectImmunity.get("team_1");
      expect(immunity.has("SUGGESTION_DELAY")).toBe(true);
    });

    it('should set effect decoy (EFFECT_DECOY)', () => {
      const effect = new EffectState();
      effect.effectType = "EFFECT_DECOY";
      effect.effectParams = { cardCount: 1 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.effectDecoy.has("team_1")).toBe(true);
    });
  });

  describe('Deck/Casting Effects', () => {
    it('should shuffle deck (DECK_SHUFFLE)', () => {
      const team = mockRoom.state.teams.get("team_1");
      if (team) {
        // Create a fresh array for each test to avoid contamination
        const deckArray = [];
        deckArray.length = 0; // Ensure it's empty
        deckArray.push("card1", "card2", "card3", null);
        
        // Mock ArraySchema clear and push methods
        deckArray.clear = function() { 
          this.length = 0;
        };
        // Use native push
        team.deckSlots = deckArray;
        
        // Verify initial state
        const originalCards = [];
        for (let i = 0; i < team.deckSlots.length; i++) {
          if (team.deckSlots[i] !== null) {
            originalCards.push(team.deckSlots[i]);
          }
        }
        expect(originalCards.length).toBe(3);
        
        const effect = new EffectState();
        effect.effectType = "DECK_SHUFFLE";
        effect.effectParams = {};
        effect.targetTeamId = "team_1";
        effect.timestamp = Date.now();

        processEffect(effect, mockRoom, cardSystem);

        // Deck should still have same cards (order may differ)
        const newCards = [];
        for (let i = 0; i < team.deckSlots.length; i++) {
          if (team.deckSlots[i] !== null) {
            newCards.push(team.deckSlots[i]);
          }
        }
        expect(newCards.length).toBe(originalCards.length);
      }
    });

    it('should set cast lockout (CAST_LOCKOUT)', () => {
      const effect = new EffectState();
      effect.effectType = "CAST_LOCKOUT";
      effect.effectParams = { durationSeconds: 4, cardCount: 1 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.castLockout.has("team_1")).toBe(true);
      expect(cardSystem.isCastLockedOut("team_1")).toBe(true);
    });

    it('should set cast instant (CAST_INSTANT)', () => {
      const effect = new EffectState();
      effect.effectType = "CAST_INSTANT";
      effect.effectParams = { cardCount: 1 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.castInstant.has("team_1")).toBe(true);
    });
  });

  describe('Effect Expiration and Cleanup', () => {
    it('should clean up expired timer pause', () => {
      const effect = new EffectState();
      effect.effectType = "TIMER_PAUSE";
      effect.effectParams = { durationSeconds: 1 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now() - 2000; // 2 seconds ago

      processEffect(effect, mockRoom, cardSystem);
      
      // Manually expire it
      const pause = cardSystem.timerPaused.get("team_1");
      if (pause) {
        pause.pausedUntil = Date.now() - 1000;
      }
      
      expect(cardSystem.isTimerPaused("team_1")).toBe(false);
    });

    it('should clean up expired suggestion char limit', () => {
      const effect = new EffectState();
      effect.effectType = "SUGGEST_CHAR_LIMIT";
      effect.effectParams = { maxChars: 60, durationSeconds: 1 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now() - 2000;

      processEffect(effect, mockRoom, cardSystem);
      
      // Manually expire it
      const limit = cardSystem.suggestionCharLimit.get("team_1");
      if (limit) {
        limit.expiresAt = Date.now() - 1000;
      }
      
      expect(cardSystem.getSuggestionCharLimit("team_1")).toBeNull();
    });

    it('should clean up expired gold inflation', () => {
      const effect = new EffectState();
      effect.effectType = "GOLD_INFLATION";
      effect.effectParams = { modifier: 1, durationSeconds: 1 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now() - 2000;

      processEffect(effect, mockRoom, cardSystem);
      
      // Manually expire it
      if (cardSystem.goldInflation) {
        cardSystem.goldInflation.expiresAt = Date.now() - 1000;
      }
      
      cardSystem.checkEffectExpiration();
      expect(cardSystem.goldInflation).toBeNull();
    });
  });

  describe('Effect Interactions', () => {
    it('should block timer subtract with timer protection', () => {
      // First set protection
      const protectEffect = new EffectState();
      protectEffect.effectType = "TIMER_PROTECT";
      protectEffect.effectParams = { durationSeconds: 12 };
      protectEffect.targetTeamId = "team_1";
      protectEffect.timestamp = Date.now();
      processEffect(protectEffect, mockRoom, cardSystem);

      // Then try to subtract
      const initialTime = mockRoom.state.timeRemaining;
      const subtractEffect = new EffectState();
      subtractEffect.effectType = "TIMER_SUBTRACT";
      subtractEffect.effectParams = { seconds: 5 };
      subtractEffect.targetTeamId = "team_1";
      subtractEffect.timestamp = Date.now();
      processEffect(subtractEffect, mockRoom, cardSystem);

      // Timer should not have changed
      expect(mockRoom.state.timeRemaining).toBe(initialTime);
    });

    it('should refund time with timer insurance', () => {
      // Set insurance
      const insuranceEffect = new EffectState();
      insuranceEffect.effectType = "TIMER_INSURANCE";
      insuranceEffect.effectParams = { insuredSeconds: 4 };
      insuranceEffect.targetTeamId = "team_1";
      insuranceEffect.timestamp = Date.now();
      processEffect(insuranceEffect, mockRoom, cardSystem);

      // Try to subtract more than insured
      const initialTime = mockRoom.state.timeRemaining;
      const subtractEffect = new EffectState();
      subtractEffect.effectType = "TIMER_SUBTRACT";
      subtractEffect.effectParams = { seconds: 6 };
      subtractEffect.targetTeamId = "team_1";
      subtractEffect.timestamp = Date.now();
      processEffect(subtractEffect, mockRoom, cardSystem);

      // Should only subtract 2 (6 - 4 insured)
      expect(mockRoom.state.timeRemaining).toBe(initialTime - 2);
      expect(cardSystem.timerInsurance.has("team_1")).toBe(false); // Consumed
    });

    it('should reflect negative effect back to caster', () => {
      // Set reflect
      const reflectEffect = new EffectState();
      reflectEffect.effectType = "EFFECT_REFLECT";
      reflectEffect.effectParams = { cardCount: 1 };
      reflectEffect.targetTeamId = "team_1";
      reflectEffect.timestamp = Date.now();
      processEffect(reflectEffect, mockRoom, cardSystem);

      // Try to apply negative effect - should be reflected
      const initialTime = mockRoom.state.timeRemaining;
      const negativeEffect = new EffectState();
      negativeEffect.effectType = "TIMER_SUBTRACT";
      negativeEffect.effectParams = { seconds: 5 };
      negativeEffect.targetTeamId = "team_1";
      negativeEffect.casterTeamId = "team_2";
      negativeEffect.timestamp = Date.now();

      // Create effect through cardSystem to test reflect logic
      const catalogCard = {
        effect: { type: "TIMER_SUBTRACT", params: { seconds: 5 } }
      };
      cardSystem.createEffect("test_card", "team_2", "team_1", catalogCard);

      // Effect should be reflected (caster and target swapped)
      const activeEffect = mockRoom.state.activeEffects.get("team_2");
      expect(activeEffect).toBeDefined();
      expect(activeEffect.targetTeamId).toBe("team_2"); // Reflected back
      expect(cardSystem.effectReflect.has("team_1")).toBe(false); // Consumed
    });

    it('should consume decoy and skip effect', () => {
      // Set decoy
      const decoyEffect = new EffectState();
      decoyEffect.effectType = "EFFECT_DECOY";
      decoyEffect.effectParams = { cardCount: 1 };
      decoyEffect.targetTeamId = "team_1";
      decoyEffect.timestamp = Date.now();
      processEffect(decoyEffect, mockRoom, cardSystem);

      // Try to apply effect - should be consumed
      const catalogCard = {
        effect: { type: "TIMER_SUBTRACT", params: { seconds: 5 } }
      };
      const initialTime = mockRoom.state.timeRemaining;
      cardSystem.createEffect("test_card", "team_2", "team_1", catalogCard);

      // Effect should not be applied
      expect(mockRoom.state.timeRemaining).toBe(initialTime);
      expect(cardSystem.effectDecoy.has("team_1")).toBe(false); // Consumed
    });

    it('should block effect with immunity', () => {
      // Set disruption immunity
      const immunityEffect = new EffectState();
      immunityEffect.effectType = "EFFECT_IMMUNITY_DISRUPTION";
      immunityEffect.effectParams = { durationSeconds: 15 };
      immunityEffect.targetTeamId = "team_1";
      immunityEffect.timestamp = Date.now();
      processEffect(immunityEffect, mockRoom, cardSystem);

      // Try to apply disruption effect - should be blocked
      const catalogCard = {
        effect: { type: "SCREEN_SHAKE", params: {} }
      };
      cardSystem.createEffect("test_card", "team_2", "team_1", catalogCard);

      // Effect should not be in activeEffects
      expect(mockRoom.state.activeEffects.has("team_1")).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle gold steal with insufficient gold', () => {
      const targetTeam = mockRoom.state.teams.get("team_1");
      const casterTeam = mockRoom.state.teams.get("team_2");
      if (targetTeam && casterTeam) {
        targetTeam.gold = 0;
        casterTeam.gold = 3;

        const effect = new EffectState();
        effect.effectType = "GOLD_STEAL";
        effect.effectParams = { amount: 1 };
        effect.targetTeamId = "team_1";
        effect.casterTeamId = "team_2";
        effect.timestamp = Date.now();

        processEffect(effect, mockRoom, cardSystem);

        expect(targetTeam.gold).toBe(0);
        expect(casterTeam.gold).toBe(3); // No change
      }
    });

    it('should handle gold steal with more requested than available', () => {
      const targetTeam = mockRoom.state.teams.get("team_1");
      const casterTeam = mockRoom.state.teams.get("team_2");
      if (targetTeam && casterTeam) {
        targetTeam.gold = 2;
        casterTeam.gold = 3;

        const effect = new EffectState();
        effect.effectType = "GOLD_STEAL";
        effect.effectParams = { amount: 5 }; // More than available
        effect.targetTeamId = "team_1";
        effect.casterTeamId = "team_2";
        effect.timestamp = Date.now();

        processEffect(effect, mockRoom, cardSystem);

        expect(targetTeam.gold).toBe(0);
        expect(casterTeam.gold).toBe(5); // Only stole what was available
      }
    });

    it('should handle empty deck shuffle', () => {
      const team = mockRoom.state.teams.get("team_1");
      if (team) {
        team.deckSlots = [null, null, null, null];
        team.deckSlots.clear = function() { this.length = 0; };
        team.deckSlots.push = function(item) { this[this.length] = item; this.length++; };

        const effect = new EffectState();
        effect.effectType = "DECK_SHUFFLE";
        effect.effectParams = {};
        effect.targetTeamId = "team_1";
        effect.timestamp = Date.now();

        processEffect(effect, mockRoom, cardSystem);

        // Should handle gracefully
        const cards = Array.from(team.deckSlots).filter(c => c !== null);
        expect(cards.length).toBe(0);
      }
    });

    it('should handle invalid effect params gracefully', () => {
      const effect = new EffectState();
      effect.effectType = "TIMER_PAUSE";
      effect.effectParams = null; // Invalid
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      // Should not throw
      expect(() => processEffect(effect, mockRoom, cardSystem)).not.toThrow();
    });

    it('should handle missing target team gracefully', () => {
      const effect = new EffectState();
      effect.effectType = "TIMER_PAUSE";
      effect.effectParams = { durationSeconds: 3 };
      effect.targetTeamId = "nonexistent_team";
      effect.timestamp = Date.now();

      // Should not throw
      expect(() => processEffect(effect, mockRoom, cardSystem)).not.toThrow();
    });
  });

  describe('Gold Cost Modifiers', () => {
    it('should apply team cost modifier correctly', () => {
      const effect = new EffectState();
      effect.effectType = "GOLD_COST_MOD";
      effect.effectParams = { modifier: 2, cardCount: 2 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      const mods = cardSystem.teamGoldCostModifiers.get("team_1");
      expect(mods.has("*")).toBe(true);
      const mod = mods.get("*");
      expect(mod.modifier).toBe(2);
      expect(mod.remaining).toBe(2);
    });

    it('should decrement cost modifier on card cast', () => {
      // Set modifier
      const effect = new EffectState();
      effect.effectType = "GOLD_COST_MOD";
      effect.effectParams = { modifier: 1, cardCount: 2 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();
      processEffect(effect, mockRoom, cardSystem);

      // Simulate card cast
      const mods = cardSystem.teamGoldCostModifiers.get("team_1");
      const mod = mods.get("*");
      mod.remaining--;
      if (mod.remaining <= 0) {
        mods.delete("*");
      }

      expect(mods.has("*")).toBe(true); // Still has 1 remaining
      mod.remaining--;
      if (mod.remaining <= 0) {
        mods.delete("*");
      }
      expect(mods.has("*")).toBe(false); // All consumed
    });
  });

  describe('Writer Effects', () => {
    it('should set writer lock', () => {
      const effect = new EffectState();
      effect.effectType = "WRITER_LOCK";
      effect.effectParams = { durationSeconds: 15 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.writerLocked.has("team_1")).toBe(true);
      expect(cardSystem.isWriterLocked("team_1")).toBe(true);
    });

    it('should schedule writer swap', () => {
      const effect = new EffectState();
      effect.effectType = "WRITER_SCHEDULED_SWAP";
      effect.effectParams = { swapAfterSeconds: 10 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.scheduledSwaps.has("team_1")).toBe(true);
      const scheduled = cardSystem.scheduledSwaps.get("team_1");
      expect(scheduled.swapAt).toBeGreaterThan(Date.now());
    });

    it('should enable spectator suggestions', () => {
      const effect = new EffectState();
      effect.effectType = "SUGGESTER_SPECTATOR_ENABLE";
      effect.effectParams = { durationSeconds: 12 };
      effect.targetTeamId = "team_1";
      effect.timestamp = Date.now();

      processEffect(effect, mockRoom, cardSystem);

      expect(cardSystem.spectatorSuggestersEnabled.has("team_1")).toBe(true);
    });
  });
});

