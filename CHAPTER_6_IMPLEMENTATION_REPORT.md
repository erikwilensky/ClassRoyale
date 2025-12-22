# Chapter 6 Implementation Report: Scoring System & External Scoring Pipeline

## Executive Summary

Chapter 6 implements a comprehensive scoring system for ClassRoyale, including individual answer evaluation, round-based match scoring, teacher override capabilities, and real-time score tracking. Chapter 6.5 refactored the system to remove internal AI/heuristic scoring and replace it with an external scoring pipeline where teachers submit scores manually (or via LLM assistance outside the application).

### Key Achievements
- ✅ External scoring pipeline (teacher-submitted scores)
- ✅ Individual player scoring (writer receives 100% of evaluation score)
- ✅ Round-based match scoring (first to 5 round points wins)
- ✅ Match settings (configurable rounds to win, optional max rounds)
- ✅ Manual match end functionality
- ✅ Real-time scoreboard and result displays
- ✅ Teacher score override capabilities
- ✅ MVP calculation based on total evaluation scores
- ✅ XP bonuses integrated with scoring system

---

## 1. Architecture Overview

### 1.1 Scoring Model

The scoring system uses a two-tier model:

1. **Evaluation Scores (0-10 scale)**: Individual answer quality assessment
   - Assigned to the writer (100% ownership)
   - Accumulated as `totalEvaluationScore` per player
   - Used to determine round winners and MVP

2. **Round Points (Binary)**: Match progress tracking
   - Round winner receives +1 round point
   - First team to reach 5 round points wins the match
   - Stored as `teams` Map (teamId -> roundPoints)

### 1.2 Scoring Flow

```
Round Ends
  ↓
Collect Answers (with writer/suggester identity)
  ↓
Broadcast ROUND_DATA (answers only, no scores)
  ↓
Teacher Reviews Answers (externally, optionally with LLM)
  ↓
Teacher Submits Scores via UI → POST /api/score/submit
  ↓
submitRoundScores() processes scores:
  - Store evaluation scores
  - Assign to writers (100%)
  - Determine round winner (highest eval score)
  - Award round point (+1) to winner
  - Check match win condition
  - Award XP bonuses
  - Broadcast ROUND_SCORE
  ↓
If match won → Broadcast MATCH_OVER
```

### 1.3 State Structure

```javascript
scores = {
  teams: Map<teamId, roundPoints>,           // Match score (round points)
  perPlayer: Map<playerId, {                 // Individual scores
    roundScores: [],                         // Array of evaluation scores per round
    totalEvaluationScore: number             // Sum of all evaluation scores
  }>,
  roundScores: Map<roundNumber, {            // Submitted scores per round
    teamId: evaluationScore
  }>,
  roundNumber: number,
  matchOver: boolean,
  winner: teamId | null
};
```

---

## 2. External Scoring Pipeline (Chapter 6.5)

### 2.1 Removed Internal Scoring

**File: `server/services/scoringService.js`**
- Converted `scoreAnswer()` to stub that returns `null`
- All scoring must come from external teacher input
- File retained for future LLM integration hooks if needed

**Key Change:**
```javascript
// Before (Chapter 6)
const evaluationScore = await scoreAnswer(answerText, questionText);

// After (Chapter 6.5)
// No internal scoring - teacher submits scores externally
```

### 2.2 ROUND_DATA Message

**New message type** broadcast when round ends:

```javascript
{
  roundNumber: number,
  question: string,
  answers: {
    [teamId]: {
      text: string,
      writerId: string,
      suggesterIds: string[]
    }
  },
  teamIds: string[]
}
```

**Purpose**: Provides answers to teacher for external evaluation (LLM or manual).

### 2.3 Score Submission API

**Endpoint: `POST /api/score/submit`**

**Payload:**
```json
{
  "round": 4,
  "scores": {
    "TEAM1": 7,
    "TEAM2": 4
  }
}
```

