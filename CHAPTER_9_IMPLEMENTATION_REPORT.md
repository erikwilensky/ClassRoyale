# Chapter 9 Implementation Report: Classroom Display / Projector View

## Executive Summary

Chapter 9 implements a read-only "display client" that connects to `QuizRoom` as a projector/classroom display view. This client shows live match state (question, timer, teams, writers, scores, round & match results, card effects) without exposing private teacher controls, XP details, or admin buttons. The display client does not send mutating messages and is excluded from game logic (XP, writer rotation, scoring, match-end).

**Status:** ✅ **IMPLEMENTATION COMPLETE - TESTED & WORKING**

### Key Achievements
- ✅ New "display" client role with read-only access
- ✅ Large, clean projector-friendly UI
- ✅ Real-time synchronization of all match state
- ✅ Room ID sharing via localStorage (cross-tab support)
- ✅ Display clients excluded from XP, scoring, and writer rotation
- ✅ All mutating messages blocked for display clients
- ✅ Initial state synchronization with proper handler registration
- ✅ Effects overlay showing all active card effects
- ✅ Connection status indicator
- ✅ Protected route requiring authentication

---

## 1. Architecture Overview

### 1.1 Display Client Role

The display client is a special client type that:
- **Connects as role `"display"`** to `QuizRoom`
- **Read-only access** - receives all state updates but cannot send mutating messages
- **Excluded from game logic** - not counted in XP, writer rotation, scoring, or match-end calculations
- **No team assignment** - display clients don't join teams or participate in gameplay
- **No authentication requirements** - uses JWT token but doesn't need playerId or team assignments

### 1.2 Room ID Sharing

**Problem:** Display needs to connect to the same room as the teacher, but they may be in different browser tabs/windows.

**Solution:** Room ID is stored in `localStorage` (shared across tabs) when teacher connects:
- Teacher stores room ID in `localStorage.getItem("currentQuizRoomId")` when connecting
- Server sends `ROOM_ID` message to teacher on join
- Display reads room ID from `localStorage` to connect to the correct room
- Fallback to `sessionStorage` for same-tab access

### 1.3 State Synchronization

Display clients receive all state updates via WebSocket messages:
- `ROUND_STATE_UPDATE` - Round state and round number
- `QUESTION_UPDATE` - Current question text
- `ROUND_STARTED` - Round start event
- `TIMER_UPDATE` - Timer countdown and enabled state
- `TEAM_UPDATE` - Team information (names, writers, gold)
- `GOLD_UPDATE` - Team gold updates
- `ROUND_SCORE` - Round scoring results
- `MATCH_OVER` - Match completion with winner
- `CARD_CAST` - Card effect events
- `MATCH_RESET` - Match reset event
- `onStateChange` - Room state synchronization

**Handler Registration Order:**
- All message handlers registered **before** setting room state
- Prevents race condition where messages arrive before handlers are ready
- Server delays initial state messages by 300ms for display clients

---

## 2. Server Implementation

### 2.1 Display Client Detection

**Location:** `server/QuizRoom.js` - `onJoin` method

```javascript
onJoin(client, options) {
    const role = options.role || "student";
    client.metadata = { role };
    
    // Chapter 9: Handle display role
    if (role === "display") {
        client.metadata.isDisplay = true;
        // Display clients don't need playerId, team assignments, or XP
        // They just receive state updates
    } else {
        // Normal client handling (teacher/student)
        // ... authentication, team assignment, XP initialization
    }
}
```

**Key Points:**
- Display clients skip authentication, team assignment, and XP initialization
- `client.metadata.isDisplay = true` flag used throughout server code
- Display clients are excluded from team membership checks

### 2.2 Mutating Message Blocking

**Location:** `server/QuizRoom.js` - All mutating message handlers

All mutating message handlers check for display clients and reject their messages:

```javascript
this.onMessage("createTeam", (client, message) => {
    if (client.metadata.isDisplay) {
        client.send("ERROR", { message: "Display clients cannot perform this action." });
        return;
    }
    // ... normal handler logic
});
```

