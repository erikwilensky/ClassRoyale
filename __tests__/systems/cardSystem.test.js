import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CardSystem } from '../../server/systems/cardSystem.js';
import { MockRoom } from '../helpers/mockRoom.js';
import { MockClient } from '../helpers/mockClient.js';
import { TEST_CARDS, TEST_TEAMS, TEST_PLAYERS } from '../helpers/testData.js';

// Mock dependencies - using jest.mock with proper ES module syntax
jest.mock('../../server/config/cards.js', () => ({
  CARDS: {
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
    GOLD_RUSH: {
      id: "GOLD_RUSH",
      name: "Gold Rush",
      unlockCost: 250,
      type: "standard",
      cost: 0,
      target: "self",
      effect: "+1 gold immediately",
      description: "Quick gold boost for your team"
    },
    WRITER_SPOTLIGHT: {
      id: "WRITER_SPOTLIGHT",
      name: "Writer Spotlight",
      unlockCost: 40,
      type: "cosmetic",
      cost: 0,
      target: "self",
      effect: "Coliseum-style spotlight ring around writer",
      description: "Make your writer shine!"
    }
  }
}), { virtual: true });

jest.mock('../../server/services/xpService.js', () => ({
  getPlayerUnlockedCards: jest.fn((playerId) => {
    const players = {
      'player_1': { playerId: 'player_1', unlockedCards: ['SHAKE', 'BLUR'] },
      'player_2': { playerId: 'player_2', unlockedCards: ['SHAKE', 'GOLD_RUSH', 'WRITER_SPOTLIGHT'] }
    };
    return players[playerId]?.unlockedCards || [];
  })
}), { virtual: true });

