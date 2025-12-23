/**
 * Structured debug logging utility.
 * Only logs when DEBUG_LOGS environment variable is set to "true".
 * No performance impact when disabled.
 */

/**
 * Logs debug information if DEBUG_LOGS is enabled.
 * Uses console.log with [DEBUG] prefix when enabled.
 * No-op when disabled (no performance impact).
 * 
 * @param {...any} args - Arguments to log (same as console.log)
 */
export function logDebug(...args) {
  if (process.env.DEBUG_LOGS === "true") {
    console.log("[DEBUG]", ...args);
  }
}

