# Chapter 8 Implementation Report: Round Lifecycle, External Question Injection, and Control Panel

## Executive Summary

Chapter 8 implements a formalized round lifecycle system with explicit state management, external question injection (no persistence), automatic writer rotation, optional teacher-controlled timer, and a comprehensive control panel for teachers. The system provides fine-grained control over match progression while maintaining a smooth user experience for both teachers and students.

**Status:** ✅ **IMPLEMENTATION COMPLETE - TESTED & WORKING**

### Key Achievements
- ✅ Formalized round lifecycle with explicit states (ROUND_WAITING, ROUND_ACTIVE, ROUND_REVIEW, ROUND_ENDED)
- ✅ External question injection system (no database persistence)
- ✅ Automatic writer rotation per round for each team
- ✅ Teacher control panel with round management UI
- ✅ Optional teacher-controlled timer system
- ✅ Match reset functionality for starting new matches
- ✅ Post-match redirect to lobby for students
- ✅ Team persistence across refreshes/reconnects
- ✅ Single-person team writer handling

---

## 1. Architecture Overview

### 1.1 Round Lifecycle States

The round lifecycle is now explicitly managed through four distinct states:

```
ROUND_WAITING
  ↓ (Teacher sets question, clicks "Start Round")
ROUND_ACTIVE
  ↓ (Timer expires OR all teams lock OR teacher clicks "End Round")
ROUND_REVIEW
  ↓ (Teacher submits scores)
ROUND_ENDED
  ↓ (Teacher clicks "Next Round")
ROUND_WAITING (for next round)
```

**State Transitions:**
- **ROUND_WAITING**: Initial state, waiting for teacher to set question and start round
- **ROUND_ACTIVE**: Round in progress, students can submit answers
- **ROUND_REVIEW**: Round ended, waiting for teacher to score answers
- **ROUND_ENDED**: Scores submitted, waiting for teacher to advance to next round

### 1.2 Question Management

**External Question Injection:**
- Questions are provided dynamically by the teacher during the match
- No database persistence - questions exist only in memory during the match
- Questions can be set in `ROUND_WAITING` or `ROUND_ENDED` states
- Questions are cleared after each round ends (if match continues)

### 1.3 Writer Rotation System

**Automatic Rotation:**
- Writers rotate automatically at the start of each new round
- Rotation is circular (wraps around to first member after last)
- Uses `playerId` for rotation tracking (handles reconnects properly)
- Special handling for single-person teams (always writer, no suggesters)
- Rotation indices tracked per team in `writerRotationIndices` Map

### 1.4 Timer System

**Optional Teacher-Controlled Timer:**
- Timer can be enabled/disabled by teacher
- Timer only runs when `timerEnabled === true` AND `roundState === "ROUND_ACTIVE"`
- Timer duration can be set per round
- Auto-ends round when timer reaches 0 (if enabled)
- Timer state synchronized across all clients

---

## 2. Server Implementation

### 2.1 Schema Updates

**QuizState Schema** (`server/QuizRoom.js`):
```javascript
class QuizState extends Schema {
    questionText = "";
    timeRemaining = 0;
    roundState = "ROUND_WAITING";  // Explicit state management
    timerEnabled = false;          // Timer toggle
    teams = new MapSchema();
    gold = new MapSchema();
    activeEffects = new MapSchema();
}
```

**Key Changes:**
- Replaced `roundActive: boolean` with `roundState: string`
- Added `timerEnabled: boolean` for optional timer control

### 2.2 Round Lifecycle Handlers

#### SET_QUESTION Handler
```javascript
this.onMessage("SET_QUESTION", (client, message) => {
    // Only allow in ROUND_WAITING or ROUND_ENDED states
    // Validates question text
    // Broadcasts QUESTION_UPDATE to all clients
});
```

**Features:**
- Teacher-only operation
- State validation (only in ROUND_WAITING or ROUND_ENDED)
- Question text validation (non-empty)
- Broadcasts `QUESTION_UPDATE` message

