# Chapter 7 Implementation Report: Lobby & Team System

## Executive Summary

Chapter 7 implements a comprehensive pre-match lobby system that allows players to organize into teams before starting a quiz match. The lobby supports dynamic team creation, player assignment, readiness tracking, teacher controls, and automatic team balancing. Players can create teams with custom names, edit team names, join/leave teams, and mark themselves as ready. Teachers have full control over lobby settings, team management, and match initiation.

**Status:** ✅ **IMPLEMENTATION COMPLETE - TESTED & WORKING**

### Key Achievements
- ✅ Pre-match lobby room system (separate from QuizRoom)
- ✅ Dynamic team creation with custom names
- ✅ Player self-selection and team assignment
- ✅ Readiness tracking system
- ✅ Teacher controls (lock lobby, start match, manual assignment)
- ✅ Auto-balance teams feature (creates teams automatically)
- ✅ Team name editing for players
- ✅ Smooth transition from lobby to quiz room
- ✅ Team data persistence through match start

---

## 1. Architecture Overview

### 1.1 Lobby Flow

```
Teacher/Student Login
  ↓
Join LobbyRoom (separate Colyseus room)
  ↓
Team Formation Phase:
  - Students create/join teams
  - Teachers can manually assign or auto-balance
  - Players mark themselves as ready
  ↓
Teacher Starts Match
  ↓
LobbyRoom creates QuizRoom with team assignments
  ↓
All clients transition to QuizRoom
  ↓
Match Begins
```

### 1.2 Room Structure

**LobbyRoom** (`server/LobbyRoom.js`):
- Pre-match gathering room
- Handles team formation and readiness
- Manages player assignment and team creation
- Validates match start conditions
- Creates QuizRoom with initial team state

**QuizRoom** (`server/QuizRoom.js`):
- Active game room
- Receives team assignments from LobbyRoom
- Initializes teams with names and player roles
- Continues game logic from previous chapters

### 1.3 State Schema

**LobbyState Schema:**
```javascript
class LobbyState extends Schema {
    players = new MapSchema();    // Map<sessionId, PlayerState>
    teams = new MapSchema();      // Map<teamId, TeamState>
    locked = false;               // Lobby lock status
    matchStarted = false;         // Match start flag
    quizRoomId = "";              // Created QuizRoom ID
    allowSelfSelection = true;    // Student team selection toggle
}
```

**PlayerState Schema:**
```javascript
class PlayerState extends Schema {
    id = "";              // playerId from JWT
    displayName = "";     // from database
    teamId = "";          // assigned team ID
    ready = false;        // readiness status
    sessionId = "";       // Colyseus session ID
    isTeacher = false;    // teacher flag
}
```

**TeamState Schema:**
```javascript
class TeamState extends Schema {
    id = "";              // Team ID (A, B, C...)
    name = "";            // Team name (custom)
    playerCount = 0;      // Number of players
}
```

---

## 2. Server Implementation

### 2.1 LobbyRoom Class (`server/LobbyRoom.js`)

#### Message Handlers

**Student Messages:**
- `SET_READY` - Toggle ready status
- `CREATE_TEAM` - Create new team with custom name
- `CHANGE_TEAM` - Leave current team and join another
- `UPDATE_TEAM_NAME` - Edit team name (if member)

**Teacher Messages:**
- `LOCK_LOBBY` - Lock/unlock lobby
- `SET_SELF_SELECTION` - Enable/disable student team selection
- `ASSIGN_TEAM` - Manually assign player to team
- `BALANCE_TEAMS` - Auto-create teams and distribute players
- `CREATE_TEAM` - Create team (teachers can create without joining)
- `DELETE_TEAM` - Delete empty teams
- `START_MATCH` - Create QuizRoom and transition players

#### Key Methods

**`onJoin(client, options)`**
- Verifies JWT token
- Loads player data from database
- Creates/updates PlayerState
- Handles reconnection scenarios
- Broadcasts lobby update

**`assignTeam(client, playerId, teamId)`**
- Assigns player to team
- Updates team player count
- Handles team switching (removes from old, adds to new)
- Validates team capacity limits
- Falls back to playerId lookup if sessionId fails (reconnect handling)