**Validation:**
- Teacher authentication required
- All teams in round must have scores
- Scores must be 0-10
- Match must not be over

**Process:**
1. Validate input
2. Store round scores
3. Assign evaluation scores to writers
4. Determine round winner
5. Award round point (+1)
6. Check match win condition
7. Award XP bonuses
8. Broadcast ROUND_SCORE
9. If match won, broadcast MATCH_OVER

---

## 3. Scoring Logic Implementation

### 3.1 Round Winner Determination

```javascript
determineRoundWinner(evaluationScores) {
  // evaluationScores: Map<teamId, evaluationScore>
  let winner = null;
  let maxScore = -1;
  for (const [teamId, score] of evaluationScores.entries()) {
    if (score > maxScore) {
      maxScore = score;
      winner = teamId;
    }
  }
  return winner;
}
```

**Rule**: Team with highest evaluation score wins the round.

### 3.2 Match Win Condition

```javascript
checkMatchWinCondition() {
  const roundsToWin = MATCH_SETTINGS.roundsToWin;  // Default: 5
  const maxRounds = MATCH_SETTINGS.maxRounds;      // Optional: null or number
  
  // Check max rounds limit
  if (maxRounds !== null && this.scores.roundNumber >= maxRounds) {
    // Winner = team with most round points at max rounds
    return true;
  }
  
  // Check rounds to win
  for (const [teamId, roundPoints] of this.scores.teams.entries()) {
    if (roundPoints >= roundsToWin) {
      this.scores.matchOver = true;
      this.scores.winner = teamId;
      return true;
    }
  }
  
  return false;
}
```

**Win Conditions:**
1. **Primary**: First team to reach `roundsToWin` (default: 5) round points
2. **Secondary**: If `maxRounds` is set, match ends at that round (winner = most round points)

### 3.3 Score Assignment

**Individual Scoring:**
- Writer receives 100% of evaluation score
- Stored in `perPlayer[writerId].roundScores[round - 1]`
- Added to `totalEvaluationScore`

**Match Scoring:**
- Round winner receives +1 round point
- Stored in `teams[winnerTeamId]`

---

## 4. Server-Side Implementation

### 4.1 QuizRoom.js Changes

#### Modified `endRound()`

**Before (Chapter 6):**
- Called `scoreAnswer()` internally
- Automatically determined round winner
- Broadcasted `ROUND_SCORE` immediately

**After (Chapter 6.5):**
- Collects answers with writer/suggester identity
- Broadcasts `ROUND_DATA` (answers only)
- Awards participation XP (+5)
- Waits for teacher to submit scores

```javascript
async endRound() {
  // 1. Collect answers
  // 2. Broadcast ROUND_DATA
  // 3. Award participation XP
  // 4. Broadcast ROUND_ENDED (for backward compatibility)
}
```

#### New Method: `submitRoundScores(round, scores)`

**Location**: `server/QuizRoom.js`

**Process:**
1. Validate round exists and match not over
2. Validate all teams have scores (0-10)
3. Store scores: `this.scores.roundScores.set(round, scores)`
4. Assign to writers (100% ownership)
5. Determine round winner
6. Award round point (+1)
7. Check match win condition
8. Award XP bonuses
9. Broadcast `ROUND_SCORE`
10. If match won, broadcast `MATCH_OVER`

**Key Feature**: Handles score differences correctly (for overrides/submissions)

#### Match Settings Handlers

**New Message: `setMatchSettings`**
```javascript
{
  roundsToWin: number,  // First team to reach this wins
  maxRounds: number | null  // Optional: fixed number of rounds
}
```

**New Message: `endMatch`**
- Manually ends match
- Winner = team with most round points
- Broadcasts `MATCH_OVER`
- Awards final XP bonuses

#### Match End Prevention

**Added to `startRound` handler:**
```javascript
if (this.scores.matchOver) {
  client.send("ERROR", { message: "Cannot start new round: match has already ended" });
  return;
}
```