#### START_ROUND Handler
```javascript
this.onMessage("START_ROUND", (client, message) => {
    // Validates match not over
    // Validates question exists
    // Validates state is ROUND_WAITING
    // Increments round number
    // Rotates writers
    // Clears answers and effects
    // Resets gold to 5 per team
    // Transitions to ROUND_ACTIVE
    // Starts timer if enabled
});
```

**Features:**
- Prevents starting if match is over
- Validates question is set
- Only allows from ROUND_WAITING state
- Automatic writer rotation
- Team state reset (answers, effects, gold)
- Optional timer start

#### END_ROUND Handler
```javascript
this.onMessage("END_ROUND", (client, message) => {
    // Only allow from ROUND_ACTIVE state
    // Stops timer if running
    // Transitions to ROUND_REVIEW
    // Calls endRound() to collect answers
});
```

**Features:**
- Teacher-only operation
- State validation (only from ROUND_ACTIVE)
- Timer cleanup
- State transition to ROUND_REVIEW

#### NEXT_ROUND Handler
```javascript
this.onMessage("NEXT_ROUND", (client, message) => {
    // Only allow from ROUND_ENDED state
    // Transitions to ROUND_WAITING
    // Clears question text
    // Broadcasts state and question updates
});
```

**Features:**
- Teacher-only operation
- State validation (only from ROUND_ENDED)
- Clears question text for next round
- Broadcasts state updates

### 2.3 Writer Rotation Implementation

**rotateWriters() Method:**
```javascript
rotateWriters() {
    for (const [teamId, team] of this.state.teams.entries()) {
        const memberIds = this.getTeamMemberPlayerIds(teamId);
        
        // Special handling for single-person teams
        if (memberIds.length === 1) {
            // Ensure single person is always writer
            // Clear suggesters list
            continue;
        }
        
        // Circular rotation
        const nextIndex = (currentIndex + 1) % memberIds.length;
        // Update writer and suggesters
        // Broadcast WRITER_ROTATED message
    }
}
```

**Features:**
- Gets all team members by `playerId` (handles reconnects)
- Circular rotation using modulo arithmetic
- Special handling for single-person teams
- Updates both `writer` (sessionId) and `writerPlayerId` (playerId)
- Rebuilds suggesters list
- Broadcasts rotation to all clients

**getTeamMemberPlayerIds() Method:**
- Collects all team members by `playerId`
- Includes both writer and suggesters
- Returns sorted array for consistent rotation order
- Handles reconnects by finding clients by `playerId`

### 2.4 Timer System

**startTimer() Method:**
```javascript
startTimer() {
    // Only start if timerEnabled AND roundState === "ROUND_ACTIVE"
    // Sets up interval to decrement timeRemaining
    // Auto-ends round when timer reaches 0 (if enabled)
    // Broadcasts TIMER_UPDATE every second
}
```

**ENABLE_TIMER Handler:**
- Sets `timerEnabled = true`
- Sets `timeRemaining` to provided duration
- Starts timer if round is active
- Broadcasts timer state

**DISABLE_TIMER Handler:**
- Sets `timerEnabled = false`
- Stops timer if running
- Broadcasts timer state

### 2.5 Match Reset Functionality

**RESET_MATCH Handler:**
```javascript
this.onMessage("RESET_MATCH", (client, message) => {
    // Resets all match state:
    // - matchOver = false
    // - roundNumber = 0
    // - Clears all scores
    // - Resets round state to ROUND_WAITING
    // - Clears question text
    // - Resets team gold to 5
    // Broadcasts MATCH_RESET, ROUND_STATE_UPDATE, QUESTION_UPDATE
});
```

**Features:**
- Teacher-only operation
- Complete match state reset
- Preserves team assignments (from lobby)
- Resets gold to initial values
- Broadcasts reset state to all clients