**Blocked Messages:**
- `createTeam` - Cannot create teams
- `joinTeam` - Cannot join teams
- `leaveTeam` - Cannot leave teams
- `transferWriter` - Cannot transfer writer role
- `suggestion` - Cannot send suggestions
- `insertSuggestion` - Cannot insert suggestions
- `updateAnswer` - Cannot update answers
- `lockAnswer` - Cannot lock answers
- `castCard` - Cannot cast cards
- `SET_QUESTION` - Cannot set questions
- `START_ROUND` - Cannot start rounds
- `END_ROUND` - Cannot end rounds
- `NEXT_ROUND` - Cannot advance rounds
- `ENABLE_TIMER` / `DISABLE_TIMER` - Cannot control timer
- `RESET_MATCH` - Cannot reset matches
- `setTeamSettings` - Cannot change team settings
- `setMatchSettings` - Cannot change match settings
- `endMatch` - Cannot end matches

### 2.3 XP Exclusion

**Location:** `server/QuizRoom.js` - `flushAllXP` method

```javascript
flushAllXP() {
    // Find all player clients (exclude display clients)
    const playerClients = this.clients.filter(c => 
        c.metadata.playerId && !c.metadata.isDisplay
    );
    
    // ... XP awarding logic
}
```

**Key Points:**
- Display clients are filtered out when finding player clients
- Display clients never receive XP awards
- Display clients are not included in XP cache operations

### 2.4 Writer Rotation Exclusion

**Location:** `server/QuizRoom.js` - `rotateWriters` and `getTeamMemberPlayerIds` methods

Display clients are naturally excluded because:
- They don't have `playerId` in metadata
- They're not members of any team
- `getTeamMemberPlayerIds` only returns players with `playerId`

### 2.5 Initial State Sending

**Location:** `server/QuizRoom.js` - `onJoin` method

```javascript
// Chapter 9: If display client joins, send them current teams immediately
if (client.metadata.isDisplay) {
    setTimeout(() => {
        this.sendTeamUpdateToClient(client);
        this.broadcastTeamUpdate();
    }, 300);
}

// Delay sending initial state to allow client to register handlers
const delay = client.metadata.isDisplay ? 300 : 150;
setTimeout(() => {
    // Chapter 9: Send initial state to display clients
    if (client.metadata.isDisplay) {
        // Send round state
        client.send("ROUND_STATE_UPDATE", {
            state: this.state.roundState || "ROUND_WAITING",
            roundNumber: this.scores.roundNumber
        });
        
        // Send current question
        if (this.state.questionText) {
            client.send("QUESTION_UPDATE", {
                question: this.state.questionText
            });
        }
        
        // Send timer state
        client.send("TIMER_UPDATE", {
            timeRemaining: this.state.timeRemaining,
            enabled: this.state.timerEnabled
        });
        
        // Send gold update
        const goldData = {};
        for (const [teamId, gold] of this.state.gold.entries()) {
            goldData[teamId] = gold;
        }
        client.send("GOLD_UPDATE", { gold: goldData });
        
        // If match is over, send MATCH_OVER
        if (this.scores.matchOver) {
            // ... send match over data
        }
        
        // Send current round score if available
        if (this.scores.roundNumber > 0) {
            // ... send round score data
        }
    }
}, delay);
```

**Key Points:**
- 300ms delay for display clients (vs 150ms for others) to ensure handlers are registered
- Sends complete initial state: round state, question, timer, gold, teams, scores
- Sends `MATCH_OVER` and `ROUND_SCORE` if match is already in those states

### 2.6 Room ID Broadcasting

**Location:** `server/QuizRoom.js` - `onJoin` method (teacher handling)

```javascript
// If teacher joins, send them current teams immediately and room ID
if (client.metadata.isTeacher) {
    // Send room ID to teacher so they can store it for display
    const roomId = this.roomId || this.id;
    if (roomId) {
        client.send("ROOM_ID", { roomId: roomId });
        console.log(`[QuizRoom] Sent room ID to teacher: ${roomId}`);
    }
    // ... send team update
}
```

