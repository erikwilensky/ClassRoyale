# Installing Test Dependencies

The test dependencies are already configured in `package.json`. To install them:

## Option 1: Using npm (if available)

```bash
npm install
```

This will install all dependencies including the test devDependencies:
- `@jest/globals` - Jest globals for ES modules
- `jest` - Testing framework
- `jest-environment-node` - Node.js test environment
- `supertest` - HTTP assertion library for route testing

## Option 2: Using package manager directly

If npm is not in your PATH, you may need to:

1. **Find Node.js installation:**
   - Windows: Usually in `C:\Program Files\nodejs\` or `C:\Users\<username>\AppData\Roaming\npm`
   - Check with: `where node` or `where npm`

2. **Add to PATH temporarily:**
   ```powershell
   $env:PATH += ";C:\Program Files\nodejs"
   npm install
   ```

3. **Or use full path:**
   ```powershell
   & "C:\Program Files\nodejs\npm.cmd" install
   ```

## Verify Installation

After installation, verify the test setup:

```bash
npm test
```

Or check if dependencies are installed:

```bash
npm list --depth=0
```

## Test Scripts Available

Once installed, you can use:

- `npm test` - Run all tests
- `npm run test:watch` - Watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run test:card` - Card system tests only
- `npm run test:scoring` - Scoring system tests only
- `npm run test:quizroom` - QuizRoom tests only
- `npm run test:routes` - Route tests only

## Troubleshooting

If you get "npm is not recognized":
1. Ensure Node.js is installed
2. Restart your terminal/IDE
3. Check Node.js installation: `node --version`
4. Try using `npx` if available: `npx jest`

