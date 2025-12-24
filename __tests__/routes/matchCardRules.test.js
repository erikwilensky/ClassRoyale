import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { MockRoom } from '../helpers/mockRoom.js';
import { CardSystem } from '../../server/systems/cardSystem.js';

// Mock the entire middleware module FIRST to bypass authentication
// This must be before any imports that use it
jest.mock('../../server/middleware/auth.js', () => {
  return {
    authenticateToken: jest.fn((req, res, next) => {
      // Directly set the required properties - bypass token verification
      req.playerId = 'test-teacher';
      req.isTeacher = true;
      next();
    })
  };
}, { virtual: true });

// Mock auth service as well (in case it's used elsewhere)
jest.mock('../../server/auth/auth.js', () => ({
  verifyToken: jest.fn((token) => {
    if (token) {
      return {
        playerId: 'test-teacher',
        isTeacher: true
      };
    }
    return null;
  })
}), { virtual: true });

// Import routes after mocks
import matchCardRulesRoutes, { setMatchCardRulesInstance } from '../../server/routes/matchCardRules.js';

// Mock card config
jest.mock('../../server/config/cards.js', () => ({
  CARDS: {
    SHAKE: { id: 'SHAKE', name: 'Shake', type: 'standard', cost: 3 },
    BLUR: { id: 'BLUR', name: 'Blur', type: 'standard', cost: 2 },
    WRITER_SPOTLIGHT: { id: 'WRITER_SPOTLIGHT', name: 'Writer Spotlight', type: 'cosmetic', cost: 0 }
  },
  getAllCards: jest.fn(() => [
    { id: 'SHAKE', name: 'Shake', type: 'standard', cost: 3 },
    { id: 'BLUR', name: 'Blur', type: 'standard', cost: 2 },
    { id: 'WRITER_SPOTLIGHT', name: 'Writer Spotlight', type: 'cosmetic', cost: 0 }
  ]),
  getCardById: jest.fn((id) => {
    const cards = {
      SHAKE: { id: 'SHAKE', name: 'Shake', type: 'standard', cost: 3 },
      BLUR: { id: 'BLUR', name: 'Blur', type: 'standard', cost: 2 },
      WRITER_SPOTLIGHT: { id: 'WRITER_SPOTLIGHT', name: 'Writer Spotlight', type: 'cosmetic', cost: 0 }
    };
    return cards[id] || null;
  }),
  CARD_CATALOG_V1: [],
  CARD_CATALOG_V1_BY_ID: {}
}), { virtual: true });

describe('Match Card Rules Routes', () => {
  let app;
  let mockRoom;
  let cardSystem;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    
    // Add a middleware to bypass authentication for tests
    app.use('/api/match', (req, res, next) => {
      req.playerId = 'test-teacher';
      req.isTeacher = true;
      next();
    });
    
    // Then add the actual routes
    app.use('/api/match', matchCardRulesRoutes);
    
    mockRoom = new MockRoom();
    cardSystem = new CardSystem(mockRoom);
    cardSystem.initializeRules();
    mockRoom.cardSystem = cardSystem;
    mockRoom.scores = { matchOver: false };
    
    setMatchCardRulesInstance(mockRoom);
  });

  describe('GET /api/match/cards', () => {
    it('should return all cards and current rules', async () => {
      const response = await request(app)
        .get('/api/match/cards')
        .set('Authorization', 'Bearer mock-token');
      
      expect(response.status).toBe(200);
      expect(response.body.cards).toBeDefined();
      expect(response.body.disabledCards).toEqual([]);
      expect(response.body.goldCostModifiers).toEqual({});
    });

    it('should return current disabled cards', async () => {
      cardSystem.disableCard('SHAKE');
      
      const response = await request(app)
        .get('/api/match/cards')
        .set('Authorization', 'Bearer mock-token');
      
      expect(response.status).toBe(200);
      expect(response.body.disabledCards).toContain('SHAKE');
    });
  });

  describe('POST /api/match/cards/disable', () => {
    it('should disable a card', async () => {
      const response = await request(app)
        .post('/api/match/cards/disable')
        .set('Authorization', 'Bearer mock-token')
        .send({ cardId: 'SHAKE' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.disabledCards).toContain('SHAKE');
      
      // Verify card is actually disabled
      const rules = cardSystem.getRules();
      expect(rules.disabledCards).toContain('SHAKE');
    });

    it('should reject invalid cardId', async () => {
      const response = await request(app)
        .post('/api/match/cards/disable')
        .set('Authorization', 'Bearer mock-token')
        .send({ cardId: 'INVALID' });
      
      expect(response.status).toBe(400);
    });

    it('should reject if cardId missing', async () => {
      const response = await request(app)
        .post('/api/match/cards/disable')
        .set('Authorization', 'Bearer mock-token')
        .send({});
      
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/match/cards/enable', () => {
    it('should enable a disabled card', async () => {
      cardSystem.disableCard('SHAKE');
      
      const response = await request(app)
        .post('/api/match/cards/enable')
        .set('Authorization', 'Bearer mock-token')
        .send({ cardId: 'SHAKE' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.disabledCards).not.toContain('SHAKE');
    });
  });

  describe('POST /api/match/cards/modify', () => {
    it('should set gold cost modifier', async () => {
      const response = await request(app)
        .post('/api/match/cards/modify')
        .set('Authorization', 'Bearer mock-token')
        .send({ cardId: 'SHAKE', multiplier: 1.5 });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.goldCostModifiers.SHAKE).toBe(1.5);
    });

    it('should clamp multiplier to valid range', async () => {
      const response = await request(app)
        .post('/api/match/cards/modify')
        .set('Authorization', 'Bearer mock-token')
        .send({ cardId: 'SHAKE', multiplier: 3.0 });
      
      expect(response.status).toBe(200);
      expect(response.body.goldCostModifiers.SHAKE).toBe(2.0); // Clamped
    });

    it('should reject modifier for cosmetic cards', async () => {
      const response = await request(app)
        .post('/api/match/cards/modify')
        .set('Authorization', 'Bearer mock-token')
        .send({ cardId: 'WRITER_SPOTLIGHT', multiplier: 1.5 });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('standard');
    });
  });

  describe('POST /api/match/cards/reset', () => {
    it('should reset all card rules', async () => {
      cardSystem.disableCard('SHAKE');
      cardSystem.setCostModifier('BLUR', 1.5);
      
      const response = await request(app)
        .post('/api/match/cards/reset')
        .set('Authorization', 'Bearer mock-token');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const rules = cardSystem.getRules();
      expect(rules.disabledCards).toEqual([]);
      expect(rules.goldCostModifiers).toEqual({});
    });
  });
});

