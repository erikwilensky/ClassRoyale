# Chapter 12 Implementation Report: Classroom Moderation, Safety & Soft-Control Systems

## Overview

Chapter 12 implements teacher moderation and classroom safety controls that operate inside a live match without affecting scoring, XP, cards, or persistence. This system provides real-time classroom authority tooling that is ephemeral, teacher-driven, and session-scoped.

**Core Design Principles:**
- No persistence of answers, logs, or chat history
- No observers or recording
- No student punishment systems
- No score manipulation
- No XP penalties
- Everything is ephemeral, teacher-driven, and session-scoped

## Implementation Date

Completed with all features and bug fixes.

## Features Implemented

### 1. Match-Level Moderation State

**Server-Side (`server/QuizRoom.js`)**
- Added `moderationState` property with:
  - `mutedPlayers`: Set of muted player IDs
  - `frozenTeams`: Set of frozen team IDs
  - `roundFrozen`: Boolean flag for global round freeze
- State is stored in memory only (no persistence)
- State resets automatically on:
  - Round end
  - Match reset
  - Match end

**Key Methods:**
- `resetModerationState()`: Clears all mutes, freezes, and round pause
- `broadcastModerationUpdate()`: Broadcasts current moderation state to all clients via `MODERATION_UPDATE` message

### 2. Teacher Moderation Controls (Server)

**REST API Routes (`server/routes/moderation.js`)**

**Authentication & Authorization:**
- All endpoints require `authenticateToken` middleware
- All endpoints require `isTeacher === true`
- Modification endpoints require active match (except reset)

**Endpoints:**
- `GET /api/match/moderation/status`: Get current moderation state
  - Returns: `{ mutedPlayers: string[], frozenTeams: string[], roundFrozen: boolean }`
  
- `POST /api/match/moderation/mute`: Mute a player
  - Body: `{ playerId: string }`
  - Effects: Player cannot write answers, lock answers, submit suggestions, insert suggestions, or cast cards
  - Does NOT affect writer rotation
  
- `POST /api/match/moderation/unmute`: Unmute a player
  - Body: `{ playerId: string }`
  
- `POST /api/match/moderation/freeze-team`: Freeze a team
  - Body: `{ teamId: string }`
  - Effects: Team cannot edit answers, lock answers, or cast cards
  - Existing answer remains visible
  
- `POST /api/match/moderation/unfreeze-team`: Unfreeze a team
  - Body: `{ teamId: string }`
  
- `POST /api/match/moderation/freeze-round`: Globally freeze the round
  - Effects: Pauses timer, blocks all answer/card actions/locks
  - UI shows "Round Paused by Teacher"
  
- `POST /api/match/moderation/resume-round`: Resume the round
  - Resumes timer and input
  
- `POST /api/match/moderation/reset`: Reset all moderation state
  - Clears all mutes, freezes, and round pause
  - Can be called even after match ends (for cleanup)

### 3. WebSocket Events

**New Message Type: `MODERATION_UPDATE`**
- Broadcast on every moderation change
- Payload: `{ mutedPlayers: string[], frozenTeams: string[], roundFrozen: boolean }`
- Sent to all connected clients (teacher, student, display)
- Also sent to new clients on join (via `onJoin`)

### 4. QuizRoom Enforcement

**Server-Side Action Blocking (`server/QuizRoom.js`)**

All moderation checks happen **before** any state mutation:

**Blocked if player is muted:**
- `suggestion` handler: Cannot submit suggestions
- `insertSuggestion` handler: Cannot insert suggestions
- `updateAnswer` handler: Cannot write/edit answers
- `lockAnswer` handler: Cannot lock answers
- `castCard` handler (via `cardSystem.js`): Cannot cast cards

**Blocked if team is frozen:**
- `updateAnswer` handler: Cannot write/edit answers
- `lockAnswer` handler: Cannot lock answers
- `castCard` handler (via `cardSystem.js`): Cannot cast cards