**`createTeam(client, teamName)`**
- Creates new team with custom name
- Generates unique team ID (A, B, C...)
- Auto-assigns creating student to team
- Teachers can create without joining
- Validates max teams limit

**`balanceTeams()`**
- Calculates optimal number of teams based on player count
- **Auto-creates teams** with standard names ("Team 1", "Team 2", etc.)
- Distributes unassigned players evenly
- Assigns to teams with fewest players first
- Respects max players per team limit

**`startMatch(client, override)`**
- Validates match start conditions:
  - At least 2 teams with players
  - Lobby locked OR all players ready (unless override)
- Creates QuizRoom via `matchMaker.createRoom()`
- Passes team assignments and player assignments to QuizRoom
- Broadcasts MATCH_START message
- Disconnects clients (they reconnect to QuizRoom)

**`getTeamAssignments()`**
- Builds team assignment structure for QuizRoom
- Includes team names and writer assignments
- Returns: `{ teamId: { playerIds: [], writerId: string, name: string } }`

**`getPlayerAssignments()`**
- Builds player assignment structure for QuizRoom
- Includes team membership and writer status
- Returns: `{ playerId: { teamId: string, displayName: string, isWriter: boolean } }`

### 2.2 Configuration (`server/config/lobby.js`)

```javascript
export const LOBBY_CONFIG = {
  maxTeams: 2,              // Maximum number of teams
  maxPlayersPerTeam: 4,     // Maximum players per team
  autoBalance: true         // Auto-balance feature flag
};
```

### 2.3 QuizRoom Integration (`server/QuizRoom.js`)

**Modified `onCreate(options)`:**
- Accepts `teams` and `players` from LobbyRoom
- Calls `initializeTeamsFromLobby()` if provided

**`initializeTeamsFromLobby(teamsData, playersData)`:**
- Creates TeamState instances with lobby data
- Stores team names from lobby
- Sets `writerPlayerId` (persistent writer tracking)
- Stores player assignments for `onJoin()` lookup

**Modified `onJoin(client, options)`:**
- Looks up player assignment from lobby
- Assigns writer based on `playerAssignment.isWriter` or `writerPlayerId`
- Handles reconnects (cleans stale sessionIds)
- Sends `TEAM_JOINED` with team name
- Includes delays to prevent race conditions

---

## 3. Client Implementation

### 3.1 Student Lobby (`client/src/pages/Lobby.jsx`)

**Features:**
- View all teams and players
- Create team with custom name
- Join existing teams (if self-selection enabled)
- Change teams (if self-selection enabled)
- Edit team name (if member)
- Toggle ready status
- See readiness percentage
- View lobby lock status

**Team Name Editing:**
- "Edit Name" button appears next to team name for team members
- Inline editing with Save/Cancel buttons
- Keyboard shortcuts (Enter to save, Escape to cancel)
- Sends `UPDATE_TEAM_NAME` message

**Team Display:**
- Shows team name, player count, and member list
- Highlights player's own team
- Shows ready status for each player
- Displays unassigned players section

### 3.2 Teacher Lobby (`client/src/pages/TeacherLobby.jsx`)

**Features:**
- Lock/unlock lobby
- Toggle self-selection (allow students to choose teams)
- Create teams manually
- Delete empty teams
- Manually assign players to teams
- **Auto-balance teams** (creates teams and distributes players)
- Start match (with override option)
- View readiness percentage and team status

**Auto-Balance Section:**
- Purple-highlighted section
- Shows count of unassigned players
- Button enabled even when no teams exist
- Automatically creates teams ("Team 1", "Team 2", etc.)
- Distributes players evenly
- Confirmation dialog before execution

**Team Management:**
- Create Team: Green section for creating new teams
- Delete Team: Red section for deleting empty teams
- Manual Assign: Blue section for fine-grained control
- Auto-Balance: Purple section for automatic distribution

---

## 4. Key Features

### 4.1 Dynamic Team Creation

**By Students:**
- Students can create teams with custom names
- Creating student automatically joins the team
- Teams created on-demand (no pre-created teams)

**By Teachers:**
- Teachers can create teams without joining
- Useful for setting up teams before students arrive
- Teams remain empty until players join

