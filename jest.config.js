'use strict';

/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/e2e/'],

  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/afterEnv.js'],

  // The suite shares one PostgreSQL database; deterministic serial execution
  // is worth more than parallel speed here.
  maxWorkers: 1,
  testTimeout: 30000,
  forceExit: true,

  // Coverage must account for every production source file. AQE and the gate
  // reject reports that silently omit controllers/routes/middleware.
  collectCoverageFrom: [
    'app.js',
    'db.js',
    'config/**/*.js',
    'middleware/**/*.js',
    'controllers/**/*.js',
    'routes/**/*.js',
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],

  clearMocks: true,
  verbose: false,
};
