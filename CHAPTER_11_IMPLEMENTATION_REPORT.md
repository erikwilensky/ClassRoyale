# Chapter 11 Implementation Report: Teacher Card Controls & Match Configuration

## Overview

Chapter 11 implements teacher-side controls for configuring card availability and balancing parameters on a per-match basis. Teachers can disable specific cards, adjust gold cost multipliers, and save default configurations that automatically apply to new matches. All changes are match-only and reset when a match ends or is reset.

## Implementation Date

Completed with enhancements for default settings support.

## Features Implemented

### 1. Match-Level Card Rules System

**Server-Side (`server/systems/cardSystem.js`)**
- Added `matchCardRules` property with:
  - `disabledCards`: Map of disabled card IDs (Set-like structure)
  - `goldCostModifiers`: Object mapping cardId to cost multiplier (0.5-2.0 range)
- Rules are initialized on room creation and reset when match resets
- Rules apply only to standard cards (cosmetic cards cannot have cost modifiers)

**Key Methods:**
- `initializeRules()`: Resets rules to empty state
- `resetRules()`: Clears all disabled cards and modifiers
- `disableCard(cardId)`: Disables a card for the current match
- `enableCard(cardId)`: Re-enables a disabled card
- `setCostModifier(cardId, multiplier)`: Sets gold cost multiplier for a standard card
- `getRules()`: Returns current rules for API/display
- `broadcastRulesUpdate()`: Broadcasts rule changes to all clients

### 2. REST API Endpoints (`server/routes/matchCardRules.js`)

**Authentication & Authorization:**
- All endpoints require `authenticateToken` middleware
- All endpoints require `isTeacher === true`
- Modification endpoints require active match (except load-defaults)

**Endpoints:**
- `GET /api/match/cards`: Get full card list with current match rules
  - Returns: `{ cards, disabledCards, goldCostModifiers }`
  
- `POST /api/match/cards/disable`: Disable a card for this match
  - Body: `{ cardId }`
  - Validates card exists and match is active
  
- `POST /api/match/cards/enable`: Enable a disabled card
  - Body: `{ cardId }`
  - Validates card exists and match is active
  
- `POST /api/match/cards/modify`: Set gold cost multiplier
  - Body: `{ cardId, multiplier }`
  - Validates: card exists, is standard type, multiplier in [0.5, 2.0]
  - Rejects cosmetic cards (they cannot have modifiers)
  
- `POST /api/match/cards/reset`: Clear all match rules
  - Resets disabled cards and modifiers to empty/default
  
- `GET /api/match/cards/defaults`: Get teacher's saved default settings
  - Returns: `{ hasDefaults, disabledCards, goldCostModifiers }`
  
- `POST /api/match/cards/defaults`: Save current match settings as default
  - Saves teacher's preferences for future matches
  
- `DELETE /api/match/cards/defaults`: Delete saved default settings
  
- `POST /api/match/cards/load-defaults`: Load and apply default settings
  - Can be called even after match ends (prepares for next match)
  - Applies disabled cards and modifiers to current match

### 3. Database Schema (`server/db/migrations.js`)

**New Table: `teacher_card_settings`**
```sql
CREATE TABLE teacher_card_settings (
    teacherId TEXT PRIMARY KEY,
    disabledCards TEXT,          -- JSON array of card IDs
    goldCostModifiers TEXT,      -- JSON object mapping cardId to multiplier
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacherId) REFERENCES players(id) ON DELETE CASCADE
)
```

**Service Layer (`server/services/teacherCardSettings.js`)**
- `getTeacherDefaultSettings(teacherId)`: Retrieve saved defaults
- `saveTeacherDefaultSettings(teacherId, disabledCards, goldCostModifiers)`: Save defaults
- `deleteTeacherDefaultSettings(teacherId)`: Delete saved defaults

### 4. Teacher UI (`client/src/pages/TeacherCards.jsx`)