### 2.6 Team Persistence on Reconnect

**Team Recreation Logic:**
- When a student reconnects, checks if their team was deleted
- If team doesn't exist but `teamAssignments` has data, recreates team
- Preserves team name, gold, and writer assignment
- Sends `TEAM_JOINED` message to reconnected student

---

## 3. Client Implementation

### 3.1 Teacher Interface Updates

**Round Control Panel** (`client/src/pages/Teacher.jsx`):

**New UI Components:**
1. **Round State Display**: Visual indicator showing current round state with color coding
2. **Question Input**: Textarea for entering/pasting questions
3. **Set Question Button**: Sets question without starting round
4. **Round Control Buttons**:
   - **Start Round**: Transitions from ROUND_WAITING to ROUND_ACTIVE
   - **End Round**: Transitions from ROUND_ACTIVE to ROUND_REVIEW
   - **Next Round**: Transitions from ROUND_ENDED to ROUND_WAITING
5. **Timer Controls**: Enable/disable timer, set duration
6. **Reset Match Button**: Appears when match is over

**State Management:**
```javascript
const [roundState, setRoundState] = useState("ROUND_WAITING");
const [timerEnabled, setTimerEnabled] = useState(false);
const [questionInput, setQuestionInput] = useState("");
```

**Message Handlers:**
- `ROUND_STATE_UPDATE`: Updates round state and round number
- `QUESTION_UPDATE`: Updates question text and input field
- `WRITER_ROTATED`: Logs writer rotation (UI updates via TEAM_UPDATE)
- `MATCH_RESET`: Resets all match-related state

**Button States:**
- **Set Question**: Disabled if round is ACTIVE or REVIEW
- **Start Round**: Disabled if not ROUND_WAITING, match over, or no question
- **End Round**: Disabled if not ROUND_ACTIVE
- **Next Round**: Disabled if not ROUND_ENDED
- **Reset Match**: Only visible when match is over

### 3.2 Student Interface Updates

**Round State Display** (`client/src/pages/Student.jsx`):

**State-Specific Messages:**
- **ROUND_WAITING**: "⏳ Waiting for teacher to start round..."
- **ROUND_ACTIVE**: Shows question text
- **ROUND_REVIEW**: "✅ Round complete. Waiting for scoring..."
- **ROUND_ENDED**: "🎯 Round scored. Waiting for next round..."

**Input Field States:**
- Writer input: Disabled unless `roundState === "ROUND_ACTIVE"`
- Suggester input: Disabled unless `roundState === "ROUND_ACTIVE"`
- Lock button: Disabled unless `roundState === "ROUND_ACTIVE"`

**Writer Display:**
- Shows current writer name/ID for player's team
- Updates when `WRITER_ROTATED` message received

**Post-Match Redirect:**
- When match ends, `MatchResult` component is displayed
- On "Close" click:
  - Marks result as dismissed
  - Leaves quiz room
  - Redirects to `/lobby` after 100ms delay

### 3.3 Message Flow

**Round Start Flow:**
```
Teacher: SET_QUESTION → Server broadcasts QUESTION_UPDATE
Teacher: START_ROUND → Server:
  - Rotates writers
  - Sets roundState = "ROUND_ACTIVE"
  - Broadcasts ROUND_STATE_UPDATE
  - Broadcasts ROUND_STARTED
  - Starts timer (if enabled)
```

**Round End Flow:**
```
Teacher: END_ROUND → Server:
  - Sets roundState = "ROUND_REVIEW"
  - Calls endRound() → Collects answers
  - Broadcasts ROUND_ENDED
  - Broadcasts ROUND_DATA (for scoring)
```

**Round Scoring Flow:**
```
Teacher: Submit scores via API → Server:
  - Processes scores
  - Sets roundState = "ROUND_ENDED"
  - Clears question text (if match not over)
  - Broadcasts ROUND_STATE_UPDATE
  - Broadcasts ROUND_SCORE
  - Broadcasts QUESTION_UPDATE (empty string)
```

