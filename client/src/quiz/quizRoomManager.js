/**
 * Connection manager for QuizRoom that caches teacher room connections.
 * Prevents teacher subpages from creating new rooms or losing state when navigating.
 */

import { joinQuizRoom, joinQuizRoomById } from "../ws/colyseusClient.js";
import { getCurrentQuizRoomId, setCurrentQuizRoomId, clearCurrentQuizRoomId } from "./roomId.js";

// Cache for room connections by role
const roomCache = new Map();

// Cache for teams state (persists across component unmount/remount)
// This solves the problem where React state is lost on navigation but the room connection persists
let teamsCache = {};

/**
 * Gets the cached teams.
 * @returns {Object} The cached teams object
 */
export function getCachedTeams() {
  return teamsCache;
}

/**
 * Updates the teams cache. Call this whenever teams change.
 * @param {Object} teams - The teams object to cache
 */
export function setCachedTeams(teams) {
  if (teams && Object.keys(teams).length > 0) {
    teamsCache = { ...teams };
    console.log("[quizRoomManager] Cached teams:", Object.keys(teamsCache).length, "teams");
  }
}

/**
 * Clears the teams cache. Call this on match reset or logout.
 */
export function clearTeamsCache() {
  teamsCache = {};
  console.log("[quizRoomManager] Cleared teams cache");
}

/**
 * Connects to a QuizRoom, reusing cached connection for teacher role when possible.
 * 
 * @param {Object} options - Connection options
 * @param {string} options.role - Role: "teacher", "student", or "display"
 * @param {string} [options.token] - JWT token for authentication
 * @param {string} [options.roomId] - Specific room ID to connect to (optional)
 * @returns {Promise<Room>} The connected room instance
 */
export async function connectQuizRoom({ role, token = null, roomId = null }) {
  // For teacher role, check cache first
  if (role === "teacher") {
    const cachedRoom = roomCache.get("teacher");
    if (cachedRoom) {
      // Check if cached room is still valid (not closed)
      if (cachedRoom.connection && cachedRoom.connection.isOpen !== false) {
        // If roomId is specified and matches cached room, reuse it
        const cachedRoomId = cachedRoom.id || cachedRoom.roomId;
        if (!roomId || cachedRoomId === roomId) {
          console.log("[quizRoomManager] Reusing cached teacher room:", cachedRoomId);
          return cachedRoom;
        }
      } else {
        // Cached room is closed, remove from cache
        roomCache.delete("teacher");
      }
    }
  }

  // Get room ID if not provided
  if (!roomId) {
    roomId = getCurrentQuizRoomId();
  }

  let joinedRoom;

  if (roomId) {
    // Connect to specific room
    console.log(`[quizRoomManager] Connecting to room ${roomId} as ${role}`);
    try {
      joinedRoom = await joinQuizRoomById(roomId, role, token);
      
      // Store room ID if we got it from the room
      const actualRoomId = joinedRoom.id || joinedRoom.roomId;
      if (actualRoomId) {
        setCurrentQuizRoomId(actualRoomId);
      }
    } catch (error) {
      // Handle dead room detection
      if (error.message && (error.message.includes("not found") || error.message.includes("room not found"))) {
        console.warn(`[quizRoomManager] Room ${roomId} not found, clearing room ID`);
        clearCurrentQuizRoomId();
        throw new Error(`Room ${roomId} no longer exists. Please ensure teacher has started a match.`);
      }
      throw error; // Re-throw other errors
    }
  } else {
    // Create new room (backward compatibility)
    console.log(`[quizRoomManager] Creating new room as ${role}`);
    joinedRoom = await joinQuizRoom(role, token);
    
    // Store room ID
    const actualRoomId = joinedRoom.id || joinedRoom.roomId;
    if (actualRoomId) {
      setCurrentQuizRoomId(actualRoomId);
    }
  }

  // Cache teacher room connection
  if (role === "teacher") {
    roomCache.set("teacher", joinedRoom);
    console.log("[quizRoomManager] Cached teacher room connection");
  }

  return joinedRoom;
}

/**
 * Gets an existing cached room connection for a role.
 * Mainly useful for teacher role to check if connection exists.
 * 
 * @param {string} role - Role to get cached room for
 * @returns {Room | null} The cached room if it exists and is open, null otherwise
 */
export function getExistingRoom(role) {
  const cachedRoom = roomCache.get(role);
  if (cachedRoom && cachedRoom.connection && cachedRoom.connection.isOpen !== false) {
    return cachedRoom;
  }
  // Remove stale cache entry
  if (cachedRoom) {
    roomCache.delete(role);
  }
  return null;
}

/**
 * Explicitly leaves a room and clears the cache for that role.
 * 
 * @param {string} role - Role to leave room for
 */
export async function leaveRoom(role) {
  const cachedRoom = roomCache.get(role);
  if (cachedRoom) {
    try {
      await cachedRoom.leave();
    } catch (error) {
      console.warn(`[quizRoomManager] Error leaving room for ${role}:`, error);
    }
    roomCache.delete(role);
    console.log(`[quizRoomManager] Left and cleared cache for ${role}`);
  }
}


