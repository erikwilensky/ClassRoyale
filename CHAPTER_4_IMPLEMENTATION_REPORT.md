# Chapter 4 Implementation Report - Card & Gold System

## Executive Summary

Successfully implemented a card-based strategic system with gold currency management for the team-based quiz game. Teams earn gold by submitting suggestions, and can spend gold to cast cards that apply visual effects to opponents or themselves. The system includes real-time gold tracking, card casting with validation, visual effect overlays, and a card cast log for the teacher interface. All Chapter 1-3 functionality is preserved.

**Status:** ✅ **IMPLEMENTATION COMPLETE - TESTED & WORKING**

---

## What Was Implemented

### Server-Side Changes (`server/QuizRoom.js`)

#### 1. Schema Extensions

**New Schemas:**
- **`EffectState` schema**: Tracks active card effects
  - `cardId` (string): Card identifier (SHAKE, BLUR, DISTRACT, OVERCLOCK)
  - `casterTeamId` (string): Team that cast the card
  - `targetTeamId` (string): Team receiving the effect
  - `timestamp` (number): When the effect was created
  - `expiresAt` (number): When the effect expires (10 seconds after cast)

**Extended Schemas:**
- **`TeamState`**: Added `gold` field (number, default: 0)
- **`QuizState`**: Added two MapSchemas:
  - `gold: MapSchema<number>` - Maps teamId → gold amount
  - `activeEffects: MapSchema<EffectState>` - Maps targetTeamId → active effect

#### 2. Card Definitions

**Location:** `server/QuizRoom.js` - `CARDS` constant

**Cards Implemented:**
- **SHAKE** (cost: 3 gold, target: opponent) - Shakes the target team's screen
- **BLUR** (cost: 2 gold, target: opponent) - Blurs the target team's screen
- **DISTRACT** (cost: 1 gold, target: self) - Applies a glow effect to the caster
- **OVERCLOCK** (cost: 4 gold, target: opponent) - Combines shake and blur on target

#### 3. Gold Management

**Initialization:**
- On round start (`startRound` handler), each active team receives **5 gold**
- Gold is stored in both `this.state.gold` (MapSchema) and `team.gold` (TeamState field)
- `GOLD_UPDATE` message broadcast to all clients (including teacher) with gold amounts

**Gold Awards:**
- When a suggester submits a suggestion (`suggestion` handler), the team receives **+1 gold**
- Gold is updated in both state locations and `GOLD_UPDATE` is broadcast

**Gold Deduction:**
- When a card is cast (`castCard` handler), the card's cost is deducted from team gold
- Validation ensures team has sufficient gold before casting
- Gold is updated and `GOLD_UPDATE` is broadcast

#### 4. Card Casting Logic

**Message Handler:** `castCard`

**Validation:**
- Round must be active
- Team must have sufficient gold (≥ card cost)
- Target team must be valid (opponent cards require different team, self cards require own team)
- Only one active effect per target team (new effect replaces old one)

**Effect Creation:**
- Creates new `EffectState` instance
- Sets `expiresAt` to current time + 10 seconds (EFFECT_DURATION)
- Stores in `this.state.activeEffects` MapSchema
- Sends `CARD_CAST` message to target team members
- Broadcasts `CARD_CAST` to all clients (for teacher logging)

**Effect Cleanup:**
- Expired effects are removed in timer tick (every second)
- All effects are cleared on round end (`endRound`)

#### 5. Answer Synchronization Fix

**New Message Handler:** `updateAnswer`
- Writers can update team answer in real-time (not just on lock)
- Keeps server-side `team.answer` in sync with client typing
- Ensures answers are collected even if writer doesn't press Lock before timeout
- Only writers can send this message

### Client-Side Changes

#### 6. New React Components

**Location:** `client/src/components/`

**`GoldDisplay.jsx`**
- Displays team gold with 💰 icon
- Yellow background, bold text
- Props: `gold` (number)

**`CardBar.jsx`**
- Renders 4 card buttons (SHAKE, BLUR, DISTRACT, OVERCLOCK)
- Shows card cost and target type
- Disabled states:
  - When round is not active
  - When team has insufficient gold
  - When opponent card selected but no target chosen
- Target selection dropdown for opponent cards (filters out own team)
- Props: `gold`, `onCastCard`, `disabled`, `roundActive`, `availableTeams`, `currentTeamId`