**Blocked if round is frozen:**
- All answer and card actions
- Timer paused (does not decrement in `startTimer()`)

**Implementation Details:**
- Checks use silent failure (no error messages to client)
- Checks happen early in handler (before any state mutation)
- `cardSystem.js` also checks moderation state before processing card casts

### 5. Teacher UI: Moderation Panel

**Component: `client/src/pages/TeacherModeration.jsx`**

**Route:** `/teacher/moderation`

**Features:**
- Connects to existing QuizRoom (shares room ID with Teacher page)
- Displays current round state and team information
- Lists all players with their roles (writer/suggester) and team assignments
- Shows current moderation state (muted players, frozen teams, round frozen)
- Provides controls for:
  - Muting/unmuting individual players
  - Freezing/unfreezing teams
  - Freezing/resuming the round
  - Resetting all moderation state

**Connection Logic:**
- Prioritizes `currentQuizRoomId` from `localStorage`/`sessionStorage`
- Implements retry mechanism (up to 3 retries) for connection failures
- Polls for room ID if not immediately available (up to 5 seconds)
- Gracefully handles locked rooms and connection errors
- Does NOT create new rooms (only connects to existing ones)

**Player Identification:**
- Extracts `playerId` from `TEAM_UPDATE` messages
- Uses `writerPlayerId` and `suggesterPlayerIds` fields from team data
- Maps session IDs to player IDs for accurate moderation

**Navigation:**
- Accessible via "👮 Moderation" button in Teacher navbar
- Styled with distinct color for visibility

### 6. Client-Side Behavior

**Student UI (`client/src/pages/Student.jsx`)**

**Moderation State Management:**
- Tracks `moderationState` with `mutedPlayers`, `frozenTeams`, and `roundFrozen`
- Listens for `MODERATION_UPDATE` messages
- Stores `playerId` from profile for moderation checks

**UI Disabling:**
- `WriterInput` component disabled when:
  - Player is muted
  - Team is frozen
  - Round is frozen
- `SuggesterBox` component disabled when:
  - Player is muted
  - Team is frozen
  - Round is frozen
- `CardBar` component disabled when:
  - Player is muted
  - Team is frozen
  - Round is frozen

**Visual Indicators:**
- "🔇 You are muted" message when player is muted
  - States: "You cannot write answers, lock answers, submit suggestions, or cast cards."
- "❄️ Your team is frozen" message when team is frozen
  - States: "You cannot edit answers, lock answers, or cast cards."
- "⏸️ Round Paused by Teacher" message when round is frozen

**Action Handlers:**
- `handleAnswerChange`: Checks mute/freeze before allowing changes
- `handleLockAnswer`: Checks mute/freeze before allowing lock
- `handleSubmitSuggestion`: Checks mute/freeze before allowing submission
- `handleInsertSuggestion`: Checks mute/freeze before allowing insertion
- `handleCastCard`: Checks mute/freeze before allowing card cast

**Teacher UI (`client/src/pages/Teacher.jsx`)**

**Moderation Integration:**
- Added "👮 Moderation" button in navbar
- Connects to same room as moderation panel
- Registers `MODERATION_UPDATE` message handler
- Maintains room connection when navigating between teacher pages

**Display UI (`client/src/pages/Display.jsx`)**

**Moderation Indicators:**
- Shows "⏸️ PAUSED" indicator next to round info when `roundFrozen` is true
- Shows "(FROZEN)" indicator next to team names in scoreboard when team is frozen
- Listens for `MODERATION_UPDATE` messages
- Displays moderation state without exposing controls

### 7. Card System Integration

**File: `server/systems/cardSystem.js`**

**Moderation Checks:**
- `handleCastCard` checks moderation state before processing:
  - Blocks if player is muted
  - Blocks if team is frozen
  - Blocks if round is frozen
- Checks happen before gold deduction and effect creation

## Technical Implementation Details

### Server-Side Architecture

