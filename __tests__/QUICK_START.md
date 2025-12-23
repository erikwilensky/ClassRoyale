# Quick Start - Running Tests

## Prerequisites

1. Node.js installed (v16+ recommended)
2. Dependencies installed: `npm install`

## Run Tests

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Run Specific Test Suites

```bash
# Card system tests only
npm run test:card

# Scoring system tests only
npm run test:scoring

# QuizRoom integration tests only
npm run test:quizroom

# Route tests only
npm run test:routes
```

## Expected Output

When tests pass, you should see:

```
PASS  __tests__/systems/cardSystem.test.js
PASS  __tests__/systems/scoringSystem.test.js
PASS  __tests__/routes/matchCardRules.test.js
PASS  __tests__/integration/quizRoom.test.js

Test Suites: 4 passed, 4 total
Tests:       60+ passed, 60+ total
```

## First Time Setup

If you haven't installed dependencies yet:

```bash
npm install
```

This installs:
- Jest testing framework
- Test utilities and mocks
- All required dev dependencies

## Common Issues

**"Cannot find module"**
- Run `npm install` first
- Ensure you're in the project root directory

**"npm is not recognized"**
- Install Node.js from nodejs.org
- Restart your terminal/IDE
- Check PATH includes Node.js

**Tests fail with import errors**
- Ensure `package.json` has `"type": "module"`
- Check Jest config in `jest.config.js`
- Verify ES module syntax in test files

## Next Steps

- Read `TESTING_GUIDE.md` for detailed documentation
- Check `__tests__/README.md` for test structure
- Write new tests following existing patterns