**Features:**
- Full card list display (standard and cosmetic cards separated)
- Visual indicators for disabled cards (opacity, greyed out)
- Toggle buttons to enable/disable cards
- Cost multiplier inputs for standard cards (0.5x - 2.0x range)
- Real-time updates via WebSocket `CARD_RULES_UPDATE` messages
- Default settings management:
  - "Save as Default" button to save current match settings
  - "Load Defaults" button to apply saved settings (visible when defaults exist)
  - "Delete Defaults" button to remove saved defaults
  - Tip message when defaults exist but haven't been loaded

**UI Sections:**
1. **Standard Cards Section**
   - Shows all standard cards with:
     - Card name and effect description
     - Enable/Disable toggle
     - Base cost display
     - Cost multiplier input (0.5x - 2.0x)
     - Apply button for multiplier changes
   
2. **Cosmetic Cards Section**
   - Shows all cosmetic cards with:
     - Card name and effect description
     - Enable/Disable toggle only (no cost modifiers)

**Navigation:**
- Accessible via `/teacher/cards` route
- Prominent button added to Teacher page navigation bar

### 5. Student CardBar Integration (`client/src/components/CardBar.jsx`)

**Updates:**
- Receives `disabledCards` and `goldCostModifiers` via props
- Updates state from WebSocket `CARD_RULES_UPDATE` messages
- Visual feedback:
  - Disabled cards: greyed out button, tooltip "Disabled this match by teacher"
  - Modified costs: displays adjusted cost (e.g., "3💰 (1.5x)")
  - Cosmetic cards respect disabled state but show no cost modifiers

**Card Enable/Disable Logic:**
- Checks match-level disabled state first
- Cosmetic cards can be disabled/enabled like standard cards
- Standard cards check affordability using adjusted cost
- All disabled states reset when match resets

### 6. Display Client Integration (`client/src/pages/Display.jsx`)

**Updates:**
- Receives `CARD_RULES_UPDATE` messages
- Shows disabled cards with visual indicators (read-only)
- Displays modified costs for standard cards
- No control buttons (read-only view)

### 7. WebSocket Messages

**New Message Type: `CARD_RULES_UPDATE`**
```javascript
{
  disabledCards: string[],           // Array of disabled card IDs
  goldCostModifiers: {               // Object mapping cardId to multiplier
    [cardId: string]: number
  }
}
```

**Broadcasting:**
- Triggered when teacher disables/enables a card
- Triggered when teacher modifies a card's cost
- Triggered when teacher resets rules
- Triggered when teacher loads defaults
- Sent to all clients (students, teacher, display)

### 8. Automatic Default Loading (`server/QuizRoom.js`)

**Match Reset Enhancement:**
- When teacher resets a match (`RESET_MATCH` message), system automatically:
  1. Resets all match card rules
  2. Loads teacher's saved default settings (if they exist)
  3. Applies defaults to the new match
  4. Broadcasts updated rules to all clients

**Benefits:**
- Teachers don't need to manually load defaults each match
- Preferences persist across match resets
- Seamless experience when starting new matches

### 9. Card System Integration (`server/systems/cardSystem.js`)

**Cast Card Validation:**
- Checks if card is in `disabledCards` before allowing cast
- Rejects with error message: "This card is disabled for this match"
- Calculates adjusted cost using `goldCostModifiers`:
  ```javascript
  adjustedCost = Math.ceil(baseCost * multiplier)
  // Minimum cost of 1 to prevent zero-cost exploitation
  ```

**Cost Modifier Application:**
- Only applies to standard cards
- Cosmetic cards always cost 0 (no modifiers allowed)
- Multiplier clamped to [0.5, 2.0] range server-side
- Adjusted cost cannot go below 1

## Technical Details

### Security & Validation

**Server-Side Validation:**
- All routes require teacher authentication
- Card existence validation
- Cosmetic cards cannot have cost modifiers
- Multiplier bounds enforced (0.5 - 2.0)
- Minimum cost of 1 enforced to prevent exploitation
- Match active state checked for modifications (except load-defaults)

**Client-Side Validation:**
- Multiplier input restricted to 0.5 - 2.0 range
- Disabled state visually indicated
- Invalid forms rejected before submission

