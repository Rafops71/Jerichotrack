const { test, expect } = require('@playwright/test');
const app = require('./helpers/app');
const verify = require('./helpers/verify');

/* Pipeline deals are created in JerichoTrack on the desktop, not in Companion.
   Companion's job is to receive and display them, so the robot seeds the
   sandbox directly and then checks what the app shows. */

const STAGES = ['New', 'Waiting Documents', 'Waiting Financials', 'Negotiation',
                'Final SPA', 'Closed Won', 'Closed Not Monetized', 'Lost'];

test.beforeEach(async () => { await verify.wipe(); });

test('@robot Item23_deals_appear_under_the_right_stage', async ({ page }) => {
  await verify.seed('jericho_pipeline', 'deal1',
    { id: 1, commodity: 'Copper Cathode', buyer: 'Antwerp Metals', stage: 'Negotiation' });
  await app.openApp(page);
  await app.goToScreen(page, 'pipeline');
  const row = page.locator('.pipe-row', { hasText: 'Copper Cathode' }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(row).toContainText('Negotiation');
});

test('@robot Item24_all_eight_stages_exist_and_are_spelled_right', async ({ page }) => {
  await app.openApp(page);
  const known = await page.evaluate(() => {
    const src = document.documentElement.innerHTML;
    const m = src.match(/ALLOWED_STAGES_CLIENT\s*=\s*(\[[^\]]*\])/);
    return m ? JSON.parse(m[1]) : null;
  });
  expect(known, 'the app no longer declares its list of stages').not.toBeNull();
  expect(known).toEqual(STAGES);
});

test('@robot Item25_same_deal_is_not_listed_twice', async ({ page }) => {
  await verify.seed('jericho_pipeline', 'dup1',
    { id: 7, commodity: 'Manganese Ore', buyer: 'Buyer A', stage: 'New' });
  await app.openApp(page);
  await app.goToScreen(page, 'pipeline');
  await expect(page.locator('.pipe-row', { hasText: 'Manganese Ore' })).toHaveCount(1, { timeout: 10000 });
});
