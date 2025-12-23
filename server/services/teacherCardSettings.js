// Chapter 11: Teacher default card settings service
// Stores and retrieves teacher's default card configuration preferences

import { db } from "../db/database.js";

/**
 * Get default card settings for a teacher
 * @param {string} teacherId - Teacher's player ID
 * @returns {Object|null} Default settings or null if none exist
 */
export function getTeacherDefaultSettings(teacherId) {
    try {
        const stmt = db.prepare(`
            SELECT disabledCards, goldCostModifiers 
            FROM teacher_card_settings 
            WHERE teacherId = ?
        `);
        const result = stmt.get(teacherId);
        
        if (!result) {
            return null;
        }
        
        // Parse JSON strings
        const disabledCards = result.disabledCards ? JSON.parse(result.disabledCards) : [];
        const goldCostModifiers = result.goldCostModifiers ? JSON.parse(result.goldCostModifiers) : {};
        
        return {
            disabledCards: Array.isArray(disabledCards) ? disabledCards : [],
            goldCostModifiers: typeof goldCostModifiers === 'object' ? goldCostModifiers : {}
        };
    } catch (error) {
        console.error(`[TeacherCardSettings] Error getting default settings for ${teacherId}:`, error);
        return null;
    }
}

/**
 * Save default card settings for a teacher
 * @param {string} teacherId - Teacher's player ID
 * @param {string[]} disabledCards - Array of disabled card IDs
 * @param {Object} goldCostModifiers - Object mapping cardId to multiplier
 * @returns {boolean} Success status
 */
export function saveTeacherDefaultSettings(teacherId, disabledCards, goldCostModifiers) {
    try {
        // Validate inputs
        const disabledCardsArray = Array.isArray(disabledCards) ? disabledCards : [];
        const modifiersObj = typeof goldCostModifiers === 'object' && goldCostModifiers !== null ? goldCostModifiers : {};
        
        // Serialize to JSON
        const disabledCardsJson = JSON.stringify(disabledCardsArray);
        const modifiersJson = JSON.stringify(modifiersObj);
        
        // Use INSERT OR REPLACE to update if exists
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO teacher_card_settings 
            (teacherId, disabledCards, goldCostModifiers, updatedAt)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        stmt.run(teacherId, disabledCardsJson, modifiersJson);
        console.log(`[TeacherCardSettings] Saved default settings for teacher ${teacherId}`);
        return true;
    } catch (error) {
        console.error(`[TeacherCardSettings] Error saving default settings for ${teacherId}:`, error);
        return false;
    }
}

/**
 * Delete default card settings for a teacher (reset to null)
 * @param {string} teacherId - Teacher's player ID
 * @returns {boolean} Success status
 */
export function deleteTeacherDefaultSettings(teacherId) {
    try {
        const stmt = db.prepare(`DELETE FROM teacher_card_settings WHERE teacherId = ?`);
        stmt.run(teacherId);
        console.log(`[TeacherCardSettings] Deleted default settings for teacher ${teacherId}`);
        return true;
    } catch (error) {
        console.error(`[TeacherCardSettings] Error deleting default settings for ${teacherId}:`, error);
        return false;
    }
}