**`EffectsOverlay.jsx`**
- Full-screen overlay for visual effects
- Fixed position, z-index 9999, pointer-events: none
- CSS animations:
  - **SHAKE**: 0.15s infinite animation with 20px movement, 5deg rotation, red tint overlay, flashing opacity
  - **BLUR**: 8px backdrop-filter blur with semi-transparent dark overlay
  - **DISTRACT**: Brightness filter with green glow box-shadow
  - **OVERCLOCK**: Combined shake animation with 3px blur
- Auto-expires after 10 seconds (EFFECT_DURATION)
- Props: `activeEffects` (array), `teamId` (string)

#### 7. Student Page Updates (`client/src/pages/Student.jsx`)

**New State Variables:**
- `teamGold` (number): Current team gold amount
- `activeEffects` (array): Active effects targeting this team

**New Message Handlers:**
- **`GOLD_UPDATE`**: Updates `teamGold` state from server
- **`CARD_CAST`**: Adds effect to `activeEffects` array (only if targeting this team)

**New Functions:**
- **`handleCastCard(cardId, targetTeamId)`**: Validates and sends `castCard` message to server
- **`handleAnswerChange(newAnswer)`**: Sends `updateAnswer` message on every keystroke (for writers)

**New Refs:**
- `teamIdRef`: Prevents stale `teamId` in message handlers

**localStorage Integration:**
- Saves `teamId` to localStorage on team join
- Restores `teamId` on page refresh (allows user to see which team they were in)
- Note: Manual rejoin still required for full functionality

**Component Integration:**
- `<GoldDisplay gold={teamGold} />` - Shows gold above card bar
- `<CardBar ... />` - Card casting interface (only when in team and round active)
- `<EffectsOverlay activeEffects={activeEffects} teamId={teamId} />` - Visual effects overlay

#### 8. Teacher Page Updates (`client/src/pages/Teacher.jsx`)

**New State Variables:**
- `teamGold` (object): Maps teamId → gold amount
- `cardCastLog` (array): Log of card casts with timestamps

**New Message Handlers:**
- **`GOLD_UPDATE`**: Updates `teamGold` state
- **`CARD_CAST`**: Adds entry to `cardCastLog` with timestamp, cardId, casterTeamId, targetTeamId
  - Keeps only last 10 entries
  - Log persists across rounds (not cleared on round start)

**Gold Display:**
- Shows gold amount next to each team in the Teams section
- Format: "💰 {gold} gold"
- Synced from both `GOLD_UPDATE` messages and `onStateChange` handler

**Card Cast Log Section:**
- Always visible (not conditional)
- Shows "🎴 Card Cast Log ({count} entries)"
- Displays entries with timestamp, caster team, card name, and target team
- Empty state message when no cards cast
- Red border for visibility

**Gold Sync on Round Start:**
- `ROUND_STARTED` handler immediately syncs gold from room state
- Ensures gold is visible even if `GOLD_UPDATE` message is delayed

#### 9. WebSocket Helper Updates

**File:** `client/src/ws/colyseusClient.js`

**New Function:**
```javascript
export function castCard(room, cardId, targetTeamId) {
  room.send("castCard", { cardId, targetTeamId });
}
```

---

## Visual Effects Details

### SHAKE Card
- **Animation:** 0.15s infinite shake with 20px translation and 5deg rotation
- **Visual:** Red tint overlay (rgba(255, 0, 0, 0.25)) with flashing opacity
- **Duration:** 10 seconds
- **Target:** Opponent teams

### BLUR Card
- **Effect:** 8px backdrop-filter blur with semi-transparent dark overlay (rgba(0, 0, 0, 0.3))
- **Duration:** 10 seconds
- **Target:** Opponent teams

### DISTRACT Card
- **Effect:** Brightness filter (1.2x) with green glow box-shadow
- **Visual:** Green tint overlay (rgba(76, 175, 80, 0.1))
- **Duration:** 10 seconds
- **Target:** Self (caster)

### OVERCLOCK Card
- **Effect:** Combined shake animation (0.3s) with 3px blur
- **Visual:** Semi-transparent overlay with backdrop-filter
- **Duration:** 10 seconds
- **Target:** Opponent teams

---

## Testing Results

### ✅ Verified Working

