// Jest configuration for ES modules
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/index.js',
    '!server/db/database.js',
    '!**/node_modules/**',
    '!**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  // Allow Jest to handle ES modules from client directory (only for client imports)
  moduleNameMapper: {
    '^(\\.{1,2}/.*client/.*)\\.js$': '$1'
  }
};

