const { test, expect } = require('@playwright/test');
const app = require('./helpers/app');
const verify = require('./helpers/verify');

/*
 * The speech engine cannot be driven here, but the correction list is a plain
 * function, so what it does to the words IS testable - and that is the part
 * that keeps getting Rafael's commodities wrong.
 */
const correct = (page, text) => page.evaluate(t => applyDictationDictionary(t), text);

test.beforeEach(async () => { await verify.wipe(); });

test('@robot Item28_known_mishearings_are_corrected', async ({ page }) => {
  await app.openApp(page);

  // Reported from real dictation, 26 September 2026.
  expect(await correct(page, 'we need 500 mt copper kettles from Chile'))
    .toContain('copper cathodes');
  expect(await correct(page, 'one copper kettle sample')).toContain('copper cathode');
  expect(await correct(page, 'he offered steel delights at 620')).toContain('steel billets');
  expect(await correct(page, 'a single steel delight')).toContain('steel billet');

  // Older entries must still work.
  expect(await correct(page, 'send me the essay results')).toContain('assay');
  expect(await correct(page, 'his indicative bit was low')).toContain('indicative bid');

  // And it must not damage ordinary words. A kettle with no copper in front of
  // it is just a kettle.
  const innocent = 'I put the kettle on and it was a delight';
  expect(await correct(page, innocent)).toBe(innocent);
});

test('@robot Item49_i_can_add_my_own_corrections', async ({ page }) => {
  await app.openApp(page);

  // Before: the app has never heard of this one.
  expect(await correct(page, 'ten tonnes of manga knees ore')).toContain('manga knees');

  await page.click('.head-gear');
  await page.fill('#dictHeard', 'manga knees');
  await page.fill('#dictMeant', 'manganese');
  await page.click('[onclick="addDictWord()"]');
  await expect(page.locator('#dictWordList')).toContainText('manganese');

  expect(await correct(page, 'ten tonnes of manga knees ore')).toContain('manganese');

  // It must survive closing the app.
  await page.reload();
  await page.waitForFunction(() => window._fbReady === true, null, { timeout: 60000 });
  expect(await correct(page, 'ten tonnes of manga knees ore'),
    'my correction was forgotten on reload').toContain('manganese');

  // And I can take it away again.
  await page.click('.head-gear');
  await page.click('#dictWordList button');
  await expect(page.locator('#dictWordList')).toContainText('None yet');
  expect(await correct(page, 'ten tonnes of manga knees ore')).toContain('manga knees');
});