### State Management

**Match-Level State:**
- Stored in `QuizRoom.cardSystem.matchCardRules`
- Persists only in memory during match
- Resets on match end or reset
- Broadcast to all clients on change

**Teacher Defaults:**
- Stored in database (`teacher_card_settings` table)
- Persists across matches
- Teacher-specific (tied to `teacherId`)
- Automatically loaded on match reset

### WebSocket Integration

**Message Flow:**
1. Teacher modifies card rules via UI
2. UI sends POST request to REST API
3. Server updates `cardSystem.matchCardRules`
4. Server broadcasts `CARD_RULES_UPDATE` to all clients
5. Clients update local state and UI

**Initial State:**
- Display clients receive initial card rules on join
- Students receive card rules via `CARD_RULES_UPDATE` messages
- Teacher sees current state via GET `/api/match/cards`

## Files Modified/Created

### Created Files:
- `server/routes/matchCardRules.js` - REST API endpoints
- `server/services/teacherCardSettings.js` - Default settings service
- `client/src/pages/TeacherCards.jsx` - Teacher card controls UI

### Modified Files:
- `server/systems/cardSystem.js` - Added match rules management
- `server/QuizRoom.js` - Auto-load defaults on reset, rule broadcasting
- `client/src/components/CardBar.jsx` - Disabled state handling, cost display
- `client/src/pages/Teacher.jsx` - Added navigation button
- `client/src/pages/Student.jsx` - WebSocket message handling
- `client/src/pages/Display.jsx` - Read-only rule display
- `client/src/components/EffectsOverlay.jsx` - Cosmetic card effects
- `server/db/migrations.js` - Added `teacher_card_settings` table

## Testing Checklist

### Core Functionality
- [x] Teacher can disable/enable cards
- [x] Teacher can modify gold cost multipliers (0.5x - 2.0x)
- [x] Disabled cards cannot be cast by students
- [x] Modified costs are correctly applied and displayed
- [x] Cosmetic cards can be disabled but not have cost modifiers
- [x] Rules reset when match ends/resets

### Default Settings
- [x] Teacher can save current settings as default
- [x] Teacher can load defaults into current match
- [x] Teacher can delete saved defaults
- [x] Defaults automatically load on match reset
- [x] Defaults can be loaded even after match ends

### UI/UX
- [x] Card controls accessible from Teacher page
- [x] Disabled cards visually indicated (greyed out)
- [x] Modified costs clearly displayed
- [x] Error messages shown for invalid actions
- [x] Real-time updates via WebSocket

### Integration
- [x] Student CardBar respects disabled cards
- [x] Display client shows disabled cards (read-only)
- [x] WebSocket messages broadcast to all clients
- [x] Rules persist during match but reset appropriately

## Constraints & Limitations

1. **Match-Only Scope**: All rule changes apply only to current match
2. **Cosmetic Card Restrictions**: Cosmetic cards cannot have cost modifiers (by design)
3. **Standard Cards Only**: Cost modifiers only affect standard cards
4. **Minimum Cost**: Adjusted costs cannot go below 1 (prevents exploitation)
5. **Active Match Requirement**: Most modifications require active match (except load-defaults)

## Future Enhancements (Not Implemented)

- Card presets (multiple saved configurations)
- Import/export card configurations
- Per-team card rules (currently global per match)
- Card usage statistics per match
- Temporary card bans (time-limited)

## Known Issues

None reported at time of implementation.

## Conclusion

Chapter 11 successfully implements teacher-side card controls with per-match configuration. The addition of default settings makes the system more user-friendly, allowing teachers to save their preferred configurations and have them automatically applied to new matches. All features work as specified, with proper validation, security, and real-time synchronization across all clients.

---

**Implementation Status**: ✅ Complete

**Default Settings Feature**: ✅ Implemented as enhancement

**Integration with Previous Chapters**: ✅ Fully integrated with Chapter 10 (Card Shop) and Chapter 8 (Round Lifecycle)