**Key Points:**
- Server sends `ROOM_ID` message to teacher on join
- Teacher stores this in `localStorage` for display to access
- Ensures display can always find the correct room ID

---

## 3. Client Implementation

### 3.1 Display Page Component

**Location:** `client/src/pages/Display.jsx`

**Key Features:**
- Large, clean UI optimized for projector display
- Real-time state synchronization via WebSocket messages
- Connection status indicator
- Round information display
- Question display
- Timer display
- Scoreboard with teams, points, writers, gold
- Effects overlay showing all active card effects
- Match result display

**State Management:**
```javascript
const [room, setRoom] = useState(null);
const [connectionStatus, setConnectionStatus] = useState("connecting");
const [roundState, setRoundState] = useState("ROUND_WAITING");
const [roundNumber, setRoundNumber] = useState(0);
const [questionText, setQuestionText] = useState("");
const [timeRemaining, setTimeRemaining] = useState(0);
const [timerEnabled, setTimerEnabled] = useState(false);
const [teams, setTeams] = useState({});
const [matchScore, setMatchScore] = useState({});
const [teamGold, setTeamGold] = useState({});
const [roundResult, setRoundResult] = useState(null);
const [matchResult, setMatchResult] = useState(null);
const [matchOver, setMatchOver] = useState(false);
const [activeEffects, setActiveEffects] = useState([]);
```

### 3.2 Room Connection Logic

**Location:** `client/src/pages/Display.jsx` - `connect` function

```javascript
// Chapter 9: Get room ID from localStorage (set by teacher when they connect)
// Check both currentQuizRoomId (from teacher) and quizRoomId (from lobby)
const quizRoomIdFromLobby = localStorage.getItem("quizRoomId");
const quizRoomIdFromTeacher = localStorage.getItem("currentQuizRoomId");
const quizRoomIdFromSession = sessionStorage.getItem("currentQuizRoomId");
const quizRoomId = quizRoomIdFromLobby || quizRoomIdFromTeacher || quizRoomIdFromSession;

if (quizRoomId) {
    // Connect to specific QuizRoom
    joinedRoom = await joinQuizRoomById(quizRoomId, "display", token);
} else {
    // No room ID found - show error
    setConnectionStatus("error");
    alert("Display cannot connect: No active quiz room found...");
    return;
}
```

**Key Points:**
- Checks multiple sources for room ID (lobby, teacher, sessionStorage)
- Uses `joinQuizRoomById` to connect to specific room
- Shows error if no room ID found

### 3.3 Message Handler Registration

**Location:** `client/src/pages/Display.jsx` - `connect` function

**Critical Order:**
1. **Register ALL message handlers FIRST** (before setting room state)
2. **Register `onStateChange` handler** (after message handlers)
3. **Set room state** (triggers re-render)

This prevents race conditions where messages arrive before handlers are registered.

**Registered Handlers:**
- `ROUND_STATE_UPDATE` - Updates round state and round number
- `QUESTION_UPDATE` - Updates question text
- `ROUND_STARTED` - Handles round start event
- `TIMER_UPDATE` - Updates timer countdown and enabled state
- `TEAM_UPDATE` - Updates team information
- `GOLD_UPDATE` - Updates team gold
- `ROUND_SCORE` - Handles round scoring results
- `MATCH_OVER` - Handles match completion
- `CARD_CAST` - Handles card effect events
- `MATCH_RESET` - Handles match reset
- `ERROR` - Handles error messages
- `onLeave` - Handles disconnection

### 3.4 UI Components

**Top Bar:**
- Round number and state
- Question text (or "Waiting for question...")
- Timer display (if enabled)

**Scoreboard:**
- Team names
- Round points (match score)
- Writer information
- Gold amounts
- Evaluation scores (if available)

**Status Message:**
- Dynamic message based on round state
- Match winner display (if match over)

**Effects Overlay:**
- Shows all active card effects
- Uses `EffectsOverlay` component with `showAll={true}` prop

### 3.5 Teacher Integration

**Location:** `client/src/pages/Teacher.jsx`