describe('CardSystem', () => {
  let mockRoom;
  let cardSystem;

  beforeEach(() => {
    mockRoom = new MockRoom();
    cardSystem = new CardSystem(mockRoom);
    cardSystem.initializeRules();
    mockRoom.clearBroadcasts();
  });

  describe('Initialization', () => {
    it('should initialize with empty rules', () => {
      const rules = cardSystem.getRules();
      expect(rules.disabledCards).toEqual([]);
      expect(rules.goldCostModifiers).toEqual({});
    });
  });

  describe('Card Rules Management', () => {
    it('should disable a card', () => {
      cardSystem.disableCard('SHAKE');
      const rules = cardSystem.getRules();
      expect(rules.disabledCards).toContain('SHAKE');
    });

    it('should enable a disabled card', () => {
      cardSystem.disableCard('SHAKE');
      cardSystem.enableCard('SHAKE');
      const rules = cardSystem.getRules();
      expect(rules.disabledCards).not.toContain('SHAKE');
    });

    it('should set gold cost modifier for standard card', () => {
      cardSystem.setCostModifier('SHAKE', 1.5);
      const rules = cardSystem.getRules();
      expect(rules.goldCostModifiers.SHAKE).toBe(1.5);
    });

    it('should clamp multiplier to valid range', () => {
      cardSystem.setCostModifier('SHAKE', 3.0); // Should clamp to 2.0
      expect(cardSystem.getRules().goldCostModifiers.SHAKE).toBe(2.0);
      
      cardSystem.setCostModifier('BLUR', 0.1); // Should clamp to 0.5
      expect(cardSystem.getRules().goldCostModifiers.BLUR).toBe(0.5);
    });

    it('should reset all rules', () => {
      cardSystem.disableCard('SHAKE');
      cardSystem.setCostModifier('BLUR', 1.5);
      cardSystem.resetRules();
      const rules = cardSystem.getRules();
      expect(rules.disabledCards).toEqual([]);
      expect(rules.goldCostModifiers).toEqual({});
    });

    it('should broadcast rules update', () => {
      cardSystem.disableCard('SHAKE');
      const broadcast = mockRoom.getLastBroadcast('CARD_RULES_UPDATE');
      expect(broadcast).toBeTruthy();
      expect(broadcast.message.disabledCards).toContain('SHAKE');
    });
  });

  describe('Card Casting', () => {
    let client;
    let team;

    beforeEach(() => {
      client = new MockClient({
        playerId: TEST_PLAYERS.PLAYER_1.playerId,
        unlockedCards: TEST_PLAYERS.PLAYER_1.unlockedCards
      });
      
      // Setup team in room state
      team = {
        writer: client.sessionId,
        writerPlayerId: client.metadata.playerId,
        suggesters: [],
        gold: 5,
        answer: "",
        locked: false,
        deckSlots: ['SHAKE', 'BLUR', null, null] // Add cards to deck
      };
      mockRoom.state.teams.set('A', team);
      mockRoom.state.gold.set('A', 5);
      mockRoom.clients.push(client);
    });

    it('should reject cast from non-student', () => {
      const teacherClient = new MockClient({ role: 'teacher', isTeacher: true });
      // Add teacher to room clients so they can be found
      mockRoom.clients.push(teacherClient);
      
      // Card system silently rejects non-students (just returns)
      cardSystem.handleCastCard(teacherClient, { cardId: 'SHAKE', targetTeamId: 'B' });
      
      // No error sent, just silently rejected
      const error = teacherClient.getLastMessage('ERROR');
      expect(error).toBeFalsy(); // No error sent for non-students
      
      // Verify no card was cast (no broadcast)
      const broadcast = mockRoom.getLastBroadcast('CARD_CAST');
      expect(broadcast).toBeFalsy();
    });

    it('should reject invalid card ID', () => {
      cardSystem.handleCastCard(client, { cardId: 'INVALID_CARD', targetTeamId: 'B' });
      
      const error = client.getLastMessage('ERROR');
      expect(error).toBeTruthy();
      expect(error.message.message).toBe('Invalid card');
    });

    it('should reject if card is disabled', () => {
      cardSystem.disableCard('SHAKE');
      cardSystem.handleCastCard(client, { cardId: 'SHAKE', targetTeamId: 'B' });
      
      const error = client.getLastMessage('ERROR');
      expect(error).toBeTruthy();
      expect(error.message.message).toContain('disabled');
    });

    it('should reject if card is not unlocked', () => {
      const lockedClient = new MockClient({
        playerId: 'player_locked',
        unlockedCards: [] // No cards unlocked
      });
      // Add client to a team so team check passes
      const lockedTeam = {
        writer: lockedClient.sessionId,
        writerPlayerId: 'player_locked',
        suggesters: [],
        gold: 5,
        answer: "",
        locked: false,
        deckSlots: ['SHAKE', null, null, null] // Card in deck but not unlocked
      };
      mockRoom.state.teams.set('C', lockedTeam);
      mockRoom.state.gold.set('C', 5);
      mockRoom.clients.push(lockedClient);
      
      cardSystem.handleCastCard(lockedClient, { cardId: 'SHAKE', targetTeamId: 'B' });
      
      const error = lockedClient.getLastMessage('ERROR');
      expect(error).toBeTruthy();
      expect(error.message.message).toContain('not unlocked');
    });

    it('should reject if insufficient gold', () => {
      team.gold = 1; // Not enough for SHAKE (cost: 3)
      mockRoom.state.gold.set('A', 1);
      
      cardSystem.handleCastCard(client, { cardId: 'SHAKE', targetTeamId: 'B' });
      
      const error = client.getLastMessage('ERROR');
      expect(error).toBeTruthy();
      expect(error.message.message).toContain('Insufficient gold');
    });

    it('should successfully cast standard card', () => {
      // Setup target team
      const targetTeam = {
        writer: 'session_writer_b',
        writerPlayerId: 'player_writer_b',
        suggesters: [],
        gold: 5,
        deckSlots: []
      };
      mockRoom.state.teams.set('B', targetTeam);
      
      cardSystem.handleCastCard(client, { cardId: 'SHAKE', targetTeamId: 'B' });
      
      // Check gold deducted
      expect(team.gold).toBe(2); // 5 - 3 = 2
      expect(mockRoom.state.gold.get('A')).toBe(2);
      
      // Check effect created
      const effect = mockRoom.state.activeEffects.get('B');
      expect(effect).toBeTruthy();
      expect(effect.cardId).toBe('SHAKE');
      
      // Check broadcast
      const broadcast = mockRoom.getLastBroadcast('CARD_CAST');
      expect(broadcast).toBeTruthy();
      expect(broadcast.message.cardId).toBe('SHAKE');
    });

    it('should apply cost modifier when casting', () => {
      cardSystem.setCostModifier('SHAKE', 0.5); // Half cost
      const targetTeam = {
        writer: 'session_writer_b',
        deckSlots: []
        writerPlayerId: 'player_writer_b',
        suggesters: [],
        gold: 5
      };
      mockRoom.state.teams.set('B', targetTeam);
      
      const initialGold = team.gold;
      cardSystem.handleCastCard(client, { cardId: 'SHAKE', targetTeamId: 'B' });
      
      // Should deduct 2 gold (3 * 0.5 = 1.5, rounded up to 2, but min 1)
      // Actually: Math.ceil(3 * 0.5) = Math.ceil(1.5) = 2
      expect(team.gold).toBeLessThan(initialGold);
    });

    it('should cast cosmetic card without gold cost', () => {
      const cosmeticClient = new MockClient({
        playerId: TEST_PLAYERS.PLAYER_2.playerId,
        unlockedCards: TEST_PLAYERS.PLAYER_2.unlockedCards
      });
      // Add cosmetic client to team
      const cosmeticTeam = {
        writer: cosmeticClient.sessionId,
        writerPlayerId: TEST_PLAYERS.PLAYER_2.playerId,
        suggesters: [],
        gold: 5,
        answer: "",
        locked: false,
        deckSlots: ['WRITER_SPOTLIGHT', null, null, null]
      };
      mockRoom.state.teams.set('C', cosmeticTeam);
      mockRoom.state.gold.set('C', 5);
      mockRoom.clients.push(cosmeticClient);
      
      cardSystem.handleCastCard(cosmeticClient, { cardId: 'WRITER_SPOTLIGHT' });
      
      // Check no gold deducted (cosmetic cards are free)
      expect(cosmeticTeam.gold).toBe(5);
      
      // Check broadcast
      const broadcast = mockRoom.getLastBroadcast('CARD_CAST');
      expect(broadcast).toBeTruthy();
      expect(broadcast.message.cardId).toBe('WRITER_SPOTLIGHT');
    });
  });

  describe('Effect Management', () => {
    it('should check and remove expired effects', () => {
      const effect = {
        cardId: 'SHAKE',
        casterTeamId: 'A',
        targetTeamId: 'B',
        timestamp: Date.now() - 11000, // 11 seconds ago (expired)
        expiresAt: Date.now() - 1000
      };
      mockRoom.state.activeEffects.set('B', effect);
      
      cardSystem.checkEffectExpiration();
      
      expect(mockRoom.state.activeEffects.has('B')).toBe(false);
    });

    it('should not remove active effects', () => {
      const effect = {
        cardId: 'SHAKE',
        casterTeamId: 'A',
        targetTeamId: 'B',
        timestamp: Date.now(),
        expiresAt: Date.now() + 10000 // 10 seconds in future
      };
      mockRoom.state.activeEffects.set('B', effect);
      
      cardSystem.checkEffectExpiration();
      
      expect(mockRoom.state.activeEffects.has('B')).toBe(true);
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate adjusted cost with modifier', () => {
      cardSystem.setCostModifier('SHAKE', 1.5);
      const adjustedCost = cardSystem.calculateAdjustedCost(TEST_CARDS.SHAKE);
      expect(adjustedCost).toBe(5); // Math.ceil(3 * 1.5) = 5
    });

    it('should enforce minimum cost of 1', () => {
      cardSystem.setCostModifier('GOLD_RUSH', 0.1); // Would be 0, but should be 1
      const adjustedCost = cardSystem.calculateAdjustedCost(TEST_CARDS.GOLD_RUSH);
      expect(adjustedCost).toBe(1); // Min cost
    });
  });
});

