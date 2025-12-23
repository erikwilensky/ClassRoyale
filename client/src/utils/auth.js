/**
 * Client-side authentication utilities
 */

const TOKEN_KEY = "classroyale_token";

/**
 * Get JWT token from localStorage
 */
export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * Save JWT token to localStorage
 */
export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove JWT token from localStorage
 */
export function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
}

/**
 * Check if token exists and is not expired
 */
export function isAuthenticated() {
    const token = getToken();
    if (!token) {
        return false;
    }
    return !isTokenExpired(token);
}

/**
 * Check if JWT token is expired
 */
export function isTokenExpired(token) {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const exp = payload.exp * 1000; // Convert to milliseconds
        return Date.now() >= exp;
    } catch (error) {
        return true; // If we can't parse, consider it expired
    }
}

/**
 * Decode playerId from JWT token (client-side)
 */
export function getPlayerId() {
    const token = getToken();
    if (!token) {
        return null;
    }
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.playerId || null;
    } catch (error) {
        return null;
    }
}

/**
 * Decode isTeacher from JWT token
 */
export function getIsTeacher() {
    const token = getToken();
    if (!token) {
        return false;
    }
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return Boolean(payload.isTeacher);
    } catch (error) {
        return false;
    }
}

/**
 * Refresh token by calling login endpoint (future use)
 */
export async function refreshToken() {
    // TODO: Implement token refresh endpoint
    // For now, user needs to login again
    return null;
}