**Next Round Flow:**
```
Teacher: NEXT_ROUND → Server:
  - Sets roundState = "ROUND_WAITING"
  - Clears question text
  - Broadcasts ROUND_STATE_UPDATE
  - Broadcasts QUESTION_UPDATE (empty string)
```

---

## 4. Key Features

### 4.1 Round Lifecycle Management

**Explicit State Transitions:**
- All state transitions are validated
- Error messages for invalid transitions
- State broadcasted to all clients via `ROUND_STATE_UPDATE`
- UI reflects current state accurately

**State Validation:**
- `SET_QUESTION`: Only in ROUND_WAITING or ROUND_ENDED
- `START_ROUND`: Only from ROUND_WAITING
- `END_ROUND`: Only from ROUND_ACTIVE
- `NEXT_ROUND`: Only from ROUND_ENDED

### 4.2 External Question Injection

**No Persistence:**
- Questions exist only in memory during match
- Questions cleared after each round (if match continues)
- Questions cleared on match reset
- Questions can be set at any time in ROUND_WAITING or ROUND_ENDED

**Question Management:**
- Teacher can set question before starting round
- Question text validated (non-empty)
- Question broadcasted to all clients via `QUESTION_UPDATE`
- Question cleared automatically after round ends (if match continues)

### 4.3 Writer Rotation

**Automatic Rotation:**
- Writers rotate at start of each new round
- Rotation is circular (wraps around)
- Uses `playerId` for tracking (handles reconnects)
- Rotation indices stored per team

**Special Cases:**
- Single-person teams: Always writer, no suggesters
- Disconnected writers: Falls back to next available member
- Reconnects: Writer role restored based on `playerId`

### 4.4 Timer System

**Optional Control:**
- Timer can be enabled/disabled by teacher
- Timer only runs when enabled AND round is active
- Timer duration can be set per round
- Auto-ends round when timer reaches 0 (if enabled)

**Timer States:**
- **Enabled + Active**: Timer counts down, broadcasts updates
- **Enabled + Inactive**: Timer paused (round not active)
- **Disabled**: Timer doesn't run, round ends manually or when all teams lock

### 4.5 Match Reset

**Complete Reset:**
- Resets all match state (scores, round number, etc.)
- Preserves team assignments (from lobby)
- Resets gold to initial values (5 per team)
- Transitions to ROUND_WAITING
- Clears question text
- Broadcasts reset state to all clients

**Use Case:**
- After match ends, teacher can reset to start a new match
- All state cleared, ready for fresh match
- Teams remain assigned (from lobby)

### 4.6 Post-Match Redirect

**Student Experience:**
- Match ends → `MatchResult` overlay displayed
- Student clicks "Close" → Redirected to lobby
- Room connection closed
- Student can join new match from lobby

**Implementation:**
- `MatchResult` component has `onClose` callback
- On close: dismisses result, leaves room, navigates to `/lobby`
- Uses `sessionStorage` to persist dismissal state (prevents re-showing on refresh)

---

## 5. Bug Fixes and Improvements

### 5.1 Team Persistence on Reconnect

**Issue:** Teams were lost when students refreshed their browser.

**Fix:**
- Added team recreation logic in `onJoin`
- If team was deleted but `teamAssignments` exists, recreates team
- Preserves team name, gold, and writer assignment
- Sends `TEAM_JOINED` message to reconnected student

### 5.2 Question Text Clearing

**Issue:** Question text remained in input box after round ended.

**Fix:**
- Server clears question text after scoring (if match not over)
- Server broadcasts `QUESTION_UPDATE` with empty string
- Client `QUESTION_UPDATE` handler properly handles empty strings
- `NEXT_ROUND` also clears question text

### 5.3 Next Round Button State

**Issue:** "Next Round" button was disabled after round ended.

