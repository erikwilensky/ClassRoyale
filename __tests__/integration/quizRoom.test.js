import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { QuizRoom } from '../../server/QuizRoom.js';
import { MockClient } from '../helpers/mockClient.js';
import { TEST_TEAMS, TEST_PLAYERS } from '../helpers/testData.js';

// Mock dependencies
jest.mock('../../server/auth/auth.js', () => ({
  verifyToken: jest.fn((token) => {
    if (token === 'teacher-token') {
      return { playerId: 'teacher_1', isTeacher: true };
    }
    if (token === 'student-token') {
      return { playerId: 'player_1', isTeacher: false };
    }
    return null;
  })
}), { virtual: true });

jest.mock('../../server/services/xpService.js', () => ({
  getPlayerUnlockedCards: jest.fn(() => ['SHAKE', 'BLUR']),
  flushXP: jest.fn(() => ({ newXP: 100, newLevel: 2, unlockedCards: [] }))
}), { virtual: true });

jest.mock('../../server/db/database.js', () => ({
  db: {
    prepare: jest.fn(() => ({
      get: jest.fn(() => ({ displayName: 'Test Player' })),
      run: jest.fn()
    }))
  }
}), { virtual: true });

describe('QuizRoom Integration', () => {
  let room;

  beforeEach(() => {
    room = new QuizRoom();
    // Mock the broadcast method to avoid Colyseus client requirements
    room.broadcast = jest.fn((type, message) => {
      // Store broadcasts for testing
      if (!room._testBroadcasts) room._testBroadcasts = [];
      room._testBroadcasts.push({ type, message });
    });
    room.broadcastGoldUpdate = jest.fn();
    room.broadcastTeamUpdate = jest.fn();
    room.onCreate({});
  });

  describe('System Integration', () => {
    it('should initialize cardSystem and scoringSystem', () => {
      expect(room.cardSystem).toBeDefined();
      expect(room.scoringSystem).toBeDefined();
    });

    it('should initialize scoring state via scoringSystem', () => {
      expect(room.scores).toBeDefined();
      expect(room.scores.teams).toBeInstanceOf(Map);
      expect(room.scores.roundNumber).toBe(0);
    });

    it('should initialize card rules via cardSystem', () => {
      const rules = room.cardSystem.getRules();
      expect(rules.disabledCards).toEqual([]);
      expect(rules.goldCostModifiers).toEqual({});
    });
  });

  describe('Card System Integration', () => {
    let studentClient;
    let team;

    beforeEach(() => {
      studentClient = new MockClient({
        playerId: TEST_PLAYERS.PLAYER_1.playerId,
        unlockedCards: TEST_PLAYERS.PLAYER_1.unlockedCards
      });
      
      // Setup team
      team = {
        writer: studentClient.sessionId,
        writerPlayerId: studentClient.metadata.playerId,
        suggesters: [],
        gold: 5,
        answer: "",
        locked: false
      };
      room.state.teams.set('A', team);
      room.state.gold.set('A', 5);
      room.clients.push(studentClient);
    });

    it('should delegate castCard to cardSystem', () => {
      const targetTeam = {
        writer: 'session_writer_b',
        writerPlayerId: 'player_writer_b',
        suggesters: [],
        gold: 5
      };
      room.state.teams.set('B', targetTeam);
      room.state.gold.set('B', 5);
      
      // Ensure student client has unlocked cards
      studentClient.metadata.unlockedCards = ['SHAKE', 'BLUR'];
      
      room.onMessage('castCard', studentClient, { cardId: 'SHAKE', targetTeamId: 'B' });
      
      // Verify card was cast (gold deducted, effect created)
      // Gold should be deducted from team A (the caster's team)
      const updatedTeam = room.state.teams.get('A');
      expect(updatedTeam.gold).toBeLessThan(5);
    });

    it('should respect disabled cards from cardSystem', () => {
      // Ensure student client has unlocked cards
      studentClient.metadata.unlockedCards = ['SHAKE', 'BLUR'];
      
      room.cardSystem.disableCard('SHAKE');
      const targetTeam = {
        writer: 'session_writer_b',
        writerPlayerId: 'player_writer_b',
        suggesters: [],
        gold: 5
      };
      room.state.teams.set('B', targetTeam);
      room.state.gold.set('B', 5);
      
      room.onMessage('castCard', studentClient, { cardId: 'SHAKE', targetTeamId: 'B' });
      
      const error = studentClient.getLastMessage('ERROR');
      expect(error).toBeTruthy();
      expect(error.message.message).toContain('disabled');
    });
  });

  describe('Scoring System Integration', () => {
    beforeEach(() => {
      room.scores.roundNumber = 1;
      const teamA = {
        writer: 'session_writer_a',
        writerPlayerId: 'player_writer_a',
        suggesters: [],
        answer: 'Answer A',
        locked: true,
        gold: 5
      };
      const teamB = {
        writer: 'session_writer_b',
        writerPlayerId: 'player_writer_b',
        suggesters: [],
        answer: 'Answer B',
        locked: true,
        gold: 5
      };
      room.state.teams.set('A', teamA);
      room.state.teams.set('B', teamB);
      
      const clientA = new MockClient({ playerId: 'player_writer_a' });
      const clientB = new MockClient({ playerId: 'player_writer_b' });
      room.clients.push(clientA, clientB);
    });

    it('should delegate submitRoundScores to scoringSystem', () => {
      // Setup answers
      const roundAnswers = new Map();
      roundAnswers.set('A', {
        text: 'Answer A',
        writerId: 'player_writer_a',
        suggesterIds: []
      });
      roundAnswers.set('B', {
        text: 'Answer B',
        writerId: 'player_writer_b',
        suggesterIds: []
      });
      room.answers.set(1, roundAnswers);
      
      const result = room.submitRoundScores(1, { A: 8, B: 6 });
      
      expect(result.success).toBe(true);
      expect(result.roundWinner).toBe('A');
      expect(room.scores.teams.get('A')).toBe(1);
    });

    it('should delegate addXPToCache to scoringSystem', () => {
      room.addXPToCache('player_1', 10, 'test');
      
      expect(room.scoringSystem.xpCache.has('player_1')).toBe(true);
      expect(room.scoringSystem.xpCache.get('player_1').totalXP).toBe(10);
    });
  });

  describe('Match Reset Integration', () => {
    beforeEach(() => {
      // Setup match state
      room.scores.roundNumber = 3;
      room.scores.teams.set('A', 2);
      room.scores.teams.set('B', 1);
      room.cardSystem.disableCard('SHAKE');
      room.cardSystem.setCostModifier('BLUR', 1.5);
    });

    it('should reset card rules via cardSystem', () => {
      const teacherClient = new MockClient({
        role: 'teacher',
        isTeacher: true
      });
      room.clients.push(teacherClient);
      
      // Clear any existing disabled cards from setup
      room.cardSystem.resetRules();
      
      // Disable a card to test reset
      room.cardSystem.disableCard('SHAKE');
      expect(room.cardSystem.getRules().disabledCards).toContain('SHAKE');
      
      room.onMessage('RESET_MATCH', teacherClient, {});
      
      const rules = room.cardSystem.getRules();
      expect(rules.disabledCards).toEqual([]);
      expect(rules.goldCostModifiers).toEqual({});
    });

    it('should reset scoring state', () => {
      const teacherClient = new MockClient({
        role: 'teacher',
        isTeacher: true
      });
      room.clients.push(teacherClient);
      
      // Verify initial state
      expect(room.scores.roundNumber).toBe(3);
      expect(room.scores.teams.size).toBeGreaterThan(0);
      
      room.onMessage('RESET_MATCH', teacherClient, {});
      
      // After reset, scoring state should be reset
      expect(room.scores.roundNumber).toBe(0);
      expect(room.scores.teams.size).toBe(0);
      expect(room.scores.matchOver).toBe(false);
    });
  });

  describe('Effect Expiration Integration', () => {
    it('should delegate checkEffectExpiration to cardSystem', () => {
      const effect = {
        cardId: 'SHAKE',
        casterTeamId: 'A',
        targetTeamId: 'B',
        timestamp: Date.now() - 11000,
        expiresAt: Date.now() - 1000
      };
      room.state.activeEffects.set('B', effect);
      
      room.checkEffectExpiration();
      
      expect(room.state.activeEffects.has('B')).toBe(false);
    });
  });
});