**Moderation State Initialization:**
```javascript
// server/QuizRoom.js
this.moderationState = {
    mutedPlayers: new Set(),      // playerId
    frozenTeams: new Set(),        // teamId
    roundFrozen: false
};
```

**State Reset Points:**
- `endRound()`: Resets moderation state after round ends
- `RESET_MATCH` handler: Resets moderation state when match resets
- `MATCH_OVER` handler: Resets moderation state when match ends

**Broadcasting:**
- `broadcastModerationUpdate()` converts Sets to Arrays for JSON serialization
- Broadcasts to all clients including display clients
- Also sent in `onJoin()` to new clients

**Team Update Enhancement:**
- Modified `broadcastTeamUpdate()` and `sendTeamUpdateToClient()` to include:
  - `writerPlayerId`: Player ID of the writer
  - `suggesterPlayerIds`: Array of player IDs for suggesters
- This enables client-side moderation UI to correctly identify players

### Client-Side Architecture

**State Management:**
- `moderationState` stored as object with arrays (not Sets) for React state
- Converted from Sets to Arrays when receiving `MODERATION_UPDATE` messages
- Used in conditional checks: `moderationState.mutedPlayers.includes(playerId)`

**Connection Sharing:**
- Teacher and Moderation pages share `currentQuizRoomId` via `localStorage`
- Both pages connect to the same room instance
- Room connection persists when navigating between teacher pages

**Error Handling:**
- Moderation panel gracefully handles connection failures
- Shows error messages but doesn't block REST API usage
- Retries connection with exponential backoff

## Testing & Verification

### Verified Functionality

1. **Player Muting:**
   - ✅ Muted players cannot write answers
   - ✅ Muted players cannot lock answers
   - ✅ Muted players cannot submit suggestions
   - ✅ Muted players cannot insert suggestions
   - ✅ Muted players cannot cast cards
   - ✅ Muted players see clear UI feedback
   - ✅ Writer rotation not affected by muting

2. **Team Freezing:**
   - ✅ Frozen teams cannot edit answers
   - ✅ Frozen teams cannot lock answers
   - ✅ Frozen teams cannot cast cards
   - ✅ Frozen teams see clear UI feedback
   - ✅ Existing answers remain visible

3. **Round Freezing:**
   - ✅ Timer pauses when round is frozen
   - ✅ All answer actions blocked
   - ✅ All card actions blocked
   - ✅ All clients see "Round Paused" indicator
   - ✅ Timer resumes when round is unfrozen

4. **State Persistence:**
   - ✅ Moderation state resets on round end
   - ✅ Moderation state resets on match reset
   - ✅ Moderation state resets on match end
   - ✅ No persistence across matches

5. **UI Integration:**
   - ✅ Student UI disables inputs when muted/frozen
   - ✅ Student UI shows clear moderation messages
   - ✅ Teacher UI shows moderation controls
   - ✅ Display UI shows moderation indicators
   - ✅ Moderation panel correctly identifies players

6. **Connection Handling:**
   - ✅ Moderation panel connects to existing room
   - ✅ Room connection shared between teacher pages
   - ✅ Teams preserved when navigating between pages
   - ✅ Retry mechanism works for connection failures

## Known Issues & Resolutions

### Resolved Issues

1. **"Teams lost on teacher page when navigating to moderation"**
   - **Root Cause:** Teacher page was disconnecting on navigation, and Moderation page was creating new rooms
   - **Resolution:** 
     - Modified both pages to use `currentQuizRoomId` from `localStorage`
     - Removed `room.leave()` from cleanup in Moderation page
     - Ensured both pages connect to the same room instance

2. **"onMessage() not registered warnings"**
   - **Root Cause:** Message handlers not registered immediately after connection
   - **Resolution:** Registered all message handlers immediately after connection in both Teacher and Moderation pages

