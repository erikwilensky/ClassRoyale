// Backwards compatibility adapter for Card Catalog v1
// Maps between new catalog IDs (kebab-case) and legacy IDs (uppercase)

import { CARD_CATALOG_V1_BY_ID, getLegacyIdFromCatalogId, getCatalogIdFromLegacyId } from './cards.catalog.v1.js';

/**
 * Build legacy CARDS object from catalog while preserving existing cards exactly as-is
 * This ensures 100% backwards compatibility
 * 
 * @param {Object} options
 * @param {Array} options.catalog - Array of catalog cards (CARD_CATALOG_V1)
 * @param {Object} options.existingCards - Current CARDS object (legacy format)
 * @returns {Object} Legacy CARDS object with all existing cards preserved
 */
export function buildLegacyCARDSFromCatalog({ catalog, existingCards }) {
  // Start with existing cards exactly as they are (preserves uppercase IDs and current shape)
  const legacyCards = { ...existingCards };
  
  // Note: We don't merge new cards into legacyCards because:
  // 1. Existing code paths expect only the 14 original cards
  // 2. New cards should be accessed via CARD_CATALOG_V1, not CARDS
  // 3. This maintains 100% backwards compatibility
  
  return legacyCards;
}

/**
 * Get legacy ID from catalog ID
 * @param {string} catalogId - Kebab-case catalog ID (e.g., "brainwave-boost")
 * @returns {string|null} Legacy uppercase ID (e.g., "BRAINWAVE_BOOST") or null if not mapped
 */
export function getLegacyId(catalogId) {
  return getLegacyIdFromCatalogId(catalogId);
}

/**
 * Get catalog ID from legacy ID
 * @param {string} legacyId - Uppercase legacy ID (e.g., "BRAINWAVE_BOOST")
 * @returns {string|null} Catalog kebab-case ID (e.g., "brainwave-boost") or null if not mapped
 */
export function getCatalogId(legacyId) {
  return getCatalogIdFromLegacyId(legacyId);
}

/**
 * Check if a catalog ID corresponds to an existing legacy card
 * @param {string} catalogId - Kebab-case catalog ID
 * @returns {boolean} True if this is one of the original 14 cards
 */
export function isLegacyCard(catalogId) {
  return getLegacyIdFromCatalogId(catalogId) !== null;
}