**By Auto-Balance:**
- Automatically creates optimal number of teams
- Uses standard names ("Team 1", "Team 2", etc.)
- Calculates teams needed based on player count
- Respects maxTeams configuration

### 4.2 Team Name Editing

**Implementation:**
- Players can edit their team's name
- Teachers can edit any team's name
- Validation: 1-50 characters, no empty names
- Real-time updates via WebSocket
- Inline editing UI with save/cancel

### 4.3 Auto-Balance Teams

**Algorithm:**
1. Calculate ideal team count:
   - Minimum: 2 teams
   - Maximum: `LOBBY_CONFIG.maxTeams`
   - Optimal: `ceil(totalStudents / maxPlayersPerTeam)`
2. Create teams if needed:
   - Standard names: "Team 1", "Team 2", etc.
   - Unique team IDs: A, B, C...
3. Distribute players:
   - Sort teams by player count (smallest first)
   - Assign each unassigned player to team with fewest players
   - Re-sort after each assignment for even distribution
   - Respect maxPlayersPerTeam limit

**Use Cases:**
- Quick team setup for large classes
- Balanced teams for fair gameplay
- Automatic organization without manual work

### 4.4 Readiness System

**Student Actions:**
- Toggle ready status
- Must be on a team to mark ready
- Ready status resets when changing teams

**Validation:**
- Match can start if:
  - Lobby is locked, OR
  - All players are ready, OR
  - Teacher uses override

**Display:**
- Shows readiness percentage
- Ready count / Total student count
- Individual ready status on team cards

### 4.5 Lobby Lock

**Purpose:**
- Prevents new players from joining
- Prevents team changes
- Required for match start (unless all ready)

**Behavior:**
- When locked:
  - Students cannot change teams
  - Students cannot create new teams
  - Students cannot edit team names
  - Students can still toggle ready
- Teacher can lock/unlock at any time

### 4.6 Self-Selection Toggle

**Purpose:**
- Teacher controls whether students can choose their own teams

**When Enabled:**
- Students can create teams
- Students can join teams
- Students can change teams
- Students can edit team names

**When Disabled:**
- Students cannot create/join/change teams
- Students must wait for teacher assignment
- Teacher must manually assign or auto-balance

### 4.7 Match Start Flow

**Validation:**
1. At least 2 teams with players
2. Lobby locked OR all players ready (unless override)

**Process:**
1. Create QuizRoom via `matchMaker.createRoom()`
2. Pass team assignments (with names and writer IDs)
3. Pass player assignments (with team membership)
4. Broadcast `MATCH_START` message with QuizRoom ID
5. Clients disconnect from LobbyRoom
6. Clients connect to QuizRoom
7. QuizRoom initializes teams from lobby data

**Data Transfer:**
- Team names preserved
- Writer assignments preserved (using playerId)
- Player roles (writer/suggester) preserved

---

## 5. UI/UX Features

### 5.1 Student Lobby UI

**Sections:**
- Status panel: Team assignment, readiness percentage
- Ready button: Toggle ready status
- Create Team: Green-bordered section (when not on team)
- Join Team: Orange-bordered section (when teams exist)
- Change Team: Blue-bordered section (when on team)
- Teams List: Shows all teams with members
- Unassigned Players: Shows players without teams

**Team Card:**
- Team name with edit button (for members)
- Player count
- Member list with ready status
- Highlighted if player's team

**Edit Team Name:**
- Inline editing interface
- Input field replaces team name
- Save/Cancel buttons
- Keyboard shortcuts

### 5.2 Teacher Lobby UI

**Control Panel:**
- Lock Lobby button (orange when unlocked, gray when locked)
- Self-Selection toggle (green when enabled, gray when disabled)
- Readiness percentage display
- Team count display

**Team Management Sections:**
1. **Create Team** (Green):
   - Input field for team name
   - Create button
   - Info about team creation

2. **Delete Team** (Red):
   - Dropdown of empty teams
   - Delete button
   - Warning for teams with players

3. **Auto-Balance Teams** (Purple):
   - Prominent button
   - Shows unassigned player count
   - Helpful message when no teams exist
   - Confirmation dialog

4. **Manual Assign** (Blue):
   - Player dropdown
   - Team dropdown
   - Assign button
   - Warning when no teams exist

