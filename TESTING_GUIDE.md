# Comprehensive Testing Package Guide

## Overview

This testing package provides comprehensive test coverage for the ClassRoyale server, focusing on the refactored systems (Chapter 11.5) and integration points.

## Quick Start

### Installation

```bash
npm install
```

### Run Tests

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test suites
npm run test:card      # Card system only
npm run test:scoring   # Scoring system only
npm run test:quizroom  # QuizRoom integration only
npm run test:routes    # Route tests only
```

## Test Structure

```
__tests__/
├── setup.js                    # Global test configuration
├── README.md                   # Test documentation
├── helpers/
│   ├── mockRoom.js            # Mock QuizRoom implementation
│   ├── mockClient.js          # Mock client implementation
│   ├── testData.js            # Test fixtures
│   └── testUtils.js           # Utility functions
├── systems/
│   ├── cardSystem.test.js     # Card system unit tests
│   └── scoringSystem.test.js  # Scoring system unit tests
├── routes/
│   └── matchCardRules.test.js # API route tests
└── integration/
    └── quizRoom.test.js       # QuizRoom integration tests
```

## Test Coverage

### ✅ Card System (`cardSystem.test.js`)

**Rule Management:**
- Initialize empty rules
- Disable/enable cards
- Set gold cost modifiers
- Clamp multipliers to valid range (0.5-2.0)
- Reset all rules
- Broadcast rule updates

**Card Casting:**
- Reject non-student casts
- Reject invalid card IDs
- Reject disabled cards
- Reject unlocked cards
- Reject insufficient gold
- Successfully cast standard cards
- Apply cost modifiers correctly
- Cast cosmetic cards without gold cost
- Create effects on cast

**Effect Management:**
- Check and remove expired effects
- Keep active effects

**Cost Calculation:**
- Calculate adjusted costs with modifiers
- Enforce minimum cost of 1

### ✅ Scoring System (`scoringSystem.test.js`)

**Initialization:**
- Initialize scoring state correctly

**XP Management:**
- Add XP to cache
- Accumulate XP for same player
- Reject invalid XP (null playerId, zero/negative amount)
- Flush XP and notify clients

**Answer Collection:**
- Collect answers from all teams
- Track writer and suggester IDs

**Round Winner:**
- Determine winner from evaluation scores
- Handle ties (first highest wins)

**Match Win Condition:**
- Detect match win when team reaches roundsToWin
- Continue match if no team reached roundsToWin
- Handle maxRounds limit

**Score Submission:**
- Reject invalid submissions (round not found, match over, missing scores, invalid values)
- Successfully submit scores
- Award round points to winner
- Broadcast ROUND_SCORE message
- Broadcast MATCH_OVER when match ends

**XP Awarding:**
- Award XP to round winner
- Award MVP bonus on match win

### ✅ Route Tests (`matchCardRules.test.js`)

**GET /api/match/cards:**
- Return all cards and current rules
- Return current disabled cards

**POST /api/match/cards/disable:**
- Disable a card
- Reject invalid cardId
- Reject missing cardId

**POST /api/match/cards/enable:**
- Enable a disabled card

**POST /api/match/cards/modify:**
- Set gold cost modifier
- Clamp multiplier to valid range
- Reject modifier for cosmetic cards

**POST /api/match/cards/reset:**
- Reset all card rules

### ✅ Integration Tests (`quizRoom.test.js`)

**System Integration:**
- Initialize cardSystem and scoringSystem
- Initialize scoring state via scoringSystem
- Initialize card rules via cardSystem

**Card System Integration:**
- Delegate castCard to cardSystem
- Respect disabled cards from cardSystem

**Scoring System Integration:**
- Delegate submitRoundScores to scoringSystem
- Delegate addXPToCache to scoringSystem

**Match Reset Integration:**
- Reset card rules via cardSystem
- Reset scoring state

**Effect Expiration Integration:**
- Delegate checkEffectExpiration to cardSystem

## Mock Objects

### MockRoom

Minimal QuizRoom implementation for testing:

```javascript
const mockRoom = new MockRoom();
mockRoom.state.teams.set('A', team);
mockRoom.broadcast('MESSAGE_TYPE', { data: 'value' });
const lastBroadcast = mockRoom.getLastBroadcast('MESSAGE_TYPE');
```

**Properties:**
- `state` - Room state (teams, gold, effects, roundState, etc.)
- `scores` - Scoring state
- `clients` - Array of connected clients
- `answers` - Map of round answers

**Methods:**
- `broadcast(type, message)` - Capture broadcasts
- `getLastBroadcast(type)` - Get last broadcast of type
- `getAllBroadcasts(type)` - Get all broadcasts of type
- `clearBroadcasts()` - Clear broadcast history

### MockClient

Minimal client implementation:

```javascript
const client = new MockClient({
  playerId: 'player_1',
  unlockedCards: ['SHAKE', 'BLUR'],
  role: 'student'
});
client.send('MESSAGE_TYPE', { data: 'value' });
const lastMessage = client.getLastMessage('MESSAGE_TYPE');
```

**Properties:**
- `sessionId` - Unique session ID
- `metadata` - Client metadata (role, playerId, unlockedCards, etc.)

**Methods:**
- `send(type, message)` - Capture sent messages
- `getLastMessage(type)` - Get last message of type
- `getAllMessages(type)` - Get all messages of type
- `clearMessages()` - Clear message history

## Test Utilities

### Helper Functions (`testUtils.js`)

```javascript
import { 
  waitFor, 
  createMockTeam, 
  createMockPlayerClient,
  setupMatchScenario,
  expectBroadcast,
  expectClientMessage
} from '../helpers/testUtils.js';

