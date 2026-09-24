const { test, expect } = require('@playwright/test');
const app = require('./helpers/app');
const verify = require('./helpers/verify');

/*
 * These drive the real app through the REAL Intake worker
 * (worker/intake-worker-v1.js), running locally.
 *
 * The only thing stood in for is the AI provider itself, which is replaced by
 * a local stub so each failure mode can be produced on demand. The stub
 * deliberately gift-wraps its JSON in a bare "JSON" label AND a code fence,
 * so the worker's unwrapping is exercised for real every single run.
 *
 * What this still does NOT prove: that a real AI, on real notes, extracts the
 * right things. That needs a live test once the worker is deployed.
 */
const WORKER = ai => `http://127.0.0.1:5056/?ai=${ai}`;
const KEY = 'robot-test-key';

async function configure(page, ai, key = KEY) {
  await app.tap(page, 'openIngestSheet()');
  await page.fill('#ingestWorkerUrlInput', WORKER(ai));
  await page.fill('#ingestAuthKeyInput', key);
  await app.tap(page, 'saveIngestWorkerUrl()');
}

async function process(page, text) {
  await page.fill('#ingestSourceText', text);
  await app.tap(page, 'processIngest()');
}

const NOTES = 'met Johan Vermeulen from Antwerp Metals, 500 mt copper cathode from Chile, send him a quote';

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
  expect(saved.url).toBe(WORKER('ok'));
  expect(saved.key).toBe(KEY);
});

test('@robot Item32_pasted_text_is_sent_for_processing', async ({ page }) => {
  await app.openApp(page);
  await configure(page, 'ok');
  const sent = page.waitForRequest(r => r.url().includes('5056') && r.method() === 'POST');
  await process(page, NOTES);
  const req = await sent;
  expect(JSON.parse(req.postData()).text).toContain('Antwerp Metals');
  expect(req.headers()['x-api-key']).toBe(KEY);
});

test('@robot Item33_review_cards_appear_and_are_editable', async ({ page }) => {
  await app.openApp(page);
  await configure(page, 'ok');
  await process(page, NOTES);
  await expect(page.locator('#ingestReviewList .review-card').first()).toBeVisible({ timeout: 15000 });

  // A lead, a task and a deal all came back and all rendered.
  await expect(page.locator('.review-card[data-type="leads"]')).toHaveCount(1);
  await expect(page.locator('.review-card[data-type="tasks"]')).toHaveCount(1);
  await expect(page.locator('.review-card[data-type="pipeline"]')).toHaveCount(1);

  // The AI claimed a stage that does not exist; the worker must have corrected it.
  await expect(page.locator('.review-card[data-type="pipeline"] .edit-stage')).toHaveValue('New');

  const nameField = page.locator('.review-card .edit-name').first();
  await expect(nameField).toHaveValue('Johan Vermeulen');
  await nameField.fill('Johan V. Edited');
  await expect(nameField).toHaveValue('Johan V. Edited');
});

test('@robot Item34_NOTHING_is_saved_before_confirm', async ({ page }) => {
  await app.openApp(page);
  await configure(page, 'ok');
  await process(page, NOTES);
  await expect(page.locator('#ingestReviewList .review-card').first()).toBeVisible({ timeout: 15000 });
  await verify.stayedEmpty('jericho_leads', 3000);
  await verify.stayedEmpty('jericho_tasks', 500);
  await verify.stayedEmpty('jericho_pipeline', 500);
});

test('@robot Item35_confirm_really_saves_the_items', async ({ page }) => {
  await app.openApp(page);
  await configure(page, 'ok');
  await process(page, NOTES);
  await expect(page.locator('#ingestReviewList .review-card').first()).toBeVisible({ timeout: 15000 });
  await app.tap(page, 'confirmAndSaveIngest()');

  const lead = await verify.waitFor('jericho_leads', d => /Johan/.test(d.name || ''),
    { label: 'the confirmed lead', timeoutMs: 15000 });
  expect(lead.company).toBe('Antwerp Metals');
  await verify.waitFor('jericho_tasks', d => /copper quote/i.test(d.title || ''),
    { label: 'the confirmed task', timeoutMs: 15000 });
});

test('@robot Item36_closing_without_confirming_saves_nothing', async ({ page }) => {
  await app.openApp(page);
  await configure(page, 'ok');
  await process(page, NOTES);
  await expect(page.locator('#ingestReviewList .review-card').first()).toBeVisible({ timeout: 15000 });
  await app.tap(page, 'closeIngestReviewSheet()');
  await verify.stayedEmpty('jericho_leads', 3000);
});

test('@robot Item37_failures_are_explained_and_my_text_is_kept', async ({ page }) => {
  await app.openApp(page);
  const cases = [
    // [ai mode, key to use, what the message must mention]
    ['ok',        'WRONG-KEY', /key|unauthor/i],       // worker rejects us
    ['ratelimit', KEY,         /rate.?limit/i],        // free plan exhausted
    ['cutoff',    KEY,         /cut off|shorter/i],    // answer ran out of room
    ['garbage',   KEY,         /could not be read|structured/i],
    ['badmodel',  KEY,         /error|decommission/i]  // model name retired
  ];
  for (const [ai, key, expected] of cases) {
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload();
    await page.waitForFunction(() => window._fbReady === true, null, { timeout: 20000 });
    await configure(page, ai, key);
    const myText = 'important text for ' + ai;
    await process(page, myText);

    const panel = page.locator('#ingestReviewList');
    await expect(panel, `"${ai}" should explain itself in plain English`).toContainText(expected, { timeout: 15000 });
    await expect(panel, `"${ai}" should keep my original text`).toContainText(myText);
    await verify.stayedEmpty('jericho_leads', 500);
  }
});