1. **Gold Initialization:**
   - Teams receive 5 gold at round start
   - Gold displays correctly on both teacher and student pages
   - Gold persists during the round

2. **Gold Awards:**
   - Suggesters earn +1 gold per suggestion submitted
   - Gold updates in real-time on all clients
   - Teacher sees updated gold amounts immediately

3. **Card Casting:**
   - Cards can be cast when team has sufficient gold
   - Cards are disabled when insufficient gold or round inactive
   - Target selection works for opponent cards
   - Self cards (DISTRACT) cast on own team automatically

4. **Visual Effects:**
   - SHAKE: Red-tinted overlay shakes dramatically
   - BLUR: Screen is blurred and dimmed
   - DISTRACT: Green glow effect visible
   - OVERCLOCK: Combined shake and blur effect
   - Effects auto-expire after 10 seconds
   - Effects are cleared on round end

5. **Card Cast Log:**
   - Teacher sees all card casts with timestamps
   - Log persists across rounds
   - Shows caster team, card name, and target team

6. **Answer Synchronization:**
   - Writer's typed answer syncs to server in real-time
   - Answers are collected even if Lock is not pressed before timeout
   - Teacher receives all team answers on round end

7. **Gold Display:**
   - Teacher sees gold for all teams
   - Student sees their team's gold
   - Gold updates in real-time

8. **localStorage Persistence:**
   - Team ID is saved on join
   - Team ID is restored on page refresh
   - User can see which team they were in after refresh

### Issues Fixed During Implementation

1. **Gold showing 0 at round start:**
   - **Fix:** Added immediate gold sync in `ROUND_STARTED` handler
   - **Fix:** Ensured `GOLD_UPDATE` broadcasts to all clients (including teacher)

2. **Blur not visible:**
   - **Fix:** Increased blur from 4px to 8px
   - **Fix:** Added semi-transparent background overlay for visibility

3. **Shake not distracting enough:**
   - **Fix:** Increased movement from 12px to 20px
   - **Fix:** Increased rotation from 3deg to 5deg
   - **Fix:** Faster animation (0.15s instead of 0.25s)
   - **Fix:** Added flashing opacity animation
   - **Fix:** Increased red tint opacity

4. **Card cast log not showing:**
   - **Fix:** Added `CARD_CAST` message handler to Teacher component
   - **Fix:** Moved handler registration before "*" catch-all handler
   - **Fix:** Made log section always visible (not conditional)

5. **Answers not collected on timeout:**
   - **Fix:** Added `updateAnswer` message handler on server
   - **Fix:** Client sends `updateAnswer` on every keystroke (writers only)
   - **Fix:** Server collects synced answers in `endRound()`

---

## File Structure

```
ClassRoyale/
├── server/
│   ├── index.js              # Colyseus server setup
│   └── QuizRoom.js           # Game room logic (includes card/gold system)
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx          # React app entry + routing
│       ├── ws/
│       │   └── colyseusClient.js  # WebSocket helpers (includes castCard)
│       ├── components/
│       │   ├── Timer.jsx
│       │   ├── QuestionDisplay.jsx
│       │   ├── AnswerInput.jsx
│       │   ├── RoundControls.jsx
│       │   ├── AnswerList.jsx
│       │   ├── TeamStatus.jsx
│       │   ├── WriterInput.jsx
│       │   ├── SuggesterBox.jsx
│       │   ├── SuggestionList.jsx
│       │   ├── GoldDisplay.jsx      # NEW: Gold display component
│       │   ├── CardBar.jsx          # NEW: Card casting interface
│       │   └── EffectsOverlay.jsx   # NEW: Visual effects overlay
│       └── pages/
│           ├── Teacher.jsx          # Updated: Gold display, card cast log
│           └── Student.jsx          # Updated: Gold, cards, effects
└── package.json
```

---

## How to Run

### Prerequisites
- Node.js (v22.21.0 tested)
- WSL (for Windows development)

### Server Setup
```bash
cd /mnt/d/cursor/ClassRoyale/ClassRoyale
npm install
npm start
```

Server runs on: `http://localhost:3000`

### Client Setup
```bash
cd /mnt/d/cursor/ClassRoyale/ClassRoyale/client
npm install
npm run dev
```

Client runs on: `http://localhost:5173`

### Access URLs
- **Teacher:** http://localhost:5173/teacher
- **Student:** http://localhost:5173/student

---

## Features Implemented