// Wait for condition
await waitFor(() => condition === true, 1000);

// Create mock team
const team = createMockTeam('A', { gold: 10 });

// Setup complete match scenario
const { teamA, teamB, clientA, clientB } = setupMatchScenario(room);

// Assert broadcasts
expectBroadcast(room, 'CARD_CAST', (msg) => msg.cardId === 'SHAKE');

// Assert client messages
expectClientMessage(client, 'ERROR', (msg) => msg.message.includes('disabled'));
```

## Writing New Tests

### Example: Testing a New Feature

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { CardSystem } from '../../server/systems/cardSystem.js';
import { MockRoom } from '../helpers/mockRoom.js';
import { MockClient } from '../helpers/mockClient.js';

describe('CardSystem - New Feature', () => {
  let mockRoom;
  let cardSystem;

  beforeEach(() => {
    mockRoom = new MockRoom();
    cardSystem = new CardSystem(mockRoom);
    cardSystem.initializeRules();
  });

  it('should do something new', () => {
    // Arrange
    const client = new MockClient({ playerId: 'player_1' });
    
    // Act
    cardSystem.someNewMethod(client, { data: 'value' });
    
    // Assert
    expect(something).toBe(expected);
  });
});
```

## Test Data Fixtures

Reusable test data in `__tests__/helpers/testData.js`:

- `TEST_CARDS` - Card definitions (SHAKE, BLUR, GOLD_RUSH, WRITER_SPOTLIGHT)
- `TEST_TEAMS` - Team configurations (TEAM_A, TEAM_B)
- `TEST_PLAYERS` - Player data (PLAYER_1, PLAYER_2, TEACHER)

## Coverage Goals

- **Unit Tests**: 80%+ coverage for systems
- **Integration Tests**: All critical paths covered
- **Route Tests**: All endpoints tested with success and error cases

## Continuous Integration

Tests should pass before merging:

```bash
npm test && npm run test:coverage
```

## Troubleshooting

### Tests fail with "Cannot find module"

Ensure you're using Node.js with ESM support and run:
```bash
npm install
```

### Mock not working

Check that mocks are properly imported and reset in `beforeEach`:
```javascript
beforeEach(() => {
  jest.clearAllMocks();
  // Reset state
});
```

### Async test issues

Use `async/await` or return promises:
```javascript
it('should handle async', async () => {
  await someAsyncOperation();
  expect(result).toBe(expected);
});
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Arrange-Act-Assert**: Structure tests clearly
3. **Descriptive Names**: Test names should describe what they test
4. **Mock External Dependencies**: Don't test database, network, etc.
5. **Test Edge Cases**: Include boundary conditions and error cases
6. **Keep Tests Fast**: Avoid unnecessary setup/teardown

## Next Steps

To expand test coverage:

1. Add tests for remaining routes (auth, shop, scoring)
2. Add tests for LobbyRoom
3. Add end-to-end tests for complete match flow
4. Add performance tests for high-load scenarios
5. Add tests for client-side components (if using React Testing Library)

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)