### 4.2 API Routes

**File: `server/routes/scoring.js`**

#### POST /api/score/submit
- Primary scoring endpoint
- Teacher-only authentication
- Calls `QuizRoom.submitRoundScores()`
- Returns success/error status

#### POST /api/score/override (Legacy)
- Teacher override for existing scores
- Calls `QuizRoom.applyOverride()`
- Recalculates round outcome if needed

#### GET /api/score/match
- Returns current match scores
- Includes: teams, perPlayer, roundScores, roundNumber, matchOver, winner
- Teacher-only authentication

---

## 5. Client-Side Implementation

### 5.1 Teacher Interface

**File: `client/src/pages/Teacher.jsx`**

#### New State
```javascript
const [roundData, setRoundData] = useState(null);      // ROUND_DATA message
const [pendingRound, setPendingRound] = useState(null); // Round waiting for scoring
const [scoreInputs, setScoreInputs] = useState({});    // { teamId: score }
const [roundsToWin, setRoundsToWin] = useState(5);
const [maxRounds, setMaxRounds] = useState(null);
```

#### ROUND_DATA Handler
- Receives answers for scoring
- Displays scoring UI with input fields for each team
- Initializes score inputs

#### Score Submission UI
```jsx
{pendingRound && roundData && (
  <div>
    <h3>📝 Score Round {pendingRound}</h3>
    {Object.entries(roundData.answers).map(([teamId, answerData]) => (
      <div key={teamId}>
        <strong>{teamId}:</strong> {answerData.text}
        <input
          type="number"
          min="0"
          max="10"
          value={scoreInputs[teamId] || ""}
          onChange={(e) => setScoreInputs(prev => ({ ...prev, [teamId]: e.target.value }))}
        />
      </div>
    ))}
    <button onClick={handleSubmitScores}>Submit Scores</button>
  </div>
)}
```

#### Match Settings UI
- "Rounds to Win" input (default: 5)
- "Max Rounds" input (empty = unlimited)
- "Update Match Settings" button
- "End Match Now" button (manual end)

#### Disabled States
- "Start Round" disabled when `matchOver === true`
- Match settings disabled when match over
- Prevents starting new rounds after match ends

### 5.2 Student Interface

**File: `client/src/pages/Student.jsx`**

#### ROUND_DATA Handler
- Shows "Waiting for teacher to score..." message
- Displays pending state until scores received

#### ROUND_SCORE Handler
- Updates round result display
- Shows evaluation scores
- Displays round winner
- Updates match standings

#### Components
- **Scoreboard**: Persistent widget showing round points
- **RoundResult**: Modal showing round evaluation scores and winner
- **MatchResult**: Final match results with MVP

### 5.3 Scoreboard Component

**File: `client/src/pages/TeacherScoreboard.jsx`**

#### Features
- Real-time score updates (WebSocket + polling)
- Round scores display (evaluation scores per round)
- Match scores display (round points)
- Score override functionality
- Pending scoring UI for current round

#### WebSocket Connection
- Connects to QuizRoom as teacher
- Listens for `ROUND_DATA` messages
- Listens for `ROUND_SCORE` updates
- Submits scores via `/api/score/submit`

---

## 6. XP Integration

### 6.1 XP Bonuses

**File: `server/QuizRoom.js` - `awardScoringXP()`**

**Awarded when scores are submitted:**

1. **Round Winner Team**: +3 XP per player
   - Awarded to writer and all suggesters
   - Only for winning team

2. **Match Winner Team**: +20 XP per player
   - Awarded when match ends
   - Only to winning team players

3. **Match MVP**: +10 XP
   - Player with highest `totalEvaluationScore`
   - Additional bonus on top of match winner XP

4. **Participation**: +5 XP
   - Awarded in `endRound()` to all active players
   - Independent of scoring

**Note**: XP is awarded for **match performance** (winning rounds, winning match), not for answer correctness/evaluation score value.