### ✅ Chapter 4 Enhancements
- [x] Gold currency system (initialization, awards, deduction)
- [x] Card definitions (SHAKE, BLUR, DISTRACT, OVERCLOCK)
- [x] Card casting with validation
- [x] Visual effect overlays (shake, blur, distract, overclock)
- [x] Gold display on teacher and student pages
- [x] Card cast log on teacher page
- [x] Real-time gold synchronization
- [x] Effect expiration and cleanup
- [x] Answer synchronization (real-time typing sync)
- [x] localStorage persistence for team ID

### ✅ Preserved Functionality (Chapters 1-3)
- [x] Team self-assembly
- [x] Writer/suggester roles
- [x] Suggestion system
- [x] Answer locking
- [x] Round management
- [x] Timer system
- [x] Teacher admin controls

---

## Technical Details

### Gold Management Flow

1. **Round Start:**
   ```
   Teacher starts round
   → Server sets team.gold = 5 for all active teams
   → Server broadcasts GOLD_UPDATE { gold: { teamId: 5, ... } }
   → All clients receive and update gold display
   ```

2. **Suggestion Submission:**
   ```
   Suggester submits suggestion
   → Server adds +1 gold to team
   → Server broadcasts GOLD_UPDATE
   → Team members see updated gold
   ```

3. **Card Casting:**
   ```
   Writer clicks card button
   → Client validates (gold ≥ cost, round active, valid target)
   → Client sends castCard { cardId, targetTeamId }
   → Server validates and deducts gold
   → Server creates EffectState
   → Server sends CARD_CAST to target team
   → Server broadcasts CARD_CAST to all (for teacher log)
   → Server broadcasts GOLD_UPDATE
   → Target team sees visual effect
   → Teacher sees log entry
   ```

### Effect Lifecycle

1. **Creation:**
   - Card cast → `EffectState` created
   - Stored in `this.state.activeEffects` MapSchema
   - `expiresAt = Date.now() + 10000` (10 seconds)

2. **Active:**
   - Target team receives `CARD_CAST` message
   - Client adds to `activeEffects` array
   - `EffectsOverlay` component renders visual effect
   - Effect visible for 10 seconds

3. **Expiration:**
   - Timer tick checks for expired effects
   - Server removes expired effects from state
   - Client auto-removes after 10 seconds (setTimeout)
   - Round end clears all effects

### Message Flow

**GOLD_UPDATE:**
```javascript
// Server
this.broadcast("GOLD_UPDATE", { gold: { teamId: amount, ... } });

// Client (Teacher & Student)
room.onMessage("GOLD_UPDATE", (message) => {
  setTeamGold(prev => ({ ...prev, ...message.gold }));
});
```

**CARD_CAST:**
```javascript
// Server
this.broadcast("CARD_CAST", { cardId, casterTeamId, targetTeamId });

// Client (Target Team)
room.onMessage("CARD_CAST", (message) => {
  if (message.targetTeamId === teamId) {
    setActiveEffects(prev => [...prev, message]);
  }
});

// Client (Teacher)
room.onMessage("CARD_CAST", (message) => {
  setCardCastLog(prev => [...prev, { timestamp, ...message }]);
});
```

---

## Known Limitations

1. **Effect Stacking:** Only one effect per team at a time (new effect replaces old)
2. **localStorage:** Team ID is saved but full rejoin still required after refresh
3. **Effect Duration:** Fixed at 10 seconds (not configurable)
4. **Card Costs:** Hard-coded in CARDS constant (not configurable)

---

## Summary

Chapter 4 successfully adds a strategic card and gold system to the team-based quiz game. Teams earn gold through collaboration (suggestions) and can spend it to cast disruptive or helpful cards. The system includes:

- **4 unique cards** with distinct visual effects
- **Real-time gold tracking** across all clients
- **Visual effect overlays** with CSS animations
- **Card cast logging** for teacher oversight
- **Answer synchronization** to ensure all answers are collected

All previous functionality (Chapters 1-3) is preserved, and the system is fully tested and working.

**Total Implementation Time:** ~4 hours  
**Files Modified:** 3 (QuizRoom.js, Teacher.jsx, Student.jsx)  
**Files Created:** 3 (GoldDisplay.jsx, CardBar.jsx, EffectsOverlay.jsx)  
**Lines of Code Added:** ~600

