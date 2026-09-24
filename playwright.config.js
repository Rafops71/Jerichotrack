const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // One at a time: every test wipes the shared sandbox, so they must not overlap.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 45000,
  reporter: [['list'], ['json', { outputFile: '.robot/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:5055',
    // Phone-shaped, because that is how Companion is really used.
    // NOTE: this is Chromium, not Safari. Safari-only bugs will not be caught here.
    ...devices['iPhone 13'],
    browserName: 'chromium',
    defaultBrowserType: 'chromium',
    // Use the Chromium already installed in this environment rather than
    // downloading a second copy.
    launchOptions: (() => {
      // In CI, Playwright installs its own browser and ROBOT_CHROME is empty,
      // so we must NOT pass an executablePath at all.
      const custom = process.env.ROBOT_CHROME !== undefined
        ? process.env.ROBOT_CHROME
        : '/opt/pw-browsers/chromium';
      return custom ? { executablePath: custom } : {};
    })(),
    ignoreHTTPSErrors: true,
    actionTimeout: 10000
  },
  webServer: [
    {
      command: 'node scripts/serve.js',
      url: 'http://127.0.0.1:5055/companion.html',
      reuseExistingServer: true,
      timeout: 20000
    },
    {
      // The REAL Intake worker, running locally. Only the AI provider behind
      // it is stood in for.
      command: 'node scripts/serve-worker.js',
      url: 'http://127.0.0.1:5057/',
      reuseExistingServer: true,
      timeout: 20000
    }
  ]
});
