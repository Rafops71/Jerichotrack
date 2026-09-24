const { test, expect } = require('@playwright/test');
const app = require('./helpers/app');
const verify = require('./helpers/verify');

const cssVar = (page, name) =>
  page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test.beforeEach(async () => { await verify.wipe(); });

test('@robot Item43_colour_change_is_remembered', async ({ page }) => {
  await app.openApp(page);
  const before = await cssVar(page, '--c-primary');

  await page.click('.head-gear');
  await expect(page.locator('#lookSheet')).toHaveClass(/show/);
  await page.locator('#lookPresets .look-swatch').nth(1).click();   // Bright blue

  const after = await cssVar(page, '--c-primary');
  expect(after, 'the colour should have changed').not.toBe(before);

  // And it must survive closing the app.
  await page.reload();
  await page.waitForFunction(() => window._fbReady === true, null, { timeout: 20000 });
  expect(await cssVar(page, '--c-primary'), 'the choice was forgotten on reload').toBe(after);
});

test('@robot Item44_three_layouts_can_be_chosen', async ({ page }) => {
  await app.openApp(page);
  await page.click('.head-gear');

  for (const name of ['comfortable', 'wide', 'compact']) {
    await page.locator(`#lookLayouts .look-layout[data-l="${name}"]`).click();
    expect(await page.getAttribute('html', 'data-layout'), name + ' was not applied').toBe(name);
  }

  // Comfortable really is roomier, not just a label.
  await page.locator('#lookLayouts .look-layout[data-l="comfortable"]').click();
  const roomy = await cssVar(page, '--app-max');
  await page.locator('#lookLayouts .look-layout[data-l="compact"]').click();
  const tight = await cssVar(page, '--app-max');
  expect(parseInt(roomy)).toBeGreaterThan(parseInt(tight));
});

test('@robot Item45_reset_restores_the_original_look', async ({ page }) => {
  await app.openApp(page);
  const original = await cssVar(page, '--c-primary');

  await page.click('.head-gear');
  await page.locator('#lookPresets .look-swatch').nth(4).click();   // Aubergine
  await page.locator('#lookLayouts .look-layout[data-l="wide"]').click();
  expect(await cssVar(page, '--c-primary')).not.toBe(original);

  await page.click('[onclick="resetLook()"]');
  expect(await cssVar(page, '--c-primary')).toBe(original);
  expect(await page.getAttribute('html', 'data-layout')).toBe('compact');
});

test('@robot Item46_pale_colours_stay_readable', async ({ page }) => {
  await app.openApp(page);
  await page.click('.head-gear');

  // Drag the brightness to its palest setting.
  await page.locator('#lkLit').fill('70');
  await page.locator('#lkLit').dispatchEvent('input');

  const ink = await cssVar(page, '--c-on-primary');
  expect(ink.toLowerCase(), 'white text on a pale header would be unreadable').toBe('#12202e');

  // And the darkest setting must go back to light text.
  await page.locator('#lkLit').fill('16');
  await page.locator('#lkLit').dispatchEvent('input');
  expect((await cssVar(page, '--c-on-primary')).toLowerCase()).toBe('#ffffff');
});