**Start Match Section:**
- Override checkbox (start even if not all ready)
- Start Match button (green when enabled)
- Error message when conditions not met
- Disabled when cannot start

**Teams Display:**
- All teams with members
- Readiness status per player
- Player count per team

---

## 6. Technical Details

### 6.1 Reconnection Handling

**Problem:**
- Colyseus uses sessionIds which change on reconnect
- Player state stored by sessionId becomes stale

**Solution:**
- Track players by `playerId` (from JWT, persistent)
- On reconnect, remove old sessionId entry
- Create new entry with new sessionId
- Preserve team assignment and ready status
- Update team player counts correctly

**Implementation:**
```javascript
// In onJoin, check for existing playerId
let existingPlayerState = null;
for (const [sessionId, pState] of this.state.players.entries()) {
    if (pState.id === decoded.playerId) {
        // Player reconnecting - remove old entry
        existingPlayerState = pState;
        this.state.players.delete(sessionId);
        // Preserve team assignment
        break;
    }
}
```

### 6.2 Race Condition Prevention

**Problem:**
- Messages sent before client registers handlers
- "onMessage() not registered" warnings
- Players miss initial state

**Solution:**
- Add delays before sending initial messages
- `setTimeout` delays (100-150ms) in `QuizRoom.onJoin()`
- Allows client to register all handlers first

**Implementation:**
```javascript
// Delay sending TEAM_JOINED
setTimeout(() => {
    client.send("TEAM_JOINED", { ... });
}, 100);

// Delay sending other messages
setTimeout(() => {
    client.send("ROUND_STARTED", { ... });
    client.send("TEAM_SETTINGS_UPDATE", { ... });
}, 150);
```

### 6.3 Writer Assignment Persistence

**Problem:**
- Writer tracked by sessionId (becomes stale on reconnect)
- Need persistent writer tracking for reconnect handling

**Solution:**
- Add `writerPlayerId` to TeamState (persistent)
- Track writer by playerId, not just sessionId
- Use `writerPlayerId` to restore writer on reconnect

**Implementation:**
```javascript
class TeamState extends Schema {
    writer = "";              // sessionId (current)
    writerPlayerId = "";      // playerId (persistent)
    // ...
}

// In QuizRoom.onJoin:
if (team.writerPlayerId === playerId || playerAssignment.isWriter) {
    team.writer = client.sessionId;
    team.writerPlayerId = playerId;
}
```

### 6.4 Message Broadcasting

**LobbyRoom Messages:**
- `LOBBY_UPDATE` - Full lobby state (players, teams, settings)
- `TEAM_CREATED` - Team creation confirmation
- `MATCH_START` - Match start notification with QuizRoom ID
- `ERROR` - Error messages

**Client Message Handlers:**
- Students: LOBBY_UPDATE, MATCH_START, ERROR, TEAM_CREATED
- Teachers: LOBBY_UPDATE, MATCH_START, ERROR, TEAM_CREATED

---

## 7. Configuration

### 7.1 Lobby Configuration (`server/config/lobby.js`)

```javascript
export const LOBBY_CONFIG = {
  maxTeams: 2,              // Maximum number of teams
  maxPlayersPerTeam: 4,     // Maximum players per team
  autoBalance: true         // Auto-balance feature enabled
};
```

**Configurable Values:**
- `maxTeams`: Limit on number of teams (default: 2)
- `maxPlayersPerTeam`: Team capacity limit (default: 4)
- `autoBalance`: Feature flag (default: true)

### 7.2 Match Start Conditions

**Required:**
- At least 2 teams with players
- Lobby locked OR all players ready (unless override)

**Override Option:**
- Teacher can start match even if conditions not met
- Useful for testing or small groups
- Should be used with caution

---

## 8. File Structure

### 8.1 Server Files

```
server/
├── LobbyRoom.js          # Main lobby room implementation
├── config/
│   └── lobby.js          # Lobby configuration
└── QuizRoom.js           # Modified to accept lobby data
```

### 8.2 Client Files

```
client/src/
├── pages/
│   ├── Lobby.jsx         # Student lobby page
│   └── TeacherLobby.jsx  # Teacher lobby page
└── ws/
    └── colyseusClient.js # Helper functions for joining rooms
```