### 6.2 XP Caching

- XP accumulated in memory during match (`xpCache`)
- Flushed to database when:
  - Round ends (participation XP)
  - Scores submitted (round winner XP)
  - Match ends (match winner, MVP XP)

---

## 7. Score Override System

### 7.1 Override Functionality

**Endpoint: `POST /api/score/override`**

**Payload:**
```json
{
  "teamId": "TEAM1",
  "playerId": "player-uuid",
  "round": 3,
  "newEvaluationScore": 8
}
```

**Process:**
1. Updates player's evaluation score for that round
2. Adjusts `totalEvaluationScore` by difference
3. Recalculates round winner (if score change affects winner)
4. Updates match scores if round winner changed
5. Broadcasts `PLAYER_SCORE_UPDATE` and `ROUND_SCORE_UPDATE`

**Constraints:**
- Teacher-only
- Cannot override after match ends
- Score must be 0-10

### 7.2 Recalculation Logic

**Method: `recalculateRoundOutcome(round)`**

- Recalculates round winner from updated scores
- Recalculates all round points from scratch (round 1 to current)
- Checks match win condition
- Returns updated team scores

---

## 8. Match Configuration

### 8.1 Default Settings

**File: `server/config/scoring.js`**

```javascript
export const MATCH_SETTINGS = {
  roundsToWin: 5,   // First team to reach this score wins
  maxRounds: null   // Optional: fixed number of rounds
};
```

### 8.2 Configuration Options

**Rounds to Win:**
- Default: 5
- First team to reach this number of round points wins
- Configurable by teacher via UI

**Max Rounds:**
- Default: `null` (unlimited)
- If set, match ends at this round number
- Winner = team with most round points at max rounds
- Useful for fixed-length matches

### 8.3 Teacher Controls

**Match Settings Panel:**
- Input: Rounds to Win (number)
- Input: Max Rounds (number or empty)
- Button: Update Match Settings
- Button: End Match Now (manual end)

**Manual End Match:**
- Teacher can end match at any time
- Winner = team with most round points
- Awards final XP bonuses
- Broadcasts `MATCH_OVER`

---

## 9. Message Flow

### 9.1 Round End Flow

```
endRound() called
  ↓
Collect answers with writer/suggester identity
  ↓
Broadcast ROUND_DATA
  ├─→ Teacher receives → Shows scoring UI
  └─→ Students receive → Shows "waiting for teacher" message
  ↓
Teacher submits scores → POST /api/score/submit
  ↓
submitRoundScores() processes:
  - Assigns evaluation scores
  - Determines round winner
  - Awards round point
  - Checks match win condition
  - Awards XP bonuses
  ↓
Broadcast ROUND_SCORE
  ├─→ Teacher receives → Updates scoreboard
  └─→ Students receive → Shows round results
  ↓
If match won:
  Broadcast MATCH_OVER
  ├─→ Teacher receives → Match end UI
  └─→ Students receive → Match result modal
```

### 9.2 Message Types

**ROUND_DATA** (New in 6.5)
- Answers only, no scores
- Sent when round ends
- Purpose: Teacher evaluation

**ROUND_SCORE**
- Evaluation scores (teams & per-player)
- Round points (match scores)
- Round winner
- Match over status
- Sent after teacher submits scores

**ROUND_SCORE_UPDATE**
- Sent when score override changes round winner
- Contains updated scores

**PLAYER_SCORE_UPDATE**
- Sent when individual player score changes
- Contains new evaluation score

**MATCH_OVER**
- Final match results
- Winner team
- MVP player
- Final scores (teams & per-player)

**MATCH_SETTINGS_UPDATE**
- Broadcasts match configuration changes
- Contains roundsToWin and maxRounds

---

## 10. Database & Persistence

### 10.1 XP Logging

**Table: `xp_log`**
- Records all XP awards with reasons
- Used for debugging and analytics
- Links to players table

