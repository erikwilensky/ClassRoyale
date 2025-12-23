import { describe, it, expect } from '@jest/globals';
import {
  deriveStudentCapabilities,
  deriveDisplayViewModel,
  applyGoldCostModifier
} from '../../client/src/quiz/viewModels.js';
import { initialQuizState } from '../../client/src/quiz/quizState.js';

describe('viewModels', () => {
  describe('deriveStudentCapabilities', () => {
    const baseState = {
      ...initialQuizState,
      round: {
        ...initialQuizState.round,
        roundState: 'ROUND_ACTIVE'
      }
    };

    it('should return false for all capabilities when player is muted', () => {
      const state = {
        ...baseState,
        moderation: {
          mutedPlayers: ['player1'],
          frozenTeams: [],
          roundFrozen: false
        }
      };

      const capabilities = deriveStudentCapabilities(state, {
        playerId: 'player1',
        teamId: 'teamA',
        isWriter: true,
        teamAnswer: 'Answer'
      });

      expect(capabilities.canWriteAnswer).toBe(false);
      expect(capabilities.canLockAnswer).toBe(false);
      expect(capabilities.canSuggest).toBe(false);
      expect(capabilities.canInsertSuggestion).toBe(false);
      expect(capabilities.canCastCards).toBe(false);
    });

    it('should return false for all capabilities when team is frozen', () => {
      const state = {
        ...baseState,
        moderation: {
          mutedPlayers: [],
          frozenTeams: ['teamA'],
          roundFrozen: false
        }
      };

      const capabilities = deriveStudentCapabilities(state, {
        playerId: 'player1',
        teamId: 'teamA',
        isWriter: true,
        teamAnswer: 'Answer'
      });

      expect(capabilities.canWriteAnswer).toBe(false);
      expect(capabilities.canLockAnswer).toBe(false);
      expect(capabilities.canSuggest).toBe(false);
      expect(capabilities.canInsertSuggestion).toBe(false);
      expect(capabilities.canCastCards).toBe(false);
    });

    it('should return false for all capabilities when round is frozen', () => {
      const state = {
        ...baseState,
        moderation: {
          mutedPlayers: [],
          frozenTeams: [],
          roundFrozen: true
        }
      };

      const capabilities = deriveStudentCapabilities(state, {
        playerId: 'player1',
        teamId: 'teamA',
        isWriter: true,
        teamAnswer: 'Answer'
      });

      expect(capabilities.canWriteAnswer).toBe(false);
      expect(capabilities.canLockAnswer).toBe(false);
      expect(capabilities.canSuggest).toBe(false);
      expect(capabilities.canInsertSuggestion).toBe(false);
      expect(capabilities.canCastCards).toBe(false);
    });

    it('should return true for appropriate capabilities when round is active and not muted/frozen', () => {
      const state = {
        ...baseState,
        moderation: {
          mutedPlayers: [],
          frozenTeams: [],
          roundFrozen: false
        }
      };

      // Writer with answer
      const writerCapabilities = deriveStudentCapabilities(state, {
        playerId: 'player1',
        teamId: 'teamA',
        isWriter: true,
        teamAnswer: 'Answer'
      });

      expect(writerCapabilities.canWriteAnswer).toBe(true);
      expect(writerCapabilities.canLockAnswer).toBe(true);
      expect(writerCapabilities.canSuggest).toBe(true);
      expect(writerCapabilities.canInsertSuggestion).toBe(true);
      expect(writerCapabilities.canCastCards).toBe(true);

      // Writer without answer
      const writerNoAnswer = deriveStudentCapabilities(state, {
        playerId: 'player1',
        teamId: 'teamA',
        isWriter: true,
        teamAnswer: ''
      });

      expect(writerNoAnswer.canWriteAnswer).toBe(true);
      expect(writerNoAnswer.canLockAnswer).toBe(false); // No answer to lock

      // Suggester (not writer)
      const suggesterCapabilities = deriveStudentCapabilities(state, {
        playerId: 'player2',
        teamId: 'teamA',
        isWriter: false,
        teamAnswer: 'Answer'
      });

      expect(suggesterCapabilities.canWriteAnswer).toBe(false); // Not writer
      expect(suggesterCapabilities.canLockAnswer).toBe(false); // Not writer
      expect(suggesterCapabilities.canSuggest).toBe(true);
      expect(suggesterCapabilities.canInsertSuggestion).toBe(false); // Not writer
      expect(suggesterCapabilities.canCastCards).toBe(true);
    });

    it('should return false for all capabilities when round is not active', () => {
      const state = {
        ...initialQuizState,
        round: {
          ...initialQuizState.round,
          roundState: 'ROUND_WAITING'
        },
        moderation: {
          mutedPlayers: [],
          frozenTeams: [],
          roundFrozen: false
        }
      };

      const capabilities = deriveStudentCapabilities(state, {
        playerId: 'player1',
        teamId: 'teamA',
        isWriter: true,
        teamAnswer: 'Answer'
      });

      expect(capabilities.canWriteAnswer).toBe(false);
      expect(capabilities.canLockAnswer).toBe(false);
      expect(capabilities.canSuggest).toBe(false);
      expect(capabilities.canInsertSuggestion).toBe(false);
      expect(capabilities.canCastCards).toBe(false);
    });
  });

  describe('deriveDisplayViewModel', () => {
    it('should generate correct headline and subhead for different round states', () => {
      const waitingState = {
        ...initialQuizState,
        round: {
          ...initialQuizState.round,
          roundState: 'ROUND_WAITING',
          roundNumber: 1
        }
      };

      const waitingVM = deriveDisplayViewModel(waitingState);
      expect(waitingVM.headline).toBe('Round 1 - Waiting');
      expect(waitingVM.subhead).toBe('Waiting for question...');

      const activeState = {
        ...initialQuizState,
        round: {
          ...initialQuizState.round,
          roundState: 'ROUND_ACTIVE',
          roundNumber: 2,
          questionText: 'What is 2+2?'
        }
      };

      const activeVM = deriveDisplayViewModel(activeState);
      expect(activeVM.headline).toBe('Round 2 - Active');
      expect(activeVM.subhead).toBe('Question: What is 2+2?');
    });

    it('should detect paused state from moderation', () => {
      const pausedState = {
        ...initialQuizState,
        moderation: {
          mutedPlayers: [],
          frozenTeams: [],
          roundFrozen: true
        }
      };

      const vm = deriveDisplayViewModel(pausedState);
      expect(vm.isPaused).toBe(true);
    });

    it('should include frozen teams', () => {
      const frozenState = {
        ...initialQuizState,
        moderation: {
          mutedPlayers: [],
          frozenTeams: ['teamA', 'teamB'],
          roundFrozen: false
        }
      };

      const vm = deriveDisplayViewModel(frozenState);
      expect(vm.frozenTeams).toEqual(['teamA', 'teamB']);
    });
  });

  describe('applyGoldCostModifier', () => {
    it('should apply multiplier correctly with ceiling', () => {
      expect(applyGoldCostModifier(3, 1.5)).toBe(5); // Math.ceil(3 * 1.5) = Math.ceil(4.5) = 5
      expect(applyGoldCostModifier(2, 0.75)).toBe(2); // Math.ceil(2 * 0.75) = Math.ceil(1.5) = 2
      expect(applyGoldCostModifier(5, 2.0)).toBe(10); // Math.ceil(5 * 2.0) = 10
    });

    it('should enforce minimum of 1', () => {
      expect(applyGoldCostModifier(1, 0.5)).toBe(1); // Math.ceil(1 * 0.5) = 1, but min is 1
      expect(applyGoldCostModifier(2, 0.4)).toBe(1); // Math.ceil(2 * 0.4) = Math.ceil(0.8) = 1
      expect(applyGoldCostModifier(1, 0.1)).toBe(1); // Math.ceil(1 * 0.1) = Math.ceil(0.1) = 1
    });

    it('should handle edge cases', () => {
      // Zero cost
      expect(applyGoldCostModifier(0, 1.5)).toBe(1); // Minimum is 1
      
      // Negative cost (shouldn't happen, but handle gracefully)
      expect(applyGoldCostModifier(-1, 1.5)).toBe(1); // Minimum is 1
      
      // Very small multiplier
      expect(applyGoldCostModifier(10, 0.05)).toBe(1); // Math.ceil(10 * 0.05) = Math.ceil(0.5) = 1
      
      // Very large multiplier
      expect(applyGoldCostModifier(3, 10.0)).toBe(30); // Math.ceil(3 * 10.0) = 30
    });

    it('should match server logic exactly', () => {
      // Test cases that match server implementation
      const testCases = [
        { base: 3, multiplier: 1.5, expected: 5 },
        { base: 2, multiplier: 0.75, expected: 2 },
        { base: 5, multiplier: 2.0, expected: 10 },
        { base: 1, multiplier: 0.5, expected: 1 },
        { base: 4, multiplier: 1.0, expected: 4 }
      ];

      testCases.forEach(({ base, multiplier, expected }) => {
        const result = applyGoldCostModifier(base, multiplier);
        expect(result).toBe(expected);
      });
    });
  });
});