3. **"Mute does not work"**
   - **Root Cause:** Missing mute check in `insertSuggestion` handler, and `TEAM_UPDATE` messages didn't include player IDs
   - **Resolution:**
     - Added mute check to `insertSuggestion` handler
     - Modified `broadcastTeamUpdate()` to include `writerPlayerId` and `suggesterPlayerIds`
     - Updated `TeacherModeration` to extract player IDs from team data

4. **"Muted players can still write answers"**
   - **Root Cause:** `WriterInput` component's `disabled` prop didn't include mute check
   - **Resolution:** Added mute check to `WriterInput`'s `disabled` prop

5. **"Card cast log no longer works"**
   - **Root Cause:** Missing `CARD_CAST` message handler in Teacher component
   - **Resolution:** Added `CARD_CAST` message handler and card name lookup

## Files Modified

### Server-Side
- `server/QuizRoom.js`: Added moderation state, enforcement checks, broadcasting
- `server/systems/cardSystem.js`: Added moderation checks to card casting
- `server/routes/moderation.js`: New file with REST API endpoints
- `server/index.js`: Mounted moderation routes and set room instance

### Client-Side
- `client/src/pages/TeacherModeration.jsx`: New moderation panel component
- `client/src/pages/Teacher.jsx`: Added moderation button and message handlers
- `client/src/pages/Student.jsx`: Added moderation state, UI disabling, visual indicators
- `client/src/pages/Display.jsx`: Added moderation indicators
- `client/src/components/WriterInput.jsx`: Already supports `disabled` prop (no changes needed)
- `client/src/components/CardBar.jsx`: Already supports `disabled` prop (no changes needed)
- `client/src/main.jsx`: Added moderation route

## API Reference

### REST Endpoints

**Base Path:** `/api/match/moderation`

All endpoints require:
- `Authorization: Bearer <token>` header
- `isTeacher === true` in token

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/status` | Get current moderation state | - |
| POST | `/mute` | Mute a player | `{ playerId: string }` |
| POST | `/unmute` | Unmute a player | `{ playerId: string }` |
| POST | `/freeze-team` | Freeze a team | `{ teamId: string }` |
| POST | `/unfreeze-team` | Unfreeze a team | `{ teamId: string }` |
| POST | `/freeze-round` | Freeze the entire round | - |
| POST | `/resume-round` | Resume the round | - |
| POST | `/reset` | Reset all moderation state | - |

### WebSocket Messages

**Message Type:** `MODERATION_UPDATE`

**Payload:**
```javascript
{
  mutedPlayers: string[],      // Array of muted player IDs
  frozenTeams: string[],       // Array of frozen team IDs
  roundFrozen: boolean          // Whether round is globally frozen
}
```

**Broadcast:** Sent to all connected clients on every moderation change

## Design Decisions

### 1. Silent Failure for Blocked Actions
- **Decision:** Blocked actions fail silently (no error messages)
- **Rationale:** Prevents students from knowing they're muted/frozen, reducing potential for disruption
- **Trade-off:** Students may be confused why actions don't work, but UI indicators provide feedback

### 2. No Persistence
- **Decision:** All moderation state is ephemeral (in-memory only)
- **Rationale:** Aligns with design principles - no recording, no punishment systems
- **Trade-off:** Moderation state is lost on server restart, but this is acceptable for session-scoped controls

### 3. Player ID Extraction from Teams
- **Decision:** Extract player IDs from `TEAM_UPDATE` messages rather than maintaining separate player list
- **Rationale:** Reuses existing team data structure, avoids duplication
- **Trade-off:** Requires `TEAM_UPDATE` messages to include player IDs (added in this chapter)

### 4. Shared Room Connection
- **Decision:** Teacher and Moderation pages share the same room connection via `localStorage`
- **Rationale:** Ensures consistent state and prevents team loss when navigating
- **Trade-off:** Requires careful connection management, but provides better UX

### 5. Moderation Checks Before State Mutation
- **Decision:** All moderation checks happen at the start of handlers, before any state changes
- **Rationale:** Ensures no partial state updates if action is blocked
- **Trade-off:** None - this is a best practice

## Testing System

### Test Infrastructure

**Framework:** Jest 29.7.0 with ES Module support

**Configuration:**
- **File:** `jest.config.js`
- **Environment:** Node.js (testEnvironment: 'node')
- **Module System:** ES Modules (type: "module" in package.json)
- **Setup File:** `__tests__/setup.js` (runs before all tests)
- **Test Timeout:** 10 seconds (configurable in setup.js)

**Test Scripts (package.json):**
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode for development
npm run test:coverage      # Generate coverage report
npm run test:card          # Card system tests only
npm run test:scoring       # Scoring system tests only
npm run test:quizroom      # QuizRoom tests only
npm run test:routes        # Route tests only
```