---

## 9. Testing

### 9.1 Test Scenarios

**Team Creation:**
1. ✅ Student creates team → Auto-joins team
2. ✅ Teacher creates team → Does not join team
3. ✅ Auto-balance creates teams automatically
4. ✅ Team names editable by members

**Player Assignment:**
1. ✅ Student joins existing team
2. ✅ Student changes teams
3. ✅ Teacher manually assigns players
4. ✅ Auto-balance distributes evenly

**Readiness:**
1. ✅ Player marks ready
2. ✅ Ready status resets on team change
3. ✅ Readiness percentage calculates correctly
4. ✅ Match starts when all ready or locked

**Match Start:**
1. ✅ Creates QuizRoom with team data
2. ✅ Transitions all clients to QuizRoom
3. ✅ Team names preserved
4. ✅ Writer assignments preserved

**Reconnection:**
1. ✅ Player reconnects → Maintains team assignment
2. ✅ Writer reconnects → Maintains writer role
3. ✅ Team counts update correctly

### 9.2 Known Issues & Solutions

**Issue: "onMessage() not registered" warnings**
- **Solution:** Added delays before sending initial messages

**Issue: Duplicate players in UI**
- **Solution:** Client-side deduplication by playerId

**Issue: Writer lost on reconnect**
- **Solution:** Added `writerPlayerId` for persistent tracking

**Issue: Team names lost**
- **Solution:** Pass team names from LobbyRoom to QuizRoom

---

## 10. Future Enhancements

### Potential Improvements:
1. **Team Templates:** Pre-configured team setups
2. **Team Presets:** Save/load team configurations
3. **Auto-Assign by Level:** Balance teams by player level
4. **Team Shuffle:** Randomize team assignments
5. **Spectator Mode:** Allow non-playing observers
6. **Team Chat:** In-team communication (optional)
7. **Team Colors:** Visual team identification
8. **Advanced Analytics:** Team performance history

---

## 11. Conclusion

Chapter 7 successfully implements a comprehensive lobby and team system that provides flexible team formation, intuitive controls for both students and teachers, and smooth transitions to gameplay. The auto-balance feature simplifies team setup for teachers, while player self-selection provides autonomy for students. Team name editing and dynamic team creation enhance the user experience.

The system handles edge cases well, including reconnections, race conditions, and state synchronization. The implementation preserves all previous chapter functionality while adding the crucial pre-match organization phase.

**Key Achievements:**
- ✅ Complete lobby system with team management
- ✅ Flexible team creation and assignment
- ✅ Auto-balance with automatic team creation
- ✅ Team name editing capabilities
- ✅ Robust reconnection handling
- ✅ Smooth transition to quiz room
- ✅ Comprehensive teacher controls

**Next Steps:**
- Chapter 8: Additional features as needed
- Performance optimizations for large lobbies
- Enhanced team analytics and reporting

---

## 12. Appendices

### 12.1 Message Protocol

**Client → Server:**
- `SET_READY` - Toggle ready status
- `CREATE_TEAM` - Create team with name
- `CHANGE_TEAM` - Join different team
- `UPDATE_TEAM_NAME` - Edit team name
- `LOCK_LOBBY` - Lock/unlock (teacher only)
- `SET_SELF_SELECTION` - Toggle self-selection (teacher only)
- `ASSIGN_TEAM` - Manual assignment (teacher only)
- `BALANCE_TEAMS` - Auto-balance (teacher only)
- `DELETE_TEAM` - Delete team (teacher only)
- `START_MATCH` - Start match (teacher only)

**Server → Client:**
- `LOBBY_UPDATE` - Full lobby state
- `TEAM_CREATED` - Team creation confirmation
- `MATCH_START` - Match start with QuizRoom ID
- `ERROR` - Error message

### 12.2 Database Schema

No new database tables for Chapter 7. Uses existing `players` table from Chapter 5 for player data. Lobby state is ephemeral (stored in Colyseus room state only).

### 12.3 API Endpoints

No new REST API endpoints for Chapter 7. All communication via WebSocket messages through Colyseus rooms.

---

**End of Chapter 7 Implementation Report**

