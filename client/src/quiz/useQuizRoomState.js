/**
 * React hook for managing QuizRoom connection and state.
 * Centralizes all message handling and state management.
 */

import { useEffect, useReducer, useState, useRef } from "react";
import { connectQuizRoom, leaveRoom, getExistingRoom, getCachedTeams, setCachedTeams } from "./quizRoomManager.js";
import { getCurrentQuizRoomId, setCurrentQuizRoomId, clearCurrentQuizRoomId } from "./roomId.js";
import { quizReducer } from "./quizReducer.js";
import { initialQuizState } from "./quizState.js";
import { MSG } from "./messageTypes.js";
import { getRoleMessageTypes } from "./roleHandlers.js";

/**
 * Hook for managing QuizRoom state and connection.
 * 
 * @param {Object} options - Hook options
 * @param {string} options.role - Role: "teacher", "student", or "display"
 * @param {string} [options.token] - JWT token for authentication
 * @returns {Object} { state, room, connectionStatus }
 */
export function useQuizRoomState({ role, token = null }) {
  const [state, dispatch] = useReducer(quizReducer, initialQuizState);
  const [room, setRoom] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const isMountedRef = useRef(true);
  const roomRef = useRef(null);
  const dispatchRef = useRef(dispatch); // Ref to always use current dispatch
  // Keep dispatch ref up to date
  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  // Extract handler registration into a reusable function
  // This allows us to register handlers immediately for cached rooms
  // Only registers messages for the current role to reduce "onMessage not registered" warnings
  const registerAllHandlers = (room) => {
    // Get role-specific message types
    const roleMessages = getRoleMessageTypes(role);
    const messageSet = new Set(roleMessages);

    // Register ROOM_ID handler (for teacher/display)
    if (messageSet.has(MSG.ROOM_ID)) {
      room.onMessage(MSG.ROOM_ID, (message) => {
        if (message && message.roomId && isMountedRef.current) {
          setCurrentQuizRoomId(message.roomId);
          dispatchRef.current({
            type: "CONNECTION_STATUS",
            roomId: message.roomId
          });
        }
      });
    }

    // Register ROUND_STATE_UPDATE handler
    if (messageSet.has(MSG.ROUND_STATE_UPDATE)) {
      room.onMessage(MSG.ROUND_STATE_UPDATE, (message) => {
        if (isMountedRef.current) {
          dispatchRef.current({
            type: "ROUND_STATE_UPDATE",
            state: message.state,
            roundNumber: message.roundNumber
          });
        }
      });
    }

    // Register QUESTION_UPDATE handler
    if (messageSet.has(MSG.QUESTION_UPDATE)) {
      room.onMessage(MSG.QUESTION_UPDATE, (message) => {
        if (isMountedRef.current) {
          dispatchRef.current({
            type: "QUESTION_UPDATE",
            question: message.question
          });
        }
      });
    }

    // Register TIMER_UPDATE handler
    if (messageSet.has(MSG.TIMER_UPDATE)) {
      room.onMessage(MSG.TIMER_UPDATE, (message) => {
        if (isMountedRef.current) {
          dispatchRef.current({
            type: "TIMER_UPDATE",
            timeRemaining: message.timeRemaining,
            enabled: message.enabled
          });
        }
      });
    }

    // Register TEAM_UPDATE handler - CRITICAL for teams persistence
    if (messageSet.has(MSG.TEAM_UPDATE)) {
      room.onMessage(MSG.TEAM_UPDATE, (message) => {
        if (isMountedRef.current) {
          console.log("[useQuizRoomState] TEAM_UPDATE received:", Object.keys(message.teams || {}).length, "teams");
          // Cache teams for persistence across navigation
          if (message.teams && Object.keys(message.teams).length > 0) {
            setCachedTeams(message.teams);
          }
          dispatchRef.current({
            type: "TEAM_UPDATE",
            teams: message.teams
          });
        }
      });
    }

    // Register GOLD_UPDATE handler
    if (messageSet.has(MSG.GOLD_UPDATE)) {
      room.onMessage(MSG.GOLD_UPDATE, (message) => {
        if (isMountedRef.current) {
          dispatchRef.current({
            type: "GOLD_UPDATE",
            teams: message.teams || message.gold
          });
        }
      });
    }

    // Register ROUND_STARTED handler (updates round state and question)
    if (messageSet.has(MSG.ROUND_STARTED)) {
      room.onMessage(MSG.ROUND_STARTED, (message) => {
        if (isMountedRef.current) {
          dispatchRef.current({
            type: "ROUND_STATE_UPDATE",
            state: "ROUND_ACTIVE",
            roundNumber: message.roundNumber
          });
          if (message.question) {
            dispatchRef.current({
              type: "QUESTION_UPDATE",
              question: message.question
            });
          }
          if (message.duration !== undefined) {
            dispatchRef.current({
              type: "TIMER_UPDATE",
              timeRemaining: message.duration,
              enabled: true
            });
          }
        }
      });
    }

    // Register ROUND_ENDED handler
    if (messageSet.has(MSG.ROUND_ENDED)) {
      room.onMessage(MSG.ROUND_ENDED, (message) => {
        if (isMountedRef.current) {
          dispatchRef.current({
            type: "ROUND_STATE_UPDATE",
            state: "ROUND_REVIEW"
          });
        }
      });
    }

    // Register ROUND_SCORE handler
    if (messageSet.has(MSG.ROUND_SCORE)) {
      room.onMessage(MSG.ROUND_SCORE, (message) => {
        if (isMountedRef.current) {
          dispatchRef.current({
            type: "ROUND_SCORE",
            roundResult: message
          });
        }
      });
    }

    // Register MATCH_OVER handler
    if (messageSet.has(MSG.MATCH_OVER)) {
      room.onMessage(MSG.MATCH_OVER, (message) => {
        if (isMountedRef.current) {
          dispatchRef.current({
            type: "MATCH_OVER",
            matchResult: message,
            finalScores: message.finalScores
          });
        }
      });
    }

    // Register MATCH_RESET handler
    if (messageSet.has(MSG.MATCH_RESET)) {
      room.onMessage(MSG.MATCH_RESET, (message) => {
        if (isMountedRef.current) {
          dispatchRef.current({
            type: "MATCH_RESET"
          });
        }
      });
    }

    // Register CARD_CAST handler
    if (messageSet.has(MSG.CARD_CAST)) {
      room.onMessage(MSG.CARD_CAST, (message) => {
        if (isMountedRef.current) {
          dispatchRef.current({
            type: "CARD_CAST",
            cardId: message.cardId,
            casterTeamId: message.casterTeamId,
            targetTeamId: message.targetTeamId,
            isCosmetic: message.isCosmetic,
            timestamp: Date.now()
          });
        }
      });
    }

    // Register CARD_RULES_UPDATE handler
    if (messageSet.has(MSG.CARD_RULES_UPDATE)) {
      room.onMessage(MSG.CARD_RULES_UPDATE, (message) => {
        if (isMountedRef.current) {
          dispatchRef.current({
            type: "CARD_RULES_UPDATE",
            disabledCards: message.disabledCards,
            goldCostModifiers: message.goldCostModifiers
          });
        }
      });
    }

    // Register MODERATION_UPDATE handler
    if (messageSet.has(MSG.MODERATION_UPDATE)) {
      room.onMessage(MSG.MODERATION_UPDATE, (message) => {
        if (isMountedRef.current) {
          dispatchRef.current({
            type: "MODERATION_UPDATE",
            mutedPlayers: message.mutedPlayers,
            frozenTeams: message.frozenTeams,
            roundFrozen: message.roundFrozen
          });
        }
      });
    }

    // Register ERROR handler (always registered)
    room.onMessage(MSG.ERROR, (message) => {
      if (isMountedRef.current) {
        dispatchRef.current({
          type: "ERROR",
          message: message.message
        });
      }
    });

    // Register empty handlers for other messages that might arrive but aren't processed
    // This prevents "onMessage not registered" warnings
    const emptyHandlerMessages = [
      MSG.TEAM_JOINED,
      MSG.TEAM_LEFT,
      MSG.AVAILABLE_TEAMS,
      MSG.TEAM_SETTINGS_UPDATE,
      MSG.SUGGESTION,
      MSG.ANSWER_UPDATE,
      MSG.LOCK,
      MSG.WRITER_ROTATED,
      MSG.WRITER_TRANSFERRED,
      MSG.ROUND_DATA,
      MSG.TEAM_SCORE_UPDATE,
      MSG.PLAYER_SCORE_UPDATE,
      MSG.ROUND_SCORE_UPDATE,
      MSG.XP_EARNED,
      MSG.MATCH_START,
      MSG.LOBBY_UPDATE
    ];

    emptyHandlerMessages.forEach(msgType => {
      if (messageSet.has(msgType)) {
        room.onMessage(msgType, () => {}); // Empty handler to avoid warnings
      }
    });

    // Register onStateChange AFTER all message handlers
    room.onStateChange((colyseusState) => {
      if (isMountedRef.current) {
        dispatchRef.current({
          type: "STATE_SYNC",
          state: colyseusState
        });
      }
    });
  };

  useEffect(() => {
    isMountedRef.current = true;

    async function connect() {
      try {
        // Update connection status
        dispatchRef.current({
          type: "CONNECTION_STATUS",
          status: "connecting",
          role
        });
        setConnectionStatus("connecting");

        // Get room ID
        const roomId = getCurrentQuizRoomId();

        // CRITICAL: Check for cached room BEFORE connecting (synchronously)
        // If we have a cached room, register handlers IMMEDIATELY and synchronously
        // to catch messages that arrive during the async connection
        if (role === "teacher") {
          const cachedRoom = getExistingRoom("teacher");
          if (cachedRoom && cachedRoom.connection && cachedRoom.connection.isOpen !== false) {
            const cachedRoomId = cachedRoom.id || cachedRoom.roomId;
            if (!roomId || cachedRoomId === roomId) {
              console.log("[useQuizRoomState] Detected cached room, registering handlers immediately");
              // Register handlers IMMEDIATELY on cached room (synchronously, before any messages)
              registerAllHandlers(cachedRoom);
              // Sync state immediately, but only if cached room has teams OR current state is empty
              // This prevents empty cached room state from clearing teams when navigating back
              if (cachedRoom.state) {
                const teamsCount = cachedRoom.state.teams?.size || 0;
                const cachedTeams = getCachedTeams();
                const cachedTeamsCount = Object.keys(cachedTeams).length;
                // Only sync if cached room has teams, or if this is the first connection (state will be empty)
                // The reducer will preserve existing teams if incoming state is empty
                if (teamsCount > 0) {
                  console.log("[useQuizRoomState] Immediate sync from cached room (teams:", teamsCount, ")");
                  dispatchRef.current({
                    type: "STATE_SYNC",
                    state: cachedRoom.state
                  });
                } else if (cachedTeamsCount > 0) {
                  // Cached room has no teams in Colyseus state, but we have cached teams from TEAM_UPDATE
                  // Restore teams from cache!
                  console.log("[useQuizRoomState] Restoring teams from cache:", cachedTeamsCount, "teams");
                  // Dispatch TEAM_UPDATE with cached teams to restore them
                  dispatchRef.current({
                    type: "TEAM_UPDATE",
                    teams: cachedTeams
                  });
                  // Also sync other state (round, etc.) without overwriting teams
                  const partialState = { ...cachedRoom.state };
                  delete partialState.teams;
                  dispatchRef.current({
                    type: "STATE_SYNC",
                    state: partialState
                  });
                } else {
                  // Cached room has no teams - don't sync teams, but sync other state (round, etc.)
                  // Create a partial state sync that excludes teams
                  const partialState = { ...cachedRoom.state };
                  delete partialState.teams; // Don't include teams in sync
                  dispatchRef.current({
                    type: "STATE_SYNC",
                    state: partialState
                  });
                  console.log("[useQuizRoomState] Cached room has no teams, preserving existing teams and syncing other state");
                }
              }
              // Set room immediately
              const actualRoomId = cachedRoom.id || cachedRoom.roomId;
              if (actualRoomId) {
                setCurrentQuizRoomId(actualRoomId);
                dispatchRef.current({
                  type: "CONNECTION_STATUS",
                  status: "connected",
                  roomId: actualRoomId,
                  role
                });
              }
              roomRef.current = cachedRoom;
              setRoom(cachedRoom);
              setConnectionStatus("connected");
              return; // Skip async connection, we already have the room
            }
          }
        }

        // Connect to room (only if we don't have a cached room)
        let joinedRoom;
        try {
          joinedRoom = await connectQuizRoom({ role, token, roomId });
        } catch (error) {
          // Handle dead room detection
          if (error.message && (error.message.includes("not found") || error.message.includes("room not found"))) {
            console.warn("[useQuizRoomState] Room not found, clearing room ID");
            clearCurrentQuizRoomId();
          }
          throw error; // Re-throw to be handled by outer catch
        }

        if (!isMountedRef.current) {
          // Component unmounted during connection
          await joinedRoom.leave();
          return;
        }

        // Store room ID if we got it from the room
        const actualRoomId = joinedRoom.id || joinedRoom.roomId;
        if (actualRoomId) {
          setCurrentQuizRoomId(actualRoomId);
          dispatchRef.current({
            type: "CONNECTION_STATUS",
            status: "connected",
            roomId: actualRoomId,
            role
          });
        }

        // CRITICAL: Register ALL message handlers IMMEDIATELY after getting room
        // This must happen BEFORE state sync to catch any messages that arrive
        // Use the extracted function for consistency
        registerAllHandlers(joinedRoom);

        // CRITICAL: Sync state IMMEDIATELY after handlers are registered (synchronously)
        // This ensures teams are available right away when reusing cached rooms
        // This must happen synchronously to avoid race conditions with incoming messages
        if (joinedRoom.state) {
          try {
            const teamsCount = joinedRoom.state.teams?.size || 0;
            if (teamsCount > 0) {
              console.log("[useQuizRoomState] Immediate state sync (teams:", teamsCount, ")");
            }
            dispatchRef.current({
              type: "STATE_SYNC",
              state: joinedRoom.state
            });
          } catch (error) {
            console.error("[useQuizRoomState] Error in immediate state sync:", error);
          }
        }

        // Additional state sync after a short delay (fallback for edge cases)
        // This catches any state updates that might have happened during handler registration
        setTimeout(() => {
          if (joinedRoom.state && isMountedRef.current) {
            try {
              const teamsCount = joinedRoom.state.teams?.size || 0;
              if (teamsCount > 0) {
                console.log("[useQuizRoomState] Fallback state sync (teams:", teamsCount, ")");
                dispatchRef.current({
                  type: "STATE_SYNC",
                  state: joinedRoom.state
                });
              }
            } catch (error) {
              console.error("[useQuizRoomState] Error in fallback state sync:", error);
            }
          }
        }, 100);

        // Register onLeave handler for room cleanup
        joinedRoom.onLeave((code) => {
          console.log(`[useQuizRoomState] Room left, code: ${code}`);
          // Clear room ID if teacher or display leaves
          if (role === "teacher" || role === "display") {
            clearCurrentQuizRoomId();
          }
          if (isMountedRef.current) {
            dispatchRef.current({
              type: "CONNECTION_STATUS",
              status: "disconnected"
            });
            setConnectionStatus("disconnected");
          }
        });

        // Now set room in React state (after all handlers are registered)
        roomRef.current = joinedRoom;
        setRoom(joinedRoom);
        setConnectionStatus("connected");

      } catch (error) {
        console.error(`[useQuizRoomState] Connection error for ${role}:`, error);
        // Handle dead room detection
        if (error.message && (error.message.includes("not found") || error.message.includes("room not found"))) {
          clearCurrentQuizRoomId();
        }
        if (isMountedRef.current) {
          dispatchRef.current({
            type: "CONNECTION_STATUS",
            status: "error",
            error: error.message || "Connection failed"
          });
          setConnectionStatus("error");
        }
      }
    }

    connect();

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      // Note: We don't leave the room here for teacher role to preserve connection
      // when navigating between teacher pages. The room manager handles caching.
      // For other roles, leaving is handled by the room manager if needed.
    };
  }, [role, token]);

  return {
    state,
    room,
    connectionStatus
  };
}

