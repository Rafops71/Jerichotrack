/*
 * DESKTOP APP - the first page, and contacts.
 *
 * The order of the first page is the point of items 8 to 11. Rafael asked for
 * "what needs me today" first and the counts underneath, so the test asserts the
 * ORDER, not merely that the pieces exist.
 */
const { test, expect } = require('@playwright/test');
const app = require('./helpers/desktop');
const verify = require('./helpers/verify');

test.beforeEach(async () => { await verify.wipe(); });

const yesterday = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};
const todayStr = () => new Date().toISOString().slice(0, 10);

test('@robot DeskItem08_first_page_leads_with_what_needs_me', async ({ page }) => {
  await app.openApp(page);
  const headings = await app.dashboardHeadings(page);
  expect(headings.length, 'the first page should have headings').toBeGreaterThan(2);
  expect(headings[0], 'the first heading must be the overdue work, not a summary').toMatch(/overdue/i);
  expect(headings[1], 'the second heading must be today').toMatch(/today/i);
});

test('@robot DeskItem09_overdue_listed_first_and_red', async ({ page }) => {
  await app.openApp(page);
  await app.addTask(page, { title: 'Chase the B/L release', due: yesterday(), priority: 'High' });
  await app.goToTab(page, 'dashboard');

  const row = page.locator('#dashOverdueBody tr').first();
  await expect(row).toContainText('Chase the B/L release');

  /* Red is the signal Rafael asked for. Read the colour the browser actually
     paints rather than trusting a class name. */
  const colour = await page.locator('#dashOverdueBody tr td').nth(2).evaluate(
    el => getComputedStyle(el).color);
  const [r, g, b] = colour.match(/\d+/g).map(Number);
  expect(r, 'the overdue date should be painted red, got ' + colour).toBeGreaterThan(150);
  expect(r).toBeGreaterThan(g + 40);
  expect(r).toBeGreaterThan(b + 40);
});

test('@robot DeskItem10_today_listed_under_overdue', async ({ page }) => {
  await app.openApp(page);
  await app.addTask(page, { title: 'Call Chidi about the LOI', due: todayStr() });
  await app.goToTab(page, 'dashboard');
  await expect(page.locator('#dashTodayBody')).toContainText('Call Chidi about the LOI');

  // Position, not just presence: today's table must sit below the overdue one.
  const [overdueY, todayY] = await page.evaluate(() => [
    document.getElementById('dashOverdueBody').getBoundingClientRect().top,
    document.getElementById('dashTodayBody').getBoundingClientRect().top
  ]);
  expect(todayY, "today's list must come after the overdue list").toBeGreaterThan(overdueY);
});

test('@robot DeskItem11_counts_sit_below_the_lists', async ({ page }) => {
  await app.openApp(page);
  await app.goToTab(page, 'dashboard');
  const [listY, cardsY] = await page.evaluate(() => [
    document.getElementById('dashTodayBody').getBoundingClientRect().top,
    document.querySelector('#mainContent .dashboard-grid').getBoundingClientRect().top
  ]);
  expect(cardsY, 'the count cards must be below the action lists, not above them').toBeGreaterThan(listY);
});

test('@robot DeskItem12_ticking_a_task_removes_it_from_the_first_page', async ({ page }) => {
  await app.openApp(page);
  await app.addTask(page, { title: 'Send the revised offer', due: yesterday() });
  await app.goToTab(page, 'dashboard');
  await expect(page.locator('#dashOverdueBody')).toContainText('Send the revised offer');

  await page.click('#dashOverdueBody .btn-complete');
  await page.waitForTimeout(400);
  await expect(page.locator('#dashOverdueBody'),
    'a completed task should leave the first page').not.toContainText('Send the revised offer');

  // And the database agrees it is done, not merely the screen.
  const saved = await verify.waitFor('jericho_tasks', rows => rows.some(r => r.completed === true),
    { label: 'the completed task' });
  expect(saved.find(r => r.title === 'Send the revised offer').completed).toBe(true);
});

/* ---------------- contacts ---------------- */

test('@robot DeskItem13_can_add_a_contact_and_it_stays', async ({ page }) => {
  await app.openApp(page);
  await app.addContact(page, { name: 'Chidi Okonkwo', company: 'Lagos Metals Ltd',
    city: 'Lagos', country: 'Nigeria', email: 'chidi@lagosmetals.com' });
  await expect(page.locator('#contactsBody')).toContainText('Chidi Okonkwo');

  await page.reload();
  await page.waitForFunction(() => window._fbReady === true, null, { timeout: 60000 });
  await app.goToTab(page, 'contacts');
  await expect(page.locator('#contactsBody'),
    'the contact should survive a reload').toContainText('Chidi Okonkwo');
});

test('@robot DeskItem14_a_saved_contact_reaches_the_database', async ({ page }) => {
  await app.openApp(page);
  await app.addContact(page, { name: 'Hans Gunther', company: 'Rheinstahl GmbH',
    email: 'hans@rheinstahl.de', phone: '+49 170 5550101' });

  /* The claim comes from the database itself, not from the app reporting on its
     own behaviour. */
  const rows = await verify.waitFor('jericho_contacts',
    r => r.some(c => c.name === 'Hans Gunther'), { label: 'the saved contact' });
  const saved = rows.find(c => c.name === 'Hans Gunther');
  expect(saved.company).toBe('Rheinstahl GmbH');
  expect(saved.email).toBe('hans@rheinstahl.de');
});

test('@robot DeskItem15_can_delete_a_contact_and_it_stays_deleted', async ({ page }) => {
  await app.openApp(page);
  await app.addContact(page, { name: 'Delete Me', company: 'Gone Ltd' });
  await verify.waitFor('jericho_contacts', r => r.some(c => c.name === 'Delete Me'));

  page.on('dialog', d => d.accept());
  await page.click('#contactsBody .btn-danger');
  await page.waitForTimeout(600);
  await expect(page.locator('#contactsBody')).not.toContainText('Delete Me');

  const rows = await verify.waitFor('jericho_contacts', r => !r.some(c => c.name === 'Delete Me'),
    { label: 'the contact to be gone from the database' });
  expect(rows.some(c => c.name === 'Delete Me')).toBe(false);
});