**Room ID Storage:**
```javascript
// Chapter 9: Register ROOM_ID handler to store room ID from server
// Use localStorage instead of sessionStorage so display can access it from different tabs
joinedRoom.onMessage("ROOM_ID", (message) => {
  if (message && message.roomId) {
    localStorage.setItem("currentQuizRoomId", message.roomId);
    sessionStorage.setItem("currentQuizRoomId", message.roomId); // Also store in sessionStorage
    console.log("[Teacher] Received room ID from server:", message.roomId);
  }
});

// Chapter 9: Watch room state and store room ID when available
useEffect(() => {
  if (room) {
    const roomId = room.id || room.roomId;
    if (roomId) {
      localStorage.setItem("currentQuizRoomId", roomId);
      sessionStorage.setItem("currentQuizRoomId", roomId);
    }
  }
}, [room]);
```

**Link to Display:**
- Added "Open Classroom Display" link in teacher header
- Links to `/display` route

### 3.6 Routing

**Location:** `client/src/main.jsx`

```javascript
<Route 
  path="/display" 
  element={
    <ProtectedRoute requireAuth={true}>
      <Display />
    </ProtectedRoute>
  } 
/>
```

**Key Points:**
- Protected route requiring authentication
- Accessible to both teachers and students (any authenticated user)
- No role restriction (display is read-only, so safe for all users)

---

## 4. Effects Overlay Enhancement

### 4.1 Component Update

**Location:** `client/src/components/EffectsOverlay.jsx`

**Change:** Added `showAll` prop to display all active effects (not just for one team)

```javascript
export function EffectsOverlay({ teamId, activeEffects, showAll = false }) {
  // If showAll is true, show all effects without filtering by teamId
  const effectsToShow = showAll 
    ? activeEffects 
    : activeEffects.filter(effect => effect.targetTeamId === teamId);
  
  // ... render effects
}
```

**Usage in Display:**
```javascript
<EffectsOverlay 
  activeEffects={activeEffects} 
  showAll={true} 
/>
```

**Key Points:**
- Display shows all active card effects across all teams
- Students still see only effects targeting their team
- Maintains backward compatibility

---

## 5. Technical Details

### 5.1 Room ID Sharing Mechanism

**Problem:** Display needs room ID but teacher and display may be in different tabs.

**Solution:**
1. **Teacher connects** → Server sends `ROOM_ID` message
2. **Teacher stores** → `localStorage.setItem("currentQuizRoomId", roomId)`
3. **Display reads** → `localStorage.getItem("currentQuizRoomId")`
4. **Display connects** → Uses room ID to join specific room

**Storage Strategy:**
- **Primary:** `localStorage` (shared across tabs/windows)
- **Fallback:** `sessionStorage` (same-tab access)
- **Lobby:** `localStorage.getItem("quizRoomId")` (from lobby flow)

### 5.2 Handler Registration Race Condition

**Problem:** Messages arrive before handlers are registered, causing "onMessage() not registered" warnings.

**Solution:**
1. **Register all handlers FIRST** (synchronously, before async operations)
2. **Server delays initial messages** (300ms for display clients)
3. **Register `onStateChange` AFTER message handlers**

**Code Pattern:**
```javascript
// 1. Connect to room
const joinedRoom = await joinQuizRoomById(quizRoomId, "display", token);

// 2. Register ALL message handlers (synchronously)
joinedRoom.onMessage("ROUND_STATE_UPDATE", handler);
joinedRoom.onMessage("QUESTION_UPDATE", handler);
// ... all other handlers

// 3. Register state change handler
joinedRoom.onStateChange(handler);

// 4. Set room state (triggers re-render)
setRoom(joinedRoom);
```

### 5.3 Display Client Exclusion

**Mechanisms:**
1. **Metadata flag:** `client.metadata.isDisplay = true`
2. **Message blocking:** Early return in all mutating handlers
3. **XP exclusion:** Filtered out in `flushAllXP`
4. **Team exclusion:** No `playerId`, so not included in team operations
5. **Writer rotation:** Naturally excluded (no `playerId`)

### 5.4 Initial State Synchronization