**Test Structure:**
```
__tests__/
├── setup.js                    # Global test setup
├── helpers/
│   ├── mockRoom.js            # Mock QuizRoom for testing
│   ├── mockClient.js          # Mock client for testing
│   ├── testData.js            # Test fixtures and data
│   └── testUtils.js           # Utility functions
├── systems/
│   ├── cardSystem.test.js     # Card system unit tests
│   └── scoringSystem.test.js  # Scoring system unit tests
├── integration/
│   └── quizRoom.test.js       # QuizRoom integration tests
└── routes/
    └── matchCardRules.test.js # Route integration tests
```

### Mock Objects

**MockRoom (`__tests__/helpers/mockRoom.js`):**
- Simulates QuizRoom for isolated system testing
- Provides `state` (teams, gold, effects, roundState)
- Provides `scores` (teams, perPlayer, roundScores)
- Captures broadcasts via `broadcast(type, message)`
- Helper methods: `getLastBroadcast(type)`, `getAllBroadcasts(type)`
- Methods: `broadcastGoldUpdate()`, `broadcastTeamUpdate()`, `send(client, type, message)`

**MockClient (`__tests__/helpers/mockClient.js`):**
- Simulates Colyseus client for testing
- Auto-generates `sessionId` and `playerId`
- Configurable `metadata` (role, playerId, unlockedCards, isTeacher, isDisplay)
- Captures sent messages via `send(type, message)`
- Helper methods: `getLastMessage(type)`, `getAllMessages(type)`, `clearMessages()`

**Test Data (`__tests__/helpers/testData.js`):**
- Reusable test fixtures (cards, teams, players)
- Standardized test data for consistency

### Testing Patterns

**Unit Tests:**
- Test individual systems in isolation (CardSystem, ScoringSystem)
- Use MockRoom and MockClient to simulate dependencies
- Verify state changes, method returns, and side effects
- Example: `__tests__/systems/cardSystem.test.js`

**Integration Tests:**
- Test QuizRoom with real system interactions
- Verify message handlers, state updates, and broadcasts
- Test end-to-end flows (round lifecycle, match flow)
- Example: `__tests__/integration/quizRoom.test.js`

**Route Tests:**
- Test REST API endpoints with Supertest
- Mock authentication middleware
- Verify request/response handling, validation, error cases
- Example: `__tests__/routes/matchCardRules.test.js`

### Coverage Configuration

**Coverage Collection:**
- Includes: `server/**/*.js`
- Excludes: `server/index.js`, `server/db/database.js`, `node_modules`, `__tests__`
- Reports: text, lcov, html
- Output: `coverage/` directory

**Coverage Goals:**
- Unit Tests: 80%+ coverage for systems
- Integration Tests: Critical paths covered
- Route Tests: All endpoints tested

### ES Module Support

**Jest Configuration:**
- Uses `NODE_OPTIONS=--experimental-vm-modules` for ESM support
- No transform needed (transform: {})
- Imports use `.js` extension
- Mocks use `jest.mock()` with `virtual: true` for ES modules

