const { test, expect } = require('@playwright/test');
const app = require('./helpers/app');
const verify = require('./helpers/verify');

/* The version stays on screen until the app is finished, so it must be
   visible on every screen and must never disagree with the file itself. */

test.beforeEach(async () => { await verify.wipe(); });

test('@robot Item47_version_is_always_visible_in_the_banner', async ({ page }) => {
  await app.openApp(page);
  const label = page.locator('#appVersion');

  await expect(label).toBeVisible();
  await expect(label).toHaveText(/^v\d+$/);

  // The banner is fixed, so it must still be there on every screen.
  for (const screen of ['followups', 'pipeline', 'notes', 'home']) {
    await app.goToScreen(page, screen);
    await expect(label, 'the version vanished on the ' + screen + ' screen').toBeVisible();
    await expect(label).toHaveText(/^v\d+$/);
  }
});

test('@robot Item48_shown_version_matches_the_file', async ({ page }) => {
  await app.openApp(page);
  const check = await page.evaluate(() => checkVersionLabel());
  expect(check, 'the file has no version comment to compare against').not.toBeNull();
  expect(check.agree,
    `the banner says ${check.bannerSays} but the file says ${check.fileSays}`).toBe(true);
  await expect(page.locator('#appVersion')).toHaveText(check.fileSays);
});