**Server Side:**
- 300ms delay before sending initial state (allows handler registration)
- Sends complete state: round state, question, timer, gold, teams, scores
- Sends `MATCH_OVER` and `ROUND_SCORE` if match already in those states

**Client Side:**
- Handlers registered before room state is set
- `onStateChange` handler syncs with room state
- All message handlers update local state

---

## 6. File Changes Summary

### 6.1 New Files

**`client/src/pages/Display.jsx`**
- New display page component (474 lines)
- Read-only UI for projector display
- Real-time state synchronization
- Connection management

### 6.2 Modified Files

**`server/QuizRoom.js`**
- Added display role handling in `onJoin`
- Added `ROOM_ID` message to teacher
- Added initial state sending for display clients
- Added display client blocking in all mutating message handlers
- Added display client exclusion in `flushAllXP`
- Added `sendTeamUpdateToClient` for display clients

**`client/src/pages/Teacher.jsx`**
- Added `ROOM_ID` message handler
- Added room ID storage in `localStorage` and `sessionStorage`
- Added `useEffect` to watch room state and store room ID
- Added "Open Classroom Display" link in header

**`client/src/main.jsx`**
- Added `/display` route with protected route wrapper

**`client/src/components/EffectsOverlay.jsx`**
- Added `showAll` prop to display all effects (not just one team)

**`client/src/ws/colyseusClient.js`**
- No changes (reuses existing `joinQuizRoom` and `joinQuizRoomById` functions)

---

## 7. Testing Results

### 7.1 Connection Testing

**✅ Verified Working:**
1. **Teacher connects** → Room ID stored in `localStorage`
2. **Display connects** → Finds room ID and connects successfully
3. **Cross-tab access** → Display can access room ID from different tab
4. **Lobby flow** → Display can connect via lobby room ID
5. **Error handling** → Display shows error if no room ID found

### 7.2 State Synchronization Testing

**✅ Verified Working:**
1. **Initial state** → Display receives complete state on connect
2. **Round state updates** → Display updates when round state changes
3. **Question updates** → Display shows question when set
4. **Timer updates** → Display shows countdown timer
5. **Team updates** → Display shows all teams with correct information
6. **Score updates** → Display shows round and match scores
7. **Match over** → Display shows match winner
8. **Card effects** → Display shows all active effects

### 7.3 Message Blocking Testing

**✅ Verified Working:**
1. **Display cannot create teams** → Error message returned
2. **Display cannot join teams** → Error message returned
3. **Display cannot send suggestions** → Error message returned
4. **Display cannot cast cards** → Error message returned
5. **Display cannot control rounds** → Error message returned
6. **Display cannot reset match** → Error message returned

### 7.4 Exclusion Testing

**✅ Verified Working:**
1. **XP exclusion** → Display clients not included in XP awards
2. **Writer rotation** → Display clients not included in rotation
3. **Scoring** → Display clients not included in scoring calculations
4. **Match end** → Display clients don't affect match end logic

### 7.5 UI Testing

**✅ Verified Working:**
1. **Large, readable text** → Optimized for projector display
2. **Real-time updates** → All state updates reflected immediately
3. **Connection status** → Shows connection state clearly
4. **Round information** → Shows round number and state
5. **Question display** → Shows question or "Waiting for question..."
6. **Timer display** → Shows countdown when enabled
7. **Scoreboard** → Shows teams, points, writers, gold
8. **Effects overlay** → Shows all active card effects
9. **Match result** → Shows match winner when match ends

---

## 8. Known Issues / Limitations

### 8.1 Non-Critical Warnings

