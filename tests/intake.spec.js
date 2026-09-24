const { test, expect } = require('@playwright/test');
const app = require('./helpers/app');
const verify = require('./helpers/verify');

/*
 * IMPORTANT, AND NOT A DETAIL:
 * These tests point the app at a stand-in worker, because the real Intake
 * worker (jericho-ai-inbox) has never been built out. They prove THE APP'S
 * half of the conversation is correct. They prove nothing whatsoever about
 * the real worker, which needs its own tests once it exists.
 */
const STUB = mode => `http://127.0.0.1:5055/__stub-worker?mode=${mode}`;
const KEY = 'robot-test-key';

async function configure(page, mode) {
  await app.tap(page, 'openIngestSheet()');
  await page.fill('#ingestWorkerUrlInput', STUB(mode));
  await page.fill('#ingestAuthKeyInput', KEY);
  await app.tap(page, 'saveIngestWorkerUrl()');
}

async function process(page, text) {
  await page.fill('#ingestSourceText', text);
  await app.tap(page, 'processIngest()');
}

test.beforeEach(async () => { await verify.wipe(); });

test('@robot Item31_worker_settings_are_remembered', async ({ page }) => {
  await app.openApp(page);
  await configure(page, 'ok');
  await page.reload();
  await page.waitForFunction(() => window._fbReady === true, null, { timeout: 20000 });
  const saved = await page.evaluate(() => ({
    url: localStorage.getItem('jericho_ingest_worker_url'),
    key: localStorage.getItem('jericho_ingest_auth_key')
  }));
  expect(saved.url).toBe(STUB('ok'));
  expect(saved.key).toBe(KEY);
});

test('@robot Item32_pasted_text_is_sent_for_processing', async ({ page }) => {
  await app.openApp(page);
  await configure(page, 'ok');
  const sent = page.waitForRequest(r => r.url().includes('__stub-worker') && r.method() === 'POST');
  await process(page, 'met Johan from Antwerp Metals about copper cathode');
  const req = await sent;
  expect(JSON.parse(req.postData()).text).toContain('Antwerp Metals');
  expect(req.headers()['x-api-key']).toBe(KEY);
});

test('@robot Item33_review_cards_appear_and_are_editable', async ({ page }) => {
  await app.openApp(page);
  await configure(page, 'ok');
  await process(page, 'met Johan from Antwerp Metals');
  await expect(page.locator('#ingestReviewList .review-card').first()).toBeVisible({ timeout: 15000 });
  const nameField = page.locator('.review-card .edit-name').first();
  await expect(nameField).toHaveValue('Johan Vermeulen');
  await nameField.fill('Johan V. Edited');
  await expect(nameField).toHaveValue('Johan V. Edited');
});

test('@robot Item34_NOTHING_is_saved_before_confirm', async ({ page }) => {
  await app.openApp(page);
  await configure(page, 'ok');
  await process(page, 'met Johan from Antwerp Metals');
  await expect(page.locator('#ingestReviewList .review-card').first()).toBeVisible({ timeout: 15000 });

  // The cards are on screen. Nothing may have reached the database yet.
  await verify.stayedEmpty('jericho_leads', 3000);
  await verify.stayedEmpty('jericho_tasks', 500);
});

test('@robot Item35_confirm_really_saves_the_items', async ({ page }) => {
  await app.openApp(page);
  await configure(page, 'ok');
  await process(page, 'met Johan from Antwerp Metals');
  await expect(page.locator('#ingestReviewList .review-card').first()).toBeVisible({ timeout: 15000 });
  await app.tap(page, 'confirmAndSaveIngest()');

  const lead = await verify.waitFor('jericho_leads', d => /Johan/.test(d.name || ''),
    { label: 'the confirmed lead', timeoutMs: 15000 });
  expect(lead.company).toBe('Antwerp Metals');
});

test('@robot Item36_closing_without_confirming_saves_nothing', async ({ page }) => {
  await app.openApp(page);
  await configure(page, 'ok');
  await process(page, 'met Johan from Antwerp Metals');
  await expect(page.locator('#ingestReviewList .review-card').first()).toBeVisible({ timeout: 15000 });
  await app.tap(page, 'closeIngestReviewSheet()');
  await verify.stayedEmpty('jericho_leads', 3000);
});

test('@robot Item37_failures_are_explained_and_my_text_is_kept', async ({ page }) => {
  await app.openApp(page);
  const cases = [
    ['unauthorized', /key|unauthor/i],
    ['servererror',  /status|went wrong|500/i],
    ['truncated',    /cut off|shorter/i],
    ['parsefailed',  /could not be read|structured/i],
    ['badshape',     /unexpected/i]
  ];
  for (const [mode, expected] of cases) {
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload();
    await page.waitForFunction(() => window._fbReady === true, null, { timeout: 20000 });
    await configure(page, mode);
    const myText = 'important text for ' + mode;
    await process(page, myText);

    const panel = page.locator('#ingestReviewList');
    await expect(panel, `mode "${mode}" should explain itself`).toContainText(expected, { timeout: 15000 });
    await expect(panel, `mode "${mode}" should keep my original text`).toContainText(myText);
    await verify.stayedEmpty('jericho_leads', 500);
  }
});
