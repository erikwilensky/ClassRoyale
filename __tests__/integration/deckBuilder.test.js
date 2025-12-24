import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { QuizRoom } from '../../server/QuizRoom.js';
import { MockClient } from '../helpers/mockClient.js';

// Mock dependencies
jest.mock('../../server/auth/auth.js', () => ({
  verifyToken: jest.fn((token) => {
    if (token) {
      return { playerId: 'test-player', isTeacher: false };
    }
    return null;
  })
}), { virtual: true });

jest.mock('../../server/services/xpService.js', () => ({
  getPlayerUnlockedCards: jest.fn(() => ['shake', 'blur', 'time-freeze']),
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

describe('Deck Builder Integration', () => {
  let room;
  let studentClient;

  beforeEach(() => {
    room = new QuizRoom();
    room.broadcast = jest.fn();
    room.broadcastGoldUpdate = jest.fn();
    room.broadcastTeamUpdate = jest.fn();
    room.broadcastToTeam = jest.fn();
    room.onCreate({});

    // Create a student client
    studentClient = new MockClient({
      playerId: 'test-player',
      role: 'student',
      isTeacher: false
    });
    room.clients.push(studentClient);

    // Create a team with the student as writer
    const team = {
      writer: studentClient.sessionId,
      writerPlayerId: 'test-player',
      suggesters: [],
      gold: 5,
      answer: "",
      locked: false,
      deckSlots: new room.state.constructor.TeamState().deckSlots.constructor(null, null, null, null),
      teamCardPool: new room.state.constructor.TeamState().teamCardPool.constructor(),
      deckLocked: false
    };
    room.state.teams.set('A', team);
    room.state.gold.set('A', 5);
  });

  describe('SET_TEAM_DECK_SLOT', () => {
    it('should add a card to an empty deck slot', async () => {
      // First, update team card pool to include the card
      const team = room.state.teams.get('A');
      team.teamCardPool.push('shake');
      
      // Send message to add card to slot 0
      const message = { slotIndex: 0, cardId: 'shake' };
      room.onMessage('SET_TEAM_DECK_SLOT', studentClient, message);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that card was added to slot 0
      const updatedTeam = room.state.teams.get('A');
      expect(updatedTeam.deckSlots[0]).toBe('shake');
      expect(updatedTeam.deckSlots[1]).toBeNull();
      expect(updatedTeam.deckSlots[2]).toBeNull();
      expect(updatedTeam.deckSlots[3]).toBeNull();
    });

    it('should reject card not in team card pool', async () => {
      const team = room.state.teams.get('A');
      // Don't add 'time-freeze' to teamCardPool
      
      const message = { slotIndex: 0, cardId: 'time-freeze' };
      room.onMessage('SET_TEAM_DECK_SLOT', studentClient, message);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have received error
      const error = studentClient.getLastMessage('ERROR');
      expect(error).toBeTruthy();
      expect(error.message.message).toContain('Card not available in team card pool');
    });

    it('should reject invalid slot index', async () => {
      const message = { slotIndex: 5, cardId: 'shake' };
      room.onMessage('SET_TEAM_DECK_SLOT', studentClient, message);

      await new Promise(resolve => setTimeout(resolve, 100));

      const error = studentClient.getLastMessage('ERROR');
      expect(error).toBeTruthy();
      expect(error.message.message).toContain('Invalid slot index');
    });

    it('should prevent duplicate cards in deck', async () => {
      const team = room.state.teams.get('A');
      team.teamCardPool.push('shake');
      team.deckSlots[0] = 'shake'; // Already in slot 0
      
      const message = { slotIndex: 1, cardId: 'shake' };
      room.onMessage('SET_TEAM_DECK_SLOT', studentClient, message);

      await new Promise(resolve => setTimeout(resolve, 100));

      const error = studentClient.getLastMessage('ERROR');
      expect(error).toBeTruthy();
      expect(error.message.message).toContain('Card already in deck');
    });

    it('should clear a slot when cardId is null', async () => {
      const team = room.state.teams.get('A');
      team.deckSlots[0] = 'shake';
      
      const message = { slotIndex: 0, cardId: null };
      room.onMessage('SET_TEAM_DECK_SLOT', studentClient, message);

      await new Promise(resolve => setTimeout(resolve, 100));

      const updatedTeam = room.state.teams.get('A');
      expect(updatedTeam.deckSlots[0]).toBeNull();
    });

    it('should reject if deck is locked', async () => {
      const team = room.state.teams.get('A');
      team.deckLocked = true;
      team.teamCardPool.push('shake');
      
      const message = { slotIndex: 0, cardId: 'shake' };
      room.onMessage('SET_TEAM_DECK_SLOT', studentClient, message);

      await new Promise(resolve => setTimeout(resolve, 100));

      const error = studentClient.getLastMessage('ERROR');
      expect(error).toBeTruthy();
      expect(error.message.message).toContain('Deck is locked');
    });
  });
});

