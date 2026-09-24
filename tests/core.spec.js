const { test, expect } = require('@playwright/test');
const app = require('./helpers/app');
const verify = require('./helpers/verify');

test.beforeEach(async () => { await verify.wipe(); });

test('@robot Item01_app_opens_without_error', async ({ page }) => {
  const errors = await app.openApp(page);
  await expect(page.locator('#screen-home')).toBeVisible();
  expect(errors, 'the app logged errors while starting:\n' + errors.join('\n')).toEqual([]);
});

test('@robot Item02_connects_to_database_without_login', async ({ page }) => {
  await app.openApp(page);
  expect(await page.evaluate(() => window._fbReady === true)).toBe(true);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test('@robot Item03_status_pill_says_online_when_connected', async ({ page }) => {
  await app.openApp(page);
  await app.addNote(page, 'pill check ' + Date.now());   // any successful write sets the pill
  await expect(page.locator('.sync-pill')).toHaveClass(/online/);
});

test('@robot Item09_quick_tiles_open_the_right_sheet', async ({ page }) => {
  await app.openApp(page);
  const pairs = [
    ['openActionSheet()',  '#actionSheet',  'closeActionSheet()'],
    ['openLeadSheet()',    '#leadSheet',    'closeLeadSheet()'],
    ['openNoteSheet()',    '#noteSheet',    'closeNoteSheet()'],
    ['openMeetingSheet()', '#meetingSheet', 'closeMeetingSheet()'],
    ['openIngestSheet()',  '#ingestSheet',  'closeIngestSheet()']
  ];
  for (const [handler, sheet, closer] of pairs) {
    await app.tap(page, handler);
    await expect(page.locator(sheet), handler + ' should open ' + sheet).toHaveClass(/show/);
    // Close it with the sheet's own Cancel button, as a person would.
    await page.locator(`${sheet} [onclick="${closer}"]`).last().click();
    await expect(page.locator(sheet)).not.toHaveClass(/show/);
  }
});
