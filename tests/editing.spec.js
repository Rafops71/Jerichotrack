const { test, expect } = require('@playwright/test');
const app = require('./helpers/app');
const verify = require('./helpers/verify');

const ymd = d => d.toISOString().slice(0, 10);
const FUTURE = ymd(new Date(Date.now() + 7 * 86400000));

test.beforeEach(async () => { await verify.wipe(); });

test('@robot Item38_can_change_a_saved_followup', async ({ page }) => {
  await app.openApp(page);
  const title = 'Chase assay ' + Date.now();
  await app.addAction(page, { title, note: 'original note' });
  const before = await verify.waitFor('jericho_tasks', d => d.title === title);

  await app.goToScreen(page, 'followups');
  await page.locator('#fullFollowups button:has-text("Edit")').first().click();

  // The sheet must come back filled in, not blank.
  await expect(page.locator('#actionTitle')).toHaveValue(title);
  await expect(page.locator('#actionNote')).toHaveValue('original note');

  await page.fill('#actionTitle', title + ' (moved)');
  await page.fill('#actionDate', FUTURE);
  await app.tap(page, 'saveAction()');

  const after = await verify.waitFor('jericho_tasks', d => d.title === title + ' (moved)',
    { label: 'the edited follow-up' });
  expect(after.due).toBe(FUTURE);
  expect(after._id, 'editing must change the record, not create a second one').toBe(before._id);
  expect(await verify.readCollection('jericho_tasks')).toHaveLength(1);
});

test('@robot Item39_can_change_a_saved_call', async ({ page }) => {
  await app.openApp(page);
  await app.tap(page, 'openMeetingSheet()');
  await page.fill('#meetingDate', FUTURE);
  await page.fill('#meetingTime', '15:00');
  await page.locator('#myQuickLocs .quick-loc[data-country="Belgium"]').click();
  await app.tap(page, 'saveMeeting()');
  const before = await verify.waitFor('jericho_meetings', d => d.time === '15:00');

  await app.goToScreen(page, 'home');
  await page.locator('.upcoming-row').first().click();
  await expect(page.locator('#meetingTime')).toHaveValue('15:00');

  await page.fill('#meetingTime', '17:30');
  await app.tap(page, 'saveMeeting()');

  const after = await verify.waitFor('jericho_meetings', d => d.time === '17:30',
    { label: 'the rescheduled call' });
  expect(after._id, 'rescheduling must not create a second call').toBe(before._id);
  expect(await verify.readCollection('jericho_meetings')).toHaveLength(1);
});

test('@robot Item40_can_cancel_a_call', async ({ page }) => {
  await app.openApp(page);
  await app.tap(page, 'openMeetingSheet()');
  await page.fill('#meetingDate', FUTURE);
  await page.fill('#meetingTime', '11:00');
  await page.locator('#myQuickLocs .quick-loc[data-country="Belgium"]').click();
  await app.tap(page, 'saveMeeting()');
  await verify.waitFor('jericho_meetings', d => d.time === '11:00');

  await app.goToScreen(page, 'home');
  await page.locator('.upcoming-row').first().click();

  const cancelBtn = page.locator('#meetingCancelCallBtn');
  await expect(cancelBtn).toBeVisible();
  await cancelBtn.click();                       // first tap - warns only
  await expect(cancelBtn).toHaveText('Sure?');
  expect(await verify.readCollection('jericho_meetings'), 'one tap must not cancel').toHaveLength(1);

  await cancelBtn.click();                       // second tap - really cancels
  const started = Date.now();
  let left = [];
  while (Date.now() - started < 10000) {
    left = await verify.readCollection('jericho_meetings');
    if (!left.length) break;
    await new Promise(r => setTimeout(r, 250));
  }
  expect(left).toHaveLength(0);
});

test('@robot Item41_deleting_takes_two_taps', async ({ page }) => {
  await app.openApp(page);
  const title = 'Do not delete me by accident ' + Date.now();
  await app.addAction(page, { title });
  await verify.waitFor('jericho_tasks', d => d.title === title);

  await app.goToScreen(page, 'followups');
  const del = page.locator('#fullFollowups button.btn-del').first();

  await del.click();                              // one stray tap
  await expect(del).toHaveText('Sure?');
  await page.waitForTimeout(1500);
  expect(await verify.readCollection('jericho_tasks'),
    'a single tap must never delete anything').toHaveLength(1);

  await del.click();                              // deliberate second tap
  const started = Date.now();
  let left = [];
  while (Date.now() - started < 10000) {
    left = await verify.readCollection('jericho_tasks');
    if (!left.length) break;
    await new Promise(r => setTimeout(r, 250));
  }
  expect(left).toHaveLength(0);
});

test('@robot Item42_can_move_a_deal_to_another_stage', async ({ page }) => {
  await verify.seed('jericho_pipeline', 'deal42',
    { id: 'deal42', commodity: 'Copper Cathode', buyer: 'Antwerp Metals', stage: 'New' });
  await app.openApp(page);
  await app.goToScreen(page, 'pipeline');

  await page.locator('.pipe-row', { hasText: 'Copper Cathode' }).first().click();
  await expect(page.locator('#stageSheet')).toHaveClass(/show/);
  await expect(page.locator('#stageSheetTitle')).toContainText('Copper Cathode');

  // The stage it is on now must be marked, and all eight must be offered.
  await expect(page.locator('.stage-opt')).toHaveCount(8);
  await expect(page.locator('.stage-opt.current')).toContainText('New');

  await page.locator('.stage-opt', { hasText: 'Negotiation' }).click();

  const moved = await verify.waitFor('jericho_pipeline',
    d => d._id === 'deal42' && d.stage === 'Negotiation',
    { label: 'the deal moved to Negotiation' });
  expect(moved.stage).toBe('Negotiation');
  await expect(page.locator('.pipe-row', { hasText: 'Copper Cathode' })).toContainText('Negotiation');
});
