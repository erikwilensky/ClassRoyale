/**
 * Single source of truth for quiz room ID management.
 * Handles room ID storage and retrieval across localStorage and sessionStorage.
 */

/**
 * Gets the current quiz room ID from storage.
 * Checks in priority order:
 * 1. localStorage.quizRoomId (lobby flow)
 * 2. localStorage.currentQuizRoomId (teacher stored)
 * 3. sessionStorage.currentQuizRoomId
 * 
 * @returns {string | null} The room ID if found, null otherwise
 */
export function getCurrentQuizRoomId() {
  // Priority 1: quizRoomId from lobby
  const quizRoomId = localStorage.getItem("quizRoomId");
  if (quizRoomId) {
    return quizRoomId;
  }

  // Priority 2: currentQuizRoomId from teacher
  const currentQuizRoomId = localStorage.getItem("currentQuizRoomId");
  if (currentQuizRoomId) {
    return currentQuizRoomId;
  }

  // Priority 3: currentQuizRoomId from sessionStorage
  const sessionQuizRoomId = sessionStorage.getItem("currentQuizRoomId");
  if (sessionQuizRoomId) {
    return sessionQuizRoomId;
  }

  return null;
}

/**
 * Sets the current quiz room ID in both localStorage and sessionStorage.
 * 
 * @param {string} roomId - The room ID to store
 */
export function setCurrentQuizRoomId(roomId) {
  if (roomId) {
    localStorage.setItem("currentQuizRoomId", roomId);
    sessionStorage.setItem("currentQuizRoomId", roomId);
  }
}

/**
 * Clears all quiz room ID storage keys.
 * Removes:
 * - localStorage.quizRoomId
 * - localStorage.currentQuizRoomId
 * - sessionStorage.currentQuizRoomId
 */
export function clearCurrentQuizRoomId() {
  localStorage.removeItem("quizRoomId");
  localStorage.removeItem("currentQuizRoomId");
  sessionStorage.removeItem("currentQuizRoomId");
}


