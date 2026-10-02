/*
 * DESKTOP APP - starting up, and the guard against money coming back.
 *
 * Items 5, 6 and 7 are the important ones in this file. Commission tracking was
 * taken out of this app on 01/10/2026 because it is an operations tool and what
 * Jericho earns is not an operational fact. These tests exist so a future change
 * cannot quietly put it back.
 */
const { test, expect } = require('@playwright/test');
const app = require('./helpers/desktop');
const verify = require('./helpers/verify');

test.beforeEach(async () => { await verify.wipe(); });

test('@robot DeskItem01_app_opens_without_error', async ({ page }) => {
  const errors = await app.openApp(page);
  await expect(page.locator('#mainContent')).toBeVisible();
  expect(errors, 'the app logged errors while starting:\n' + errors.join('\n')).toEqual([]);
});

test('@robot DeskItem02_password_gate_opens_once_then_stays', async ({ page }) => {
  /* The site is public, so until the password is given nothing may be connected.
     Checking the gate is merely VISIBLE would pass even if the app had already
     signed in behind it, so check _fbReady too. */
  await page.goto('/.robot/index.test.html');
  await expect(page.locator('#lockScreen')).toBeVisible();
  expect(await page.evaluate(() => window._fbReady === true),
    'the app must not be connected while the gate is still up').toBe(false);

  await app.openApp(page);
  expect(await page.evaluate(() => window._fbReady === true)).toBe(true);
  await expect(page.locator('#lockScreen')).toBeHidden();

  // Once per device, not every visit.
  await page.reload();
  await page.waitForFunction(() => window._fbReady === true, null, { timeout: 60000 });
  await expect(page.locator('#lockScreen'),
    'the password was typed once already; a reload must not ask for it again').toBeHidden();
});

test('@robot DeskItem03_status_pill_says_online_when_connected', async ({ page }) => {
  await app.openApp(page);
  await app.addContact(page, { name: 'Pill Check ' + Date.now(), company: 'Test' });
  // The class is the app's own verdict; the words beside it may be reworded.
  await expect(page.locator('#syncStatus')).toHaveClass(/online/);
});

test('@robot DeskItem04_every_tab_opens_without_breaking', async ({ page }) => {
  const errors = await app.openApp(page);
  const tabs = ['leads', 'pipeline', 'contacts', 'tasks', 'commslog',
                'documents', 'prices', 'relationships', 'map', 'backup', 'dashboard'];
  for (const t of tabs) {
    await app.goToTab(page, t);
    const visible = await page.evaluate(() =>
      [...document.querySelectorAll('.content')].filter(e => e.style.display !== 'none').length);
    expect(visible, 'exactly one section should be showing after opening ' + t).toBe(1);
  }
  expect(errors.filter(e => !/apis\.google\.com/.test(e)),
    'opening the tabs logged errors:\n' + errors.join('\n')).toEqual([]);
});

/* ---------------- no money in this app ---------------- */

test('@robot DeskItem05_no_commissions_button_anywhere', async ({ page }) => {
  await app.openApp(page);
  const names = await app.tabNames(page);
  expect(names.join(' | '), 'the tab row must not offer Commissions').not.toMatch(/commission/i);

  // Not merely hidden: the section must not exist at all.
  expect(await page.evaluate(() => !!document.getElementById('commissions-section')),
    'the Commission Tracking section should have been deleted, not hidden').toBe(false);

  // And a stale link to it must not blank the app.
  await page.evaluate(() => showSection('commissions', document.querySelector('.nav button')));
  await expect(page.locator('#mainContent'),
    'a stale link to the removed tab should fall back to the dashboard').toBeVisible();
});

test('@robot DeskItem06_first_page_shows_no_money', async ({ page }) => {
  await app.openApp(page);
  /* Seed the kind of data that used to produce the figures, so this cannot pass
     merely because the app is empty. */
  await app.addContact(page, { name: 'Money Guard', company: 'Guard Co' });
  await app.goToTab(page, 'dashboard');
  const text = await page.locator('#mainContent').innerText();
  const money = text.match(/[$€£]\s?[\d,]+/g) || [];
  expect(money, 'the first page must show no money at all, found: ' + money.join(', ')).toEqual([]);
});

test('@robot DeskItem07_word_commission_not_on_first_page', async ({ page }) => {
  await app.openApp(page);
  await app.goToTab(page, 'dashboard');
  const text = await page.locator('#mainContent').innerText();
  expect(text, 'the word "commission" must not appear on the first page').not.toMatch(/commission/i);
});
