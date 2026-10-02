const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // One at a time: every test wipes the shared sandbox, so they must not overlap.
  workers: 1,
  fullyParallel: false,
  /*
   * One retry. Under a full run this sandbox occasionally starves a page of
   * the time it needs to sign in, and a random test fails with no app fault.
   * A retry does not change what is asserted - a genuine failure still fails
   * twice - and the report marks anything that only passed on the second
   * attempt as FLAKY rather than quietly calling it a pass.
   */
  retries: 1,
  // Generous, because a test that reloads signs in twice, and the sandbox
  // slows under a full run. A real failure still fails; this only stops the
  // clock being the thing that fails it.
  timeout: 150000,
  reporter: [['list'], ['json', { outputFile: '.robot/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:5055',
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
    /*
     * This container reaches the internet through an agent proxy. curl picks it
     * up from the environment but Chromium does not, so without this the test
     * browser silently has no internet: d3 and the world atlas never arrive and
     * the map tests time out after 45s, and the price worker never answers so the
     * live grid sits on "Loading..." forever. Both looked like app bugs.
     *
     * Left unset when there is no proxy, so CI is unaffected.
     */
    proxy: process.env.HTTPS_PROXY
      ? {
          server: process.env.HTTPS_PROXY,
          /*
           * The local test server and the Firebase emulator must NOT go through
           * the proxy. Without this bypass the proxy answered for
           * 127.0.0.1:5055 too, the page that came back was not the sandbox
           * build, and openApp's safety check correctly refused to run - all 46
           * tests stopped at "SAFETY STOP: not the sandbox build". That guard is
           * what stopped the robot testing something unknown, so leave it be.
           */
          bypass: '127.0.0.1,localhost,::1'
        }
      : undefined,
    actionTimeout: 10000
  },
  /*
   * Two apps, two shapes. Companion is a phone app and is tested phone-shaped;
   * index.html is the desktop CRM and is tested on a desktop window, because a
   * table that works at 390px wide and a table that works at 1440px are not the
   * same test. The desktop specs are named desktop-*.spec.js and nothing else
   * picks them up.
   *
   * NOTE for both: this is Chromium, not Safari. Safari-only bugs are not caught
   * here, on either app.
   */
  projects: [
    {
      name: 'companion',
      testIgnore: /desktop-.*\.spec\.js/,
      use: { ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium' }
    },
    {
      name: 'desktop',
      testMatch: /desktop-.*\.spec\.js/,
      use: { viewport: { width: 1440, height: 1000 }, browserName: 'chromium', defaultBrowserType: 'chromium' }
    }
  ],
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