**Fix:**
- Server sets `roundState = "ROUND_ENDED"` after scoring
- Server broadcasts `ROUND_STATE_UPDATE` with ROUND_ENDED
- Client `ROUND_SCORE` handler also sets state to ROUND_ENDED (backup)
- Button enabled when `roundState === "ROUND_ENDED"`

### 5.4 Single-Person Team Writer Rotation

**Issue:** Single-person teams didn't have proper writer assignment.

**Fix:**
- Added special handling in `rotateWriters()`
- Single-person teams: Always writer, no suggesters
- Rotation index set to 0 (no rotation needed)

### 5.5 Match Over State Management

**Issue:** Match result overlay reappeared after refresh.

**Fix:**
- Added `matchResultDismissed` state persisted in `sessionStorage`
- On `MATCH_OVER` message, checks if dismissed before showing
- On close, marks as dismissed and redirects to lobby

---

## 6. File Changes

### 6.1 Server Files

**`server/QuizRoom.js`:**
- Updated `QuizState` schema: `roundState` (string) and `timerEnabled` (boolean)
- Added `SET_QUESTION` message handler
- Updated `START_ROUND` handler with state validation and writer rotation
- Added `END_ROUND` message handler
- Added `NEXT_ROUND` message handler
- Added `ENABLE_TIMER` and `DISABLE_TIMER` message handlers
- Added `RESET_MATCH` message handler
- Implemented `rotateWriters()` method
- Implemented `getTeamMemberPlayerIds()` method
- Updated `startTimer()` to check `timerEnabled` and `roundState`
- Updated `endRound()` to set `roundState = "ROUND_REVIEW"`
- Updated `submitRoundScores()` to set `roundState = "ROUND_ENDED"` and clear question
- Added team recreation logic in `onJoin`
- Added `writerRotationIndices` Map for tracking rotation

### 6.2 Client Files

**`client/src/pages/Teacher.jsx`:**
- Added `roundState`, `timerEnabled`, `questionInput` state
- Created "Round Control Panel" UI section
- Added `handleSetQuestion()`, `handleStartRound()`, `handleEndRound()`, `handleNextRound()`
- Added `handleEnableTimer()`, `handleDisableTimer()`
- Added `handleResetMatch()`
- Added `ROUND_STATE_UPDATE` message handler
- Added `QUESTION_UPDATE` message handler (handles empty strings)
- Added `WRITER_ROTATED` message handler
- Added `MATCH_RESET` message handler
- Updated `onStateChange` to use `roundState` instead of `roundActive`
- Updated button disabled states based on `roundState`
- Removed old inline question/duration input

**`client/src/pages/Student.jsx`:**
- Added `roundState`, `timerEnabled` state
- Updated question display to show state-specific messages
- Updated input field disabled states based on `roundState`
- Updated writer display to show current writer
- Added `ROUND_STATE_UPDATE` message handler
- Added `QUESTION_UPDATE` message handler
- Added `WRITER_ROTATED` message handler
- Updated `MATCH_OVER` handler to redirect to lobby on close
- Reset scoring state on component mount/reconnect

**`client/src/components/MatchResult.jsx`:**
- Updated "Close" button to use `onClose` callback instead of `window.location.reload()`

---

## 7. Testing Results

### 7.1 Round Lifecycle

✅ **Verified Working:**
1. Round starts from ROUND_WAITING state
2. Round transitions to ROUND_ACTIVE when started
3. Round transitions to ROUND_REVIEW when ended
4. Round transitions to ROUND_ENDED after scoring
5. Round transitions back to ROUND_WAITING after "Next Round"
6. State transitions are validated (errors for invalid transitions)
7. State is synchronized across all clients

### 7.2 Question Management

✅ **Verified Working:**
1. Teacher can set question in ROUND_WAITING state
2. Teacher can set question in ROUND_ENDED state
3. Question is broadcasted to all clients
4. Question text clears after round ends (if match continues)
5. Question text clears on match reset
6. Question input disabled during ROUND_ACTIVE and ROUND_REVIEW