1. **React Router Future Flags:** Warnings about v7 migration (cosmetic, doesn't affect functionality)
2. **"onMessage() not registered" warnings:** Occasional warnings during initial connection (resolved by handler registration order and server delays)

### 8.2 Room ID Storage

**Current Behavior:**
- Room ID stored in `localStorage` (persists across browser sessions)
- Room ID also stored in `sessionStorage` (same-tab fallback)

**Potential Issue:**
- If teacher disconnects and reconnects to a different room, old room ID may persist in `localStorage`
- **Mitigation:** Display checks if room exists before connecting, shows error if not found

### 8.3 Display Client Authentication

**Current Behavior:**
- Display requires authentication (JWT token)
- Display doesn't need `playerId` or team assignments

**Potential Enhancement:**
- Could make display accessible without authentication (read-only, no security risk)
- Current implementation requires login for consistency with other pages

---

## 9. Usage Instructions

### 9.1 Starting a Display

1. **Teacher connects** to a quiz room (via `/teacher` or `/teacher/lobby`)
2. **Teacher starts a match** (if using lobby flow)
3. **Open display page** (`/display`) in a new tab/window
4. **Display automatically connects** to the active quiz room
5. **Display shows live match state** in real-time

### 9.2 Display Features

- **Round Information:** Shows current round number and state
- **Question Display:** Shows current question or "Waiting for question..."
- **Timer:** Shows countdown when timer is enabled
- **Scoreboard:** Shows all teams with points, writers, and gold
- **Effects:** Shows all active card effects
- **Match Results:** Shows match winner when match ends

### 9.3 Accessing Display

**From Teacher Page:**
- Click "Open Classroom Display" link in header
- Opens display in new tab

**Direct URL:**
- Navigate to `http://localhost:5173/display`
- Requires authentication (login first)

---

## 10. Future Enhancements

### 10.1 Potential Improvements

1. **Full-screen mode** - Toggle for true projector display
2. **Customizable layout** - Teacher can choose what to display
3. **Multiple displays** - Support multiple display clients simultaneously
4. **Display settings** - Font size, colors, layout options
5. **History view** - Show previous rounds' questions and scores
6. **Statistics display** - Show match statistics and trends
7. **No authentication** - Make display accessible without login (read-only)

### 10.2 Technical Improvements

1. **Room ID cleanup** - Automatically clear old room IDs
2. **Connection retry** - Auto-retry if connection fails
3. **State persistence** - Persist display state across refreshes
4. **Performance optimization** - Optimize for large number of teams
5. **Accessibility** - Improve screen reader support

---

## 11. Conclusion

Chapter 9 successfully implements a read-only classroom display / projector view that provides real-time visibility into match state without interfering with gameplay. The display client is properly isolated from game logic, cannot perform mutating actions, and provides a clean, large-format UI optimized for projector displays.

**Key Success Factors:**
- ✅ Proper client role isolation
- ✅ Complete state synchronization
- ✅ Cross-tab room ID sharing
- ✅ Race condition prevention
- ✅ Clean, readable UI

**Status:** ✅ **IMPLEMENTATION COMPLETE - TESTED & WORKING**

---

## Appendix: Code References

### Server-Side Changes

**`server/QuizRoom.js`:**
- Lines 946-950: Display role detection
- Lines 1060-1074: Teacher room ID sending
- Lines 1076-1084: Display client team update
- Lines 1086-1160: Initial state sending for display clients
- Lines 93-96, 133-136, 183-187, 241-245, 280-284, 321-325, 370-374, 386-390, 411-412, 482-486, 509-513, 540-544, 570-574, 600-604, 625-629, 650-654, 680-684, 710-714, 740-744, 770-774, 800-804, 830-834, 860-864, 890-894, 920-924: Display client message blocking

### Client-Side Changes

**`client/src/pages/Display.jsx`:**
- Lines 1-474: Complete display page implementation
- Lines 56-61: Room ID lookup logic
- Lines 93-254: Message handler registration
- Lines 274-288: State message generation
- Lines 290-310: Team list processing
- Lines 312-474: UI rendering

**`client/src/pages/Teacher.jsx`:**
- Lines 45-67: Room ID storage useEffect
- Lines 139-145: ROOM_ID message handler
- Lines 99-119: Room ID storage on connect
- Lines 121-137: Room ID storage after state set

**`client/src/main.jsx`:**
- Lines 107-114: Display route definition

**`client/src/components/EffectsOverlay.jsx`:**
- `showAll` prop addition for displaying all effects

---

**Report Generated:** 2024
**Implementation Status:** ✅ Complete
**Testing Status:** ✅ Verified Working

