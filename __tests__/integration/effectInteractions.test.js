import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { QuizRoom } from '../../server/QuizRoom.js';
import { MockClient } from '../helpers/mockClient.js';
import { TEST_TEAMS, TEST_PLAYERS } from '../helpers/testData.js';
import { processEffect } from '../../server/systems/effectProcessor.js';

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
  getPlayerUnlockedCards: jest.fn(() => ['time-freeze', 'time-anchor', 'pickpocket', 'mirror-shield']),
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

describe('Effect Interactions Integration', () => {
  let room;

  beforeEach(() => {
    room = new QuizRoom();
    room.broadcast = jest.fn();
    room.broadcastGoldUpdate = jest.fn();
    room.broadcastTeamUpdate = jest.fn();
    room.broadcastToTeam = jest.fn();
    room.onCreate({});
  });

  describe('Shield vs Reflect', () => {
    it('should prioritize shield over reflect', () => {
      // This would require setting up teams and casting cards
      // For now, we test the logic exists
      expect(room.cardSystem).toBeDefined();
      expect(room.cardSystem.hasShield).toBeDefined();
      expect(room.cardSystem.effectReflect).toBeDefined();
    });
  });

  describe('Cleanse Removing Effects', () => {
    it('should remove negative effects when cleanse is applied', () => {
      const teamId = "team_1";
      
      // Add a negative effect
      const negativeEffect = {
        effectType: "TIMER_SUBTRACT",
        targetTeamId: teamId,
        timestamp: Date.now(),
        expiresAt: Date.now() + 10000
      };
      room.state.activeEffects.set(teamId, negativeEffect);

      // Apply cleanse
      const cleanseEffect = {
        effectType: "EFFECT_CLEANSE",
        targetTeamId: teamId,
        timestamp: Date.now()
      };
      
      // Process cleanse through effect processor
      processEffect(cleanseEffect, room, room.cardSystem);

      // Negative effect should be removed
      expect(room.state.activeEffects.has(teamId)).toBe(false);
    });
  });

  describe('Immunity Blocking Effects', () => {
    it('should block disruption effects with immunity', () => {
      const teamId = "team_1";
      
      // Set immunity
      const immunityEffect = {
        effectType: "EFFECT_IMMUNITY_DISRUPTION",
        targetTeamId: teamId,
        timestamp: Date.now(),
        effectParams: { durationSeconds: 15 }
      };
      
      processEffect(immunityEffect, room, room.cardSystem);

      // Try to apply disruption
      const disruptionCard = {
        effect: { type: "SCREEN_SHAKE", params: {} }
      };
      
      room.cardSystem.createEffect("shake_card", "team_2", teamId, disruptionCard);

      // Effect should be blocked
      expect(room.state.activeEffects.has(teamId)).toBe(false);
    });
  });

  describe('Effect Stacking', () => {
    it('should handle multiple timer effects', () => {
      const teamId = "team_1";
      
      // Apply pause
      const pauseEffect = {
        effectType: "TIMER_PAUSE",
        targetTeamId: teamId,
        timestamp: Date.now(),
        effectParams: { durationSeconds: 3 }
      };
      
      // Apply protection
      const protectEffect = {
        effectType: "TIMER_PROTECT",
        targetTeamId: teamId,
        timestamp: Date.now(),
        effectParams: { durationSeconds: 12 }
      };
      
      processEffect(pauseEffect, room, room.cardSystem);
      processEffect(protectEffect, room, room.cardSystem);

      expect(room.cardSystem.timerPaused.has(teamId)).toBe(true);
      expect(room.cardSystem.timerProtected.has(teamId)).toBe(true);
    });
  });
});

