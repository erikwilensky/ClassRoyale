import { describe, it, expect } from '@jest/globals';
import { quizReducer } from '../../client/src/quiz/quizReducer.js';
import { initialQuizState } from '../../client/src/quiz/quizState.js';

describe('quizReducer', () => {
  describe('MODERATION_UPDATE', () => {
    it('should update moderation state correctly', () => {
      const action = {
        type: 'MODERATION_UPDATE',
        mutedPlayers: ['player1', 'player2'],
        frozenTeams: ['teamA'],
        roundFrozen: true
      };

      const newState = quizReducer(initialQuizState, action);

      expect(newState.moderation.mutedPlayers).toEqual(['player1', 'player2']);
      expect(newState.moderation.frozenTeams).toEqual(['teamA']);
      expect(newState.moderation.roundFrozen).toBe(true);
    });

    it('should preserve existing moderation state when fields are missing', () => {
      const stateWithModeration = {
        ...initialQuizState,
        moderation: {
          mutedPlayers: ['player1'],
          frozenTeams: ['teamA'],
          roundFrozen: false
        }
      };

      const action = {
        type: 'MODERATION_UPDATE',
        mutedPlayers: ['player2']
        // frozenTeams and roundFrozen not provided
      };

      const newState = quizReducer(stateWithModeration, action);

      expect(newState.moderation.mutedPlayers).toEqual(['player2']);
      expect(newState.moderation.frozenTeams).toEqual(['teamA']); // Preserved
      expect(newState.moderation.roundFrozen).toBe(false); // Preserved
    });
  });

  describe('CARD_RULES_UPDATE', () => {
    it('should update card rules correctly', () => {
      const action = {
        type: 'CARD_RULES_UPDATE',
        disabledCards: ['SHAKE', 'BLUR'],
        goldCostModifiers: { 'SHAKE': 1.5, 'BLUR': 0.75 }
      };

      const newState = quizReducer(initialQuizState, action);

      expect(newState.cardRules.disabledCards).toEqual(['SHAKE', 'BLUR']);
      expect(newState.cardRules.goldCostModifiers).toEqual({ 'SHAKE': 1.5, 'BLUR': 0.75 });
    });

    it('should preserve existing card rules when fields are missing', () => {
      const stateWithRules = {
        ...initialQuizState,
        cardRules: {
          disabledCards: ['SHAKE'],
          goldCostModifiers: { 'SHAKE': 1.5 }
        }
      };

      const action = {
        type: 'CARD_RULES_UPDATE',
        disabledCards: ['BLUR']
        // goldCostModifiers not provided
      };

      const newState = quizReducer(stateWithRules, action);

      expect(newState.cardRules.disabledCards).toEqual(['BLUR']);
      expect(newState.cardRules.goldCostModifiers).toEqual({ 'SHAKE': 1.5 }); // Preserved
    });
  });

  describe('ROUND_STATE_UPDATE', () => {
    it('should update round state correctly', () => {
      const action = {
        type: 'ROUND_STATE_UPDATE',
        state: 'ROUND_ACTIVE',
        roundNumber: 2
      };

      const newState = quizReducer(initialQuizState, action);

      expect(newState.round.roundState).toBe('ROUND_ACTIVE');
      expect(newState.round.roundNumber).toBe(2);
    });

    it('should preserve existing round state when fields are missing', () => {
      const stateWithRound = {
        ...initialQuizState,
        round: {
          ...initialQuizState.round,
          roundState: 'ROUND_ACTIVE',
          roundNumber: 1,
          questionText: 'Test question'
        }
      };

      const action = {
        type: 'ROUND_STATE_UPDATE',
        state: 'ROUND_REVIEW'
        // roundNumber not provided
      };

      const newState = quizReducer(stateWithRound, action);

      expect(newState.round.roundState).toBe('ROUND_REVIEW');
      expect(newState.round.roundNumber).toBe(1); // Preserved
      expect(newState.round.questionText).toBe('Test question'); // Preserved
    });
  });

  describe('QUESTION_UPDATE', () => {
    it('should update question text correctly', () => {
      const action = {
        type: 'QUESTION_UPDATE',
        question: 'What is 2+2?'
      };

      const newState = quizReducer(initialQuizState, action);

      expect(newState.round.questionText).toBe('What is 2+2?');
    });

    it('should preserve existing round state when question is missing', () => {
      const stateWithQuestion = {
        ...initialQuizState,
        round: {
          ...initialQuizState.round,
          questionText: 'Original question',
          roundState: 'ROUND_ACTIVE'
        }
      };

      const action = {
        type: 'QUESTION_UPDATE'
        // question not provided
      };

      const newState = quizReducer(stateWithQuestion, action);

      expect(newState.round.questionText).toBe('Original question'); // Preserved
      expect(newState.round.roundState).toBe('ROUND_ACTIVE'); // Preserved
    });
  });

  describe('TEAM_UPDATE', () => {
    it('should normalize teams correctly', () => {
      const action = {
        type: 'TEAM_UPDATE',
        teams: {
          'teamA': {
            name: 'Team Alpha',
            gold: 10,
            writerPlayerId: 'player1',
            suggesterPlayerIds: ['player2', 'player3'],
            answer: 'Answer A',
            locked: false,
            writer: 'session1',
            suggesters: ['session2', 'session3'],
            suggestions: [
              { text: 'Suggestion 1', suggesterId: 'player2', timestamp: 1000 }
            ]
          }
        }
      };

      const newState = quizReducer(initialQuizState, action);

      expect(newState.teams.teamA).toBeDefined();
      expect(newState.teams.teamA.name).toBe('Team Alpha');
      expect(newState.teams.teamA.gold).toBe(10);
      expect(newState.teams.teamA.writerPlayerId).toBe('player1');
      expect(newState.teams.teamA.suggesterPlayerIds).toEqual(['player2', 'player3']);
      expect(newState.teams.teamA.answer).toBe('Answer A');
      expect(newState.teams.teamA.locked).toBe(false);
      // Backward compatibility fields
      expect(newState.teams.teamA.writer).toBe('session1');
      expect(newState.teams.teamA.suggesters).toEqual(['session2', 'session3']);
      expect(newState.teams.teamA.suggestions).toHaveLength(1);
    });

    it('should handle missing team data gracefully', () => {
      const action = {
        type: 'TEAM_UPDATE',
        teams: {
          'teamB': {
            name: 'Team Beta'
            // Missing other fields
          }
        }
      };

      const newState = quizReducer(initialQuizState, action);

      expect(newState.teams.teamB).toBeDefined();
      expect(newState.teams.teamB.name).toBe('Team Beta');
      expect(newState.teams.teamB.gold).toBe(0); // Default
      expect(newState.teams.teamB.writerPlayerId).toBeNull();
      expect(newState.teams.teamB.suggesterPlayerIds).toEqual([]);
      expect(newState.teams.teamB.answer).toBe('');
      expect(newState.teams.teamB.locked).toBe(false);
    });
  });

  describe('STATE_SYNC', () => {
    it('should merge Colyseus state correctly', () => {
      const mockColyseusState = {
        roundState: 'ROUND_ACTIVE',
        questionText: 'Test question',
        timeRemaining: 60,
        timerEnabled: true,
        teams: new Map([
          ['teamA', {
            name: 'Team Alpha',
            gold: 5,
            writer: 'session1',
            suggesters: [],
            answer: 'Answer',
            locked: false
          }]
        ]),
        gold: new Map([
          ['teamA', 5]
        ])
      };

      const action = {
        type: 'STATE_SYNC',
        state: mockColyseusState
      };

      const newState = quizReducer(initialQuizState, action);

      expect(newState.round.roundState).toBe('ROUND_ACTIVE');
      expect(newState.round.questionText).toBe('Test question');
      expect(newState.round.timeRemaining).toBe(60);
      expect(newState.round.timerEnabled).toBe(true);
      expect(newState.teams.teamA).toBeDefined();
      expect(newState.teams.teamA.gold).toBe(5);
    });
  });

  describe('Multiple actions in sequence', () => {
    it('should produce correct final state after multiple updates', () => {
      let state = initialQuizState;

      // Update round state
      state = quizReducer(state, {
        type: 'ROUND_STATE_UPDATE',
        state: 'ROUND_ACTIVE',
        roundNumber: 1
      });

      // Update question
      state = quizReducer(state, {
        type: 'QUESTION_UPDATE',
        question: 'What is 2+2?'
      });

      // Update moderation
      state = quizReducer(state, {
        type: 'MODERATION_UPDATE',
        mutedPlayers: ['player1'],
        frozenTeams: [],
        roundFrozen: false
      });

      // Update card rules
      state = quizReducer(state, {
        type: 'CARD_RULES_UPDATE',
        disabledCards: ['SHAKE'],
        goldCostModifiers: {}
      });

      expect(state.round.roundState).toBe('ROUND_ACTIVE');
      expect(state.round.roundNumber).toBe(1);
      expect(state.round.questionText).toBe('What is 2+2?');
      expect(state.moderation.mutedPlayers).toEqual(['player1']);
      expect(state.cardRules.disabledCards).toEqual(['SHAKE']);
    });
  });
});