**Mocking Strategy:**
- Authentication middleware: Mocked in route tests
- Card config: Mocked with `jest.mock()` and `virtual: true`
- Database: Not mocked (uses test database or in-memory)

### Suggested Tests for Chapter 12

**Moderation System Unit Tests (`__tests__/systems/moderation.test.js`):**
- Test moderation state initialization
- Test `resetModerationState()` clears all state
- Test `broadcastModerationUpdate()` sends correct message format
- Test state persistence (should reset on round/match end)

**Moderation Route Tests (`__tests__/routes/moderation.test.js`):**
- Test all REST endpoints (mute, unmute, freeze-team, unfreeze-team, freeze-round, resume-round, reset)
- Test authentication (requires JWT and isTeacher)
- Test authorization (only teachers can use)
- Test input validation (playerId, teamId required)
- Test error handling (room not available, team not found)
- Test state updates (verify moderation state changes)

**QuizRoom Moderation Integration Tests:**
- Test action blocking when player is muted (suggestion, insertSuggestion, updateAnswer, lockAnswer, castCard)
- Test action blocking when team is frozen (updateAnswer, lockAnswer, castCard)
- Test action blocking when round is frozen (all actions)
- Test timer pause when round is frozen
- Test state reset on round end, match reset, match end
- Test MODERATION_UPDATE broadcast on state changes
- Test player ID extraction in TEAM_UPDATE messages

**Card System Moderation Tests:**
- Test `handleCastCard` blocks when player is muted
- Test `handleCastCard` blocks when team is frozen
- Test `handleCastCard` blocks when round is frozen
- Test moderation checks happen before gold deduction

**Client-Side Tests (Future):**
- Test UI disabling when muted/frozen
- Test visual indicators display correctly
- Test message handlers update state correctly
- Test connection sharing between teacher pages

### Running Tests

**Prerequisites:**
- Node.js with ES module support
- Dependencies installed (`npm install`)

**Commands:**
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- __tests__/routes/moderation.test.js

# Run in watch mode (for development)
npm run test:watch
```

**Expected Output:**
- All tests should pass
- Coverage report shows percentage for each file
- No console errors or warnings

### Test Writing Guidelines

**Structure:**
```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MockRoom } from '../helpers/mockRoom.js';
import { MockClient } from '../helpers/mockClient.js';

describe('Feature Name', () => {
  let mockRoom;
  let mockClient;

  beforeEach(() => {
    mockRoom = new MockRoom();
    mockClient = new MockClient({ role: 'student', playerId: 'test-player' });
  });

  it('should do something', () => {
    // Arrange
    // Act
    // Assert
    expect(result).toBe(expected);
  });
});
```

**Best Practices:**
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Test one thing per test
- Use beforeEach for setup
- Clean up state between tests
- Mock external dependencies
- Test both success and error cases
- Test edge cases and boundary conditions

## Future Enhancements (Not in Scope)

The following features were explicitly excluded from Chapter 12:

- **Persistence:** No logging, recording, or history of moderation actions
- **Analytics:** No tracking of moderation usage or patterns
- **Student Punishment:** No XP penalties, score deductions, or permanent bans
- **Observer Mode:** No read-only observers or replay functionality
- **Automated Moderation:** No AI-based or rule-based automatic moderation

## Conclusion

Chapter 12 implementation is **complete and fully functional**. The system successfully provides:

- ✅ Real-time teacher moderation controls
- ✅ Ephemeral, session-scoped moderation state
- ✅ Comprehensive action blocking (server and client-side)
- ✅ Clear UI feedback for students
- ✅ Robust connection handling between teacher pages
- ✅ Integration with existing card and scoring systems
- ✅ No impact on scoring, XP, or persistence

The moderation system provides teachers with the tools they need to maintain classroom order and respond to disruptive behavior without affecting the core game mechanics or student progression.

---

**Report Generated:** December 2024  
**Status:** ✅ Production Ready  
**Version:** Chapter 12 Complete

