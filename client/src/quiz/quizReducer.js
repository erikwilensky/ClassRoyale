/**
 * Pure reducer function for QuizRoom state updates.
 * Handles all WebSocket messages and state synchronization.
 */

import { initialQuizState } from "./quizState.js";

/**
 * Reduces quiz state based on action type.
 * 
 * @param {Object} state - Current state
 * @param {Object} action - Action with type and payload
 * @returns {Object} New state
 */
export function quizReducer(state = initialQuizState, action) {
  switch (action.type) {
    case "CONNECTION_STATUS": {
      return {
        ...state,
        connection: {
          ...state.connection,
          status: action.status || state.connection.status,
          roomId: action.roomId !== undefined ? action.roomId : state.connection.roomId,
          role: action.role !== undefined ? action.role : state.connection.role
        }
      };
    }

    case "STATE_SYNC": {
      // Merge Colyseus state into our normalized state
      const colyseusState = action.state || {};
      const newState = { ...state };

      // Update round state
      if (colyseusState.roundState !== undefined) {
        newState.round = {
          ...newState.round,
          roundState: colyseusState.roundState
        };
      }
      if (colyseusState.questionText !== undefined) {
        newState.round = {
          ...newState.round,
          questionText: colyseusState.questionText
        };
      }
      if (colyseusState.timeRemaining !== undefined) {
        newState.round = {
          ...newState.round,
          timeRemaining: colyseusState.timeRemaining
        };
      }
      if (colyseusState.timerEnabled !== undefined) {
        newState.round = {
          ...newState.round,
          timerEnabled: colyseusState.timerEnabled
        };
      }

      // Update teams from state
      // CRITICAL: Only overwrite teams if the incoming state actually has teams
      // This prevents empty cached room state from clearing existing teams when navigating back
      if (colyseusState.teams && colyseusState.teams.has) {
        const teams = {};
        colyseusState.teams.forEach((team, teamId) => {
          teams[teamId] = normalizeTeamData(team, teamId);
        });
        // Only update teams if incoming state has teams, OR if current state is empty
        // This preserves teams when navigating back from Moderation if cached room state is stale
        if (Object.keys(teams).length > 0 || Object.keys(state.teams || {}).length === 0) {
          newState.teams = teams;
        }
        // Otherwise preserve existing teams
      }

      // Update gold from state
      if (colyseusState.gold && colyseusState.gold.has) {
        const updatedTeams = { ...newState.teams };
        colyseusState.gold.forEach((gold, teamId) => {
          if (updatedTeams[teamId]) {
            updatedTeams[teamId] = {
              ...updatedTeams[teamId],
              gold: gold
            };
          }
        });
        newState.teams = updatedTeams;
      }

      return newState;
    }

    case "ROUND_STATE_UPDATE": {
      const newState = {
        ...state,
        round: {
          ...state.round,
          roundState: action.state || state.round.roundState,
          roundNumber: action.roundNumber !== undefined ? action.roundNumber : state.round.roundNumber
        }
      };
      return newState;
    }

    case "QUESTION_UPDATE": {
      return {
        ...state,
        round: {
          ...state.round,
          questionText: action.question || state.round.questionText
        }
      };
    }

    case "TIMER_UPDATE": {
      return {
        ...state,
        round: {
          ...state.round,
          timeRemaining: action.timeRemaining !== undefined ? action.timeRemaining : state.round.timeRemaining,
          timerEnabled: action.enabled !== undefined ? action.enabled : state.round.timerEnabled
        }
      };
    }

    case "TEAM_UPDATE": {
      if (!action.teams) {
        return state;
      }

      const teams = {};
      for (const [teamId, teamData] of Object.entries(action.teams)) {
        teams[teamId] = normalizeTeamData(teamData, teamId);
      }

      return {
        ...state,
        teams
      };
    }

    case "GOLD_UPDATE": {
      if (!action.teams) {
        return state;
      }

      const updatedTeams = { ...state.teams };
      for (const [teamId, gold] of Object.entries(action.teams)) {
        if (updatedTeams[teamId]) {
          updatedTeams[teamId] = {
            ...updatedTeams[teamId],
            gold: gold
          };
        } else {
          // Team doesn't exist yet, create minimal entry
          updatedTeams[teamId] = {
            name: teamId,
            gold: gold,
            writerPlayerId: null,
            suggesterPlayerIds: [],
            answer: "",
            locked: false,
            // Chapter 16: Deck defaults
            deckSlots: [null, null, null, null],
            deckLocked: false,
            teamCardPool: [],
            writer: null,
            suggesters: [],
            suggestions: []
          };
        }
      }

      return {
        ...state,
        teams: updatedTeams
      };
    }

    case "ROUND_SCORE": {
      return {
        ...state,
        scoring: {
          ...state.scoring,
          roundResult: action.roundResult || state.scoring.roundResult
        }
      };
    }

    case "MATCH_OVER": {
      return {
        ...state,
        scoring: {
          ...state.scoring,
          matchOver: true,
          matchResult: action.matchResult || state.scoring.matchResult,
          matchScores: action.finalScores?.teams || state.scoring.matchScores
        }
      };
    }

    case "MATCH_RESET": {
      return {
        ...state,
        round: {
          ...state.round,
          roundState: "ROUND_WAITING",
          roundNumber: 0,
          questionText: "",
          timeRemaining: 0,
          timerEnabled: false
        },
        scoring: {
          roundResult: null,
          matchResult: null,
          matchOver: false,
          matchScores: {}
        },
        effects: {
          activeEffects: []
        }
      };
    }

    case "CARD_CAST": {
      if (!action.cardId || !action.casterTeamId) {
        return state;
      }

      const newEffect = {
        cardId: action.cardId,
        casterTeamId: action.casterTeamId,
        targetTeamId: action.targetTeamId || action.casterTeamId,
        timestamp: action.timestamp || Date.now(),
        isCosmetic: action.isCosmetic || false
      };

      return {
        ...state,
        effects: {
          activeEffects: [...state.effects.activeEffects, newEffect]
        }
      };
    }

    case "CARD_RULES_UPDATE": {
      return {
        ...state,
        cardRules: {
          disabledCards: Array.isArray(action.disabledCards) ? action.disabledCards : state.cardRules.disabledCards,
          goldCostModifiers: action.goldCostModifiers || state.cardRules.goldCostModifiers
        }
      };
    }

    case "MODERATION_UPDATE": {
      return {
        ...state,
        moderation: {
          mutedPlayers: Array.isArray(action.mutedPlayers) ? action.mutedPlayers : state.moderation.mutedPlayers,
          frozenTeams: Array.isArray(action.frozenTeams) ? action.frozenTeams : state.moderation.frozenTeams,
          roundFrozen: action.roundFrozen !== undefined ? action.roundFrozen : state.moderation.roundFrozen
        }
      };
    }

    case "ERROR": {
      // Error messages don't change state, but we could track them if needed
      // For now, just return state unchanged
      return state;
    }

    default:
      return state;
  }
}

