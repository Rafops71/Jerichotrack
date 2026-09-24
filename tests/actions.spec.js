const { test, expect } = require('@playwright/test');
const app = require('./helpers/app');
const verify = require('./helpers/verify');

const ymd = d => d.toISOString().slice(0, 10);

test.beforeEach(async () => { await verify.wipe(); });

test('@robot Item17_action_saves_with_note_and_due_date', async ({ page }) => {
  await app.openApp(page);
  const title = 'Chase SGS report ' + Date.now();
  const due = ymd(new Date(Date.now() + 86400000));
  await app.addAction(page, { title, note: 'ask for the assay', date: due });
  const saved = await verify.waitFor('jericho_tasks', d => d.title === title, { label: title });
  expect(saved.notes).toBe('ask for the assay');
  expect(saved.due).toBe(due);
  expect(saved.completed).toBe(false);
});

test('@robot Item18_action_can_be_ticked_off', async ({ page }) => {
  await app.openApp(page);
  const title = 'Tick me ' + Date.now();
  await app.addAction(page, { title });
  await verify.waitFor('jericho_tasks', d => d.title === title);

  await app.goToScreen(page, 'followups');
  await page.locator('#fullFollowups button:has-text("Done")').first().click();
  const done = await verify.waitFor('jericho_tasks', d => d.title === title && d.completed === true,
    { label: title + ' marked completed' });
  expect(done.completed).toBe(true);
});

test('@robot Item19_action_can_be_deleted', async ({ page }) => {
  await app.openApp(page);
  const title = 'Delete me ' + Date.now();
  await app.addAction(page, { title });
  await verify.waitFor('jericho_tasks', d => d.title === title);

  await app.goToScreen(page, 'followups');
  await page.locator('#fullFollowups button:has-text("Delete")').first().click();

  const started = Date.now();
  let remaining = [];
  while (Date.now() - started < 10000) {
    remaining = await verify.readCollection('jericho_tasks');
    if (!remaining.some(d => d.title === title)) break;
    await new Promise(r => setTimeout(r, 250));
  }
  expect(remaining.some(d => d.title === title),
    'the deleted action is still in the database').toBe(false);
});

test('@robot Item20_completed_action_leaves_the_followup_list', async ({ page }) => {
  await app.openApp(page);
  const title = 'Vanish when done ' + Date.now();
  await app.addAction(page, { title });
  await verify.waitFor('jericho_tasks', d => d.title === title);

  await app.goToScreen(page, 'followups');
  await expect(page.locator('#fullFollowups')).toContainText(title);
  await page.locator('#fullFollowups button:has-text("Done")').first().click();
  await expect(page.locator('#fullFollowups')).not.toContainText(title, { timeout: 10000 });
});

test('@robot Item07_todays_followups_show_on_home', async ({ page }) => {
  await app.openApp(page);
  const title = 'Due today ' + Date.now();
  await app.addAction(page, { title, date: ymd(new Date()) });
  await verify.waitFor('jericho_tasks', d => d.title === title);
  await app.goToScreen(page, 'home');
  await expect(page.locator('#homeFollowups')).toContainText(title);
});

test('@robot Item08_overdue_today_and_undated_are_colour_coded', async ({ page }) => {
  await app.openApp(page);
  const stamp = Date.now();
  await app.addAction(page, { title: 'Overdue ' + stamp, date: ymd(new Date(Date.now() - 3 * 86400000)) });
  await app.addAction(page, { title: 'Today ' + stamp,   date: ymd(new Date()) });
  await app.addAction(page, { title: 'Undated ' + stamp });
  await verify.waitFor('jericho_tasks', d => d.title === 'Undated ' + stamp);

  await app.goToScreen(page, 'followups');
  const cls = async label => page.locator('.item-card', { hasText: label + ' ' + stamp })
    .first().getAttribute('class');
  expect(await cls('Overdue')).toContain('overdue');
  expect(await cls('Today')).toContain('today');
  expect(await cls('Undated')).toContain('nodate');
});