### 7.3 Writer Rotation

✅ **Verified Working:**
1. Writers rotate automatically at start of each round
2. Rotation is circular (wraps around)
3. Single-person teams always have their member as writer
4. Writer role persists across reconnects (by playerId)
5. Suggesters list updates correctly after rotation
6. Rotation broadcasted to all clients

### 7.4 Timer System

✅ **Verified Working:**
1. Timer can be enabled/disabled by teacher
2. Timer only runs when enabled AND round is active
3. Timer counts down and broadcasts updates
4. Timer auto-ends round when reaching 0 (if enabled)
5. Timer stops when round ends or is disabled
6. Timer state synchronized across all clients

### 7.5 Match Reset

✅ **Verified Working:**
1. Reset button appears when match is over
2. Reset clears all match state (scores, round number, etc.)
3. Reset preserves team assignments
4. Reset resets gold to initial values
5. Reset transitions to ROUND_WAITING
6. Reset clears question text
7. Reset broadcasts state to all clients

### 7.6 Post-Match Redirect

✅ **Verified Working:**
1. Match result overlay displays when match ends
2. Closing overlay redirects to lobby
3. Room connection is closed
4. Student can join new match from lobby
5. Match result doesn't reappear after redirect

### 7.7 Team Persistence

✅ **Verified Working:**
1. Teams persist across student refreshes
2. Teams are recreated if deleted during disconnect
3. Team assignments preserved from lobby
4. Writer role restored correctly on reconnect

---

## 8. Known Issues / Limitations

### 8.1 Resolved Issues

✅ **All reported issues have been resolved:**
- Teacher screen loading issue (fixed state handling)
- Teams not showing on teacher screen (fixed TEAM_UPDATE)
- Match ending prematurely (fixed match win condition)
- Question text not clearing (fixed QUESTION_UPDATE)
- Next Round button disabled (fixed state transitions)
- Match result reappearing (fixed dismissal persistence)
- Teams lost on refresh (fixed team recreation)
- Single-person team writer rotation (added special handling)

### 8.2 Design Decisions

**No Question Persistence:**
- Questions are not stored in database
- Questions exist only during active match
- This allows for dynamic, real-time question injection
- Matches previous chapter design (no persistence)

**State-Based UI Control:**
- All UI elements disabled/enabled based on `roundState`
- Prevents invalid actions (e.g., starting round without question)
- Provides clear feedback to users about available actions

**Circular Writer Rotation:**
- Simple, predictable rotation pattern
- Ensures all team members get a chance to be writer
- Handles team size changes gracefully

---

## 9. Dependencies

No new dependencies were added for Chapter 8. All features use existing Colyseus and React infrastructure.

---

## 10. Next Steps / Recommendations

### Immediate
- ✅ System is production-ready for Chapter 8 requirements
- All features tested and working
- Bug fixes applied and verified

### Future Enhancements (Not in Scope)
- Question templates or question bank
- Custom rotation patterns (e.g., by skill level)
- Timer presets (30s, 60s, 90s buttons)
- Round history/replay
- Question difficulty levels

---

## 11. Conclusion

Chapter 8 implementation is **complete and fully functional**. The system successfully:

- ✅ Formalizes round lifecycle with explicit state management
- ✅ Enables external question injection without persistence
- ✅ Implements automatic writer rotation
- ✅ Provides comprehensive teacher control panel
- ✅ Adds optional timer control
- ✅ Supports match reset for new matches
- ✅ Redirects students to lobby after match ends
- ✅ Handles team persistence across reconnects
- ✅ Manages single-person teams correctly

The round lifecycle is now fully controlled and predictable, providing teachers with fine-grained control over match progression while maintaining a smooth experience for students.

---

**Report Generated:** January 2025  
**Status:** ✅ Production Ready  
**Version:** Chapter 8 Complete