**Example entries:**
- `"onRoundEnd"` - Participation XP (+5)
- `"roundWinner"` - Round winner bonus (+3)
- `"matchWinner"` - Match winner bonus (+20)
- `"matchMVP"` - MVP bonus (+10)

### 10.2 Scoring State

**In-Memory Only:**
- Round scores (submitted per round)
- Match scores (round points)
- Player evaluation scores
- Match status (over, winner)

**Rationale:**
- Scores are match-specific
- No need for historical score storage (can be added later)
- XP is persisted separately

---

## 11. Error Handling & Validation

### 11.1 Score Submission Validation

**Server-side checks:**
- Round exists in `this.answers`
- All teams in round have scores
- Scores are numbers 0-10
- Match not over
- Teacher authentication

**Client-side checks:**
- All score inputs filled
- Scores within 0-10 range
- Teacher authenticated

### 11.2 Edge Cases

**Tie Scores:**
- Round winner = first team with highest score (tie-breaker)
- Match winner at max rounds = first team with most points

**Missing Scores:**
- All teams must have scores to submit
- Empty answers can receive score 0

**Match Already Over:**
- Cannot submit new scores
- Cannot start new rounds
- Cannot change match settings
- Can still view scoreboard

---

## 12. Testing & Verification

### 12.1 Test Scenarios

**Basic Flow:**
1. ✅ Round ends → ROUND_DATA broadcast
2. ✅ Teacher submits scores → Scores processed
3. ✅ Round winner determined correctly
4. ✅ Round point awarded (+1)
5. ✅ Match ends at 5 round points
6. ✅ MVP calculated correctly

**Match Settings:**
1. ✅ Set maxRounds = 10 → Match ends at round 10
2. ✅ Set roundsToWin = 3 → Match ends at 3 round points
3. ✅ Manual end match → Winner = most round points

**Score Override:**
1. ✅ Override changes round winner → Match scores update
2. ✅ Override after match ends → Error (prevented)
3. ✅ Override invalid score → Validation error

**Edge Cases:**
1. ✅ Tie scores → First team wins
2. ✅ Empty answers → Can score 0
3. ✅ Match over → Cannot start new rounds

### 12.2 Known Limitations

1. **No Historical Score Storage**: Scores only in-memory during match
2. **Tie-Breaking**: Uses first team with highest score (simple rule)
3. **Round Numbering**: Starts at 1 (not 0)
4. **Score Precision**: Integer scores only (0-10)

---

## 13. Migration Notes

### 13.1 Breaking Changes (Chapter 6.5)

**Removed:**
- Internal `scoreAnswer()` function (now stub)
- Automatic scoring in `endRound()`
- `ROUND_SCORE` broadcast from `endRound()`

**Added:**
- `ROUND_DATA` message
- `POST /api/score/submit` endpoint
- Teacher scoring UI

**Backward Compatibility:**
- `ROUND_ENDED` still broadcast (for collected answers display)
- `ROUND_SCORE` message format unchanged (just different producer)
- Client components handle both old and new flows

### 13.2 Configuration Migration

**No database migration needed:**
- Match settings stored in code/config
- Can be changed via UI during match

---

## 14. Future Enhancements

### 14.1 Potential Additions

1. **Historical Score Storage**: Persist match scores to database
2. **Advanced Tie-Breaking**: Multiple criteria (evaluation score totals, etc.)
3. **Score Distribution**: Assign percentage to suggesters (currently 100% writer)
4. **LLM Integration**: Hook external LLM service for auto-scoring suggestions
5. **Score Analytics**: Charts/graphs of player performance over time
6. **Match Replay**: View past match scores and progression

### 14.2 Performance Considerations

**Current:**
- In-memory scoring state (fast, but match-specific)
- XP flushed after each round (prevents data loss)

**Potential Optimizations:**
- Batch XP writes (already implemented via caching)
- Lazy-load historical scores
- WebSocket message compression for large score updates

---