/**
 * Normalizes team data from various message formats to consistent structure.
 * 
 * @param {Object} teamData - Team data from message
 * @param {string} teamId - Team ID
 * @returns {Object} Normalized team data
 */
function normalizeTeamData(teamData, teamId) {
  // Chapter 16: Normalize deck fields with defaults
  const deckSlots = Array.isArray(teamData.deckSlots) 
    ? teamData.deckSlots 
    : [null, null, null, null];
  const teamCardPool = Array.isArray(teamData.teamCardPool) 
    ? teamData.teamCardPool 
    : [];

  return {
    name: teamData.name || teamId,
    gold: teamData.gold !== undefined ? teamData.gold : 0,
    writerPlayerId: teamData.writerPlayerId || null,
    suggesterPlayerIds: Array.isArray(teamData.suggesterPlayerIds) ? teamData.suggesterPlayerIds : [],
    answer: teamData.answer || "",
    locked: teamData.locked || false,
    // Chapter 16: Deck state
    deckSlots: deckSlots,
    deckLocked: teamData.deckLocked || false,
    teamCardPool: teamCardPool,
    // Keep backward compatibility fields
    writer: teamData.writer || null,
    suggesters: Array.isArray(teamData.suggesters) ? teamData.suggesters : [],
    suggestions: Array.isArray(teamData.suggestions) 
      ? teamData.suggestions.map(s => ({
          text: s.text || "",
          suggesterId: s.suggesterId || "",
          timestamp: s.timestamp || Date.now()
        }))
      : []
  };
}

