import { describe, it, expect } from '@jest/globals';
import { CARD_CATALOG_V1, CARD_CATALOG_V1_BY_ID, getLegacyIdFromCatalogId } from '../../server/config/cards.catalog.v1.js';
import { CARDS } from '../../server/config/cards.js';

describe('Card Catalog v1', () => {
  describe('Catalog Structure', () => {
    it('should export CARD_CATALOG_V1 as an array', () => {
      expect(Array.isArray(CARD_CATALOG_V1)).toBe(true);
    });

    it('should export CARD_CATALOG_V1_BY_ID as an object', () => {
      expect(typeof CARD_CATALOG_V1_BY_ID).toBe('object');
      expect(CARD_CATALOG_V1_BY_ID).not.toBeNull();
    });

    it('should have exactly 60 cards (50 standard + 10 cosmetic)', () => {
      const standard = CARD_CATALOG_V1.filter(card => card.kind === 'standard');
      expect(standard.length).toBe(50);
      const cosmetic = CARD_CATALOG_V1.filter(card => card.kind === 'cosmetic');
      expect(cosmetic.length).toBe(10);
      expect(CARD_CATALOG_V1.length).toBe(60);
      expect(Object.keys(CARD_CATALOG_V1_BY_ID).length).toBe(60);
    });

    it('should have 50 standard cards and 10 cosmetic cards', () => {
      const standard = CARD_CATALOG_V1.filter(card => card.kind === 'standard');
      const cosmetic = CARD_CATALOG_V1.filter(card => card.kind === 'cosmetic');
      
      expect(standard.length).toBe(50);
      expect(cosmetic.length).toBe(10);
    });

    it('should have all unique IDs', () => {
      const ids = CARD_CATALOG_V1.map(card => card.id);
      const uniqueIds = new Set(ids);
      
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have CARD_CATALOG_V1_BY_ID map all IDs correctly', () => {
      CARD_CATALOG_V1.forEach(card => {
        expect(CARD_CATALOG_V1_BY_ID[card.id]).toBeDefined();
        expect(CARD_CATALOG_V1_BY_ID[card.id]).toEqual(card);
      });
    });
  });

  describe('Required Fields', () => {
    const requiredFields = ['id', 'name', 'kind', 'category', 'target', 'unlockXp', 'baseGoldCost', 'description', 'effect'];

    it('should have all required fields for each card', () => {
      CARD_CATALOG_V1.forEach(card => {
        requiredFields.forEach(field => {
          expect(card).toHaveProperty(field);
          expect(card[field]).toBeDefined();
        });
      });
    });

    it('should have valid kind values', () => {
      CARD_CATALOG_V1.forEach(card => {
        expect(['standard', 'cosmetic']).toContain(card.kind);
      });
    });

    it('should have valid target values', () => {
      CARD_CATALOG_V1.forEach(card => {
        expect(['self', 'opponent', 'both']).toContain(card.target);
      });
    });

    it('should have effect.type defined', () => {
      CARD_CATALOG_V1.forEach(card => {
        expect(card.effect).toBeDefined();
        expect(card.effect.type).toBeDefined();
        expect(typeof card.effect.type).toBe('string');
      });
    });

    it('should have numeric unlockXp and baseGoldCost', () => {
      CARD_CATALOG_V1.forEach(card => {
        expect(typeof card.unlockXp).toBe('number');
        expect(card.unlockXp).toBeGreaterThanOrEqual(0);
        expect(typeof card.baseGoldCost).toBe('number');
        expect(card.baseGoldCost).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have meta field with implemented boolean', () => {
      CARD_CATALOG_V1.forEach(card => {
        expect(card.meta).toBeDefined();
        expect(typeof card.meta.implemented).toBe('boolean');
      });
    });
  });

  describe('Original 10 Standard Cards', () => {
    const originalStandardMappings = [
      { catalogId: 'brainwave-boost', legacyId: 'BRAINWAVE_BOOST' },
      { catalogId: 'focus-draft', legacyId: 'FOCUS_DRAFT' },
      { catalogId: 'slow-suggestion', legacyId: 'SLOW_SUGGESTION' },
      { catalogId: 'swap-writer', legacyId: 'SWAP_WRITER' },
      { catalogId: 'idea-shield', legacyId: 'IDEA_SHIELD' },
      { catalogId: 'gold-rush', legacyId: 'GOLD_RUSH' },
      { catalogId: 'shake', legacyId: 'SHAKE' },
      { catalogId: 'blur', legacyId: 'BLUR' },
      { catalogId: 'overclock', legacyId: 'OVERCLOCK' },
      { catalogId: 'distract', legacyId: 'DISTRACT' }
    ];

    it('should have all 10 original standard cards marked as implemented', () => {
      originalStandardMappings.forEach(({ catalogId }) => {
        const card = CARD_CATALOG_V1_BY_ID[catalogId];
        expect(card).toBeDefined();
        expect(card.meta.implemented).toBe(true);
      });
    });

    it('should map catalog IDs to legacy IDs correctly', () => {
      originalStandardMappings.forEach(({ catalogId, legacyId }) => {
        const mappedLegacyId = getLegacyIdFromCatalogId(catalogId);
        expect(mappedLegacyId).toBe(legacyId);
      });
    });

    it('should have original cards exist in legacy CARDS', () => {
      originalStandardMappings.forEach(({ legacyId }) => {
        expect(CARDS[legacyId]).toBeDefined();
      });
    });
  });

  describe('Original 4 Cosmetic Cards', () => {
    const originalCosmeticMappings = [
      { catalogId: 'writer-spotlight', legacyId: 'WRITER_SPOTLIGHT' },
      { catalogId: 'team-banner-color', legacyId: 'TEAM_BANNER_COLOR' },
      { catalogId: 'victory-flourish', legacyId: 'VICTORY_FLOURISH' },
      { catalogId: 'signature-style', legacyId: 'SIGNATURE_STYLE' }
    ];

    it('should have all 4 original cosmetic cards marked as implemented', () => {
      originalCosmeticMappings.forEach(({ catalogId }) => {
        const card = CARD_CATALOG_V1_BY_ID[catalogId];
        expect(card).toBeDefined();
        expect(card.meta.implemented).toBe(true);
      });
    });
  });

  describe('Implementation Status', () => {
    it('should have all 60 cards marked as implemented', () => {
      const implemented = CARD_CATALOG_V1.filter(card => card.meta.implemented === true);
      expect(implemented.length).toBe(60);
    });

    it('should have no cards marked as not implemented', () => {
      const notImplemented = CARD_CATALOG_V1.filter(card => card.meta.implemented === false);
      expect(notImplemented.length).toBe(0);
    });

    it('should have meta.notes for all cards', () => {
      CARD_CATALOG_V1.forEach(card => {
        expect(card.meta.notes).toBeDefined();
        expect(typeof card.meta.notes).toBe('string');
        expect(card.meta.notes.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Effect Types', () => {
    it('should have valid effect types', () => {
      const validEffectTypes = [
        // Implemented effect types
        'TIMER_ADD',
        'TIMER_SUBTRACT',
        'TIMER_TEMPO_SWING',
        'TIMER_ADD_CONDITIONAL',
        'TIMER_ADD_IF_SUGGESTERS_LT',
        'SUGGESTION_MUTE_RECEIVE',
        'SUGGESTION_DELAY',
        'WRITER_SWAP',
        'WRITER_DOUBLE_SWAP',
        'WRITER_ROULETTE',
        'SHIELD_NEGATIVE_NEXT',
        'SHIELD_RECHARGE',
        'GOLD_GAIN',
        'SCREEN_SHAKE',
        'SCREEN_BLUR',
        'SCREEN_DISTORT',
        'MICRO_DISTRACTION',
        'MULTI',
        'IMMUNITY',
        'COSMETIC',
        // New unimplemented effect types
        'TIMER_PAUSE',
        'TIMER_PROTECT',
        'TIMER_RATE_MULT',
        'TIMER_LOAN',
        'TIMER_OVERTIME_CLAUSE',
        'TIMER_START_DELAY',
        'TIMER_INSURANCE',
        'SUGGEST_PANEL_HIDE',
        'SUGGEST_PRIORITY_CHANNEL',
        'SUGGEST_QUEUE_CLEAR',
        'SUGGEST_BROADCAST_MODE',
        'SUGGEST_PING_MUTE',
        'SUGGEST_CHAR_LIMIT',
        'WRITER_CHOOSE',
        'WRITER_LOCK',
        'WRITER_SCHEDULED_SWAP',
        'SUGGESTER_HIGHLIGHT',
        'SUGGESTER_SPECTATOR_ENABLE',
        'GOLD_STEAL',
        'GOLD_COST_MOD',
        'GOLD_COST_DISCOUNT',
        'GOLD_INTEREST',
        'GOLD_DELAYED_GAIN',
        'GOLD_REFUND_ON_BLOCK',
        'GOLD_INFLATION',
        'EFFECT_REFLECT',
        'EFFECT_CLEANSE',
        'EFFECT_IMMUNITY_DISRUPTION',
        'EFFECT_IMMUNITY_COMMS',
        'EFFECT_DECOY',
        'DECK_SHUFFLE',
        'DECK_MOVE_CARD',
        'DECK_SWAP_SLOTS',
        'DECK_RECALL',
        'CAST_LOCKOUT',
        'CAST_INSTANT',
        'UI_OVERLAY_FOG',
        'UI_CURSOR_MIRAGE',
        'UI_PANEL_SWAP',
        'UI_DIM_INPUT'
      ];

      CARD_CATALOG_V1.forEach(card => {
        // For MULTI effects, check the parts
        if (card.effect.type === 'MULTI') {
          expect(card.effect.parts).toBeDefined();
          expect(Array.isArray(card.effect.parts)).toBe(true);
          card.effect.parts.forEach(part => {
            expect(validEffectTypes).toContain(part.type);
          });
        } else {
          expect(validEffectTypes).toContain(card.effect.type);
        }
      });
    });
  });

  describe('Special Card Properties', () => {
    it('should have limits property for cards that specify them', () => {
      const overtimeClause = CARD_CATALOG_V1_BY_ID['overtime-clause'];
      expect(overtimeClause).toBeDefined();
      expect(overtimeClause.limits).toBeDefined();
      expect(overtimeClause.limits.scope).toBe('round');
      expect(overtimeClause.limits.perTeam).toBe(1);
      
      const recall = CARD_CATALOG_V1_BY_ID['recall'];
      expect(recall).toBeDefined();
      expect(recall.limits).toBeDefined();
      expect(recall.limits.scope).toBe('round');
      expect(recall.limits.perTeam).toBe(1);
    });

    it('should have cosmetic cards with baseGoldCost of 0', () => {
      const cosmeticCards = CARD_CATALOG_V1.filter(card => card.kind === 'cosmetic');
      cosmeticCards.forEach(card => {
        expect(card.baseGoldCost).toBe(0);
      });
    });
  });
});

