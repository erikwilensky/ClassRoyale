# Testing Package

Comprehensive test suite for ClassRoyale server components.

## Structure

```
__tests__/
├── setup.js                    # Global test setup
├── helpers/
│   ├── mockRoom.js            # Mock QuizRoom for testing
│   ├── mockClient.js          # Mock client for testing
│   └── testData.js            # Test fixtures and data
├── systems/
│   ├── cardSystem.test.js     # Card system unit tests
│   └── scoringSystem.test.js  # Scoring system unit tests
└── routes/
    └── matchCardRules.test.js # Route integration tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:card      # Card system tests only
npm run test:scoring   # Scoring system tests only
npm run test:quizroom  # QuizRoom tests only
npm run test:routes    # Route tests only
```

## Test Coverage

### Card System Tests
- ✅ Rule management (disable/enable/modify/reset)
- ✅ Card casting validation
- ✅ Gold cost calculation with modifiers
- ✅ Effect creation and expiration
- ✅ Cosmetic vs standard card handling

### Scoring System Tests
- ✅ XP caching and flushing
- ✅ Answer collection
- ✅ Round winner determination
- ✅ Match win condition checking
- ✅ Score submission and validation
- ✅ XP awarding (round winner, match winner, MVP)

### Route Tests
- ✅ Match card rules API endpoints
- ✅ Authentication and authorization
- ✅ Input validation
- ✅ Error handling

## Writing New Tests

### Example: Testing a new card system feature

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { CardSystem } from '../../server/systems/cardSystem.js';
import { MockRoom } from '../helpers/mockRoom.js';

describe('CardSystem - New Feature', () => {
  let mockRoom;
  let cardSystem;

  beforeEach(() => {
    mockRoom = new MockRoom();
    cardSystem = new CardSystem(mockRoom);
    cardSystem.initializeRules();
  });

  it('should do something', () => {
    // Test implementation
    expect(true).toBe(true);
  });
});
```

## Mock Objects

### MockRoom
Provides a minimal QuizRoom implementation for testing:
- `state` - Room state (teams, gold, effects)
- `scores` - Scoring state
- `clients` - Connected clients
- `broadcast(type, message)` - Capture broadcasts
- `getLastBroadcast(type)` - Get last broadcast of type

### MockClient
Provides a minimal client implementation:
- `sessionId` - Unique session ID
- `metadata` - Client metadata (role, playerId, etc.)
- `send(type, message)` - Capture sent messages
- `getLastMessage(type)` - Get last message of type

## Test Data

See `__tests__/helpers/testData.js` for:
- `TEST_CARDS` - Card definitions
- `TEST_TEAMS` - Team configurations
- `TEST_PLAYERS` - Player data

## Coverage Goals

- **Unit Tests**: 80%+ coverage for systems
- **Integration Tests**: Critical paths covered
- **Route Tests**: All endpoints tested

## Continuous Integration

Tests should pass before merging:
```bash
npm test && npm run test:coverage
```

## Notes

- Tests use ES modules (`.js` extension)
- Jest configured for Node.js ESM support
- Mocks are isolated per test file
- Test data is reusable across test files