## 15. Files Modified/Created

### 15.1 Server Files

**Modified:**
- `server/QuizRoom.js`
  - Modified `endRound()` to broadcast `ROUND_DATA`
  - Added `submitRoundScores()` method
  - Added `checkMatchWinCondition()` with maxRounds support
  - Added match settings and end match handlers
  - Modified `awardScoringXP()` for match-based XP only

- `server/routes/scoring.js`
  - Added `POST /api/score/submit` endpoint
  - Updated `GET /api/score/match` to include `roundScores`

- `server/services/scoringService.js`
  - Stubbed `scoreAnswer()` (returns null)

- `server/config/scoring.js`
  - Contains `MATCH_SETTINGS` configuration

### 15.2 Client Files

**Modified:**
- `client/src/pages/Teacher.jsx`
  - Added `ROUND_DATA` handler and scoring UI
  - Added match settings UI
  - Added "End Match" button
  - Disabled controls when match over
  - Added `handleSubmitScores()` function

- `client/src/pages/Student.jsx`
  - Added `ROUND_DATA` handler (pending state)
  - Updated `ROUND_SCORE` handler

- `client/src/pages/TeacherScoreboard.jsx`
  - Added WebSocket connection
  - Added score submission UI
  - Displays round scores correctly

- `client/src/components/RoundResult.jsx`
  - Handles pending scoring state
  - Shows "Scores pending..." message

---

## 16. Conclusion

Chapter 6 and 6.5 successfully implement a comprehensive scoring system that:

1. **Separates evaluation from match scoring**: Evaluation scores (0-10) vs round points (binary)
2. **Supports external scoring**: Teachers submit scores manually or via external tools
3. **Tracks individual performance**: Writers receive 100% of evaluation score
4. **Determines match winners**: First to 5 round points (configurable)
5. **Provides flexibility**: Configurable match settings, manual end, overrides
6. **Integrates with XP system**: Awards bonuses based on match performance
7. **Maintains real-time updates**: WebSocket-based score synchronization

The system is production-ready and provides a solid foundation for future enhancements such as LLM integration, historical score storage, and advanced analytics.

---

## Appendix A: Configuration Reference

### MATCH_SETTINGS

```javascript
export const MATCH_SETTINGS = {
  roundsToWin: 5,   // First team to reach this number of round points wins
  maxRounds: null   // Optional: Match ends at this round number (null = unlimited)
};
```

### Score Ranges

- **Evaluation Score**: 0-10 (integer)
- **Round Points**: 0+ (integer, increments by 1)
- **Rounds to Win**: 1+ (default: 5)
- **Max Rounds**: 1+ or null (null = unlimited)

---

## Appendix B: Message Schemas

### ROUND_DATA

```typescript
{
  roundNumber: number;
  question: string;
  answers: {
    [teamId: string]: {
      text: string;
      writerId: string;
      suggesterIds: string[];
    };
  };
  teamIds: string[];
}
```

### ROUND_SCORE

```typescript
{
  roundNumber: number;
  question: string;
  evaluationScores: {
    teams: { [teamId: string]: number };      // Evaluation score per team
    perPlayer: { [playerId: string]: number }; // Evaluation score per player (for this round)
  };
  roundPoints: {
    teams: { [teamId: string]: number };      // Round points (match score)
  };
  answers: {
    [teamId: string]: {
      text: string;
      writerId: string;
      suggesterIds: string[];
    };
  };
  roundWinner: string | null;
  matchOver: boolean;
}
```

### MATCH_OVER

```typescript
{
  winner: string | null;  // Team ID
  finalScores: {
    teams: { [teamId: string]: number };
    perPlayer: {
      [playerId: string]: {
        roundScores: number[];
        totalEvaluationScore: number;
      };
    };
  };
  mvp: string | null;  // Player ID
}
```

---

**Report Generated**: Chapter 6 & 6.5 Implementation  
**Last Updated**: After match settings and manual end match features

