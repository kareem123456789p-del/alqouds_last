// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright E2E configuration for Al-Quds Medical ERP.
 * Boots app.js against the alquods_test_main database on port 3100.
 */
module.exports = defineConfig({
  testDir: './tests/e2e',
  globalSetup: require.resolve('./tests/e2e/global-setup.js'),
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
    headless: true,
    viewport: { width: 1280, height: 720 },
    locale: 'ar-EG',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'DEBUG_TESTS=1 PORT=3100 node -r ./tests/setup/env.js app.js',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
