const { test, expect } = require('@playwright/test');
const app = require('./helpers/app');
const verify = require('./helpers/verify');

test.beforeEach(async () => { await verify.wipe(); });

test('@robot Item04_saved_on_one_device_appears_on_another', async ({ browser }) => {
  // Two independent browser sessions = two devices sharing one database.
  const phone = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext()).newPage();
  await app.openApp(phone);
  await app.openApp(tablet);

  const text = 'Typed on the phone ' + Date.now();
  await app.addNote(phone, text);

  await app.goToScreen(tablet, 'notes');
  await expect(tablet.locator('#notesList')).toContainText(text, { timeout: 15000 });
});

test('@robot Item05_works_offline_and_catches_up_later', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await app.openApp(page);

  // Go into a basement.
  await ctx.setOffline(true);
  const text = 'Written with no signal ' + Date.now();
  await app.addNote(page, text);

  // It must still be usable, and the note must be on screen.
  await app.goToScreen(page, 'notes');
  await expect(page.locator('#notesList')).toContainText(text);
  await verify.stayedEmpty('jericho_companion_notes', 1500);   // nothing reached the cloud yet

  // Come back into signal.
  await ctx.setOffline(false);
  const caught = await verify.waitFor('jericho_companion_notes', d => d.text === text,
    { timeoutMs: 20000, label: 'the note written while offline' });
  expect(caught.text).toBe(text);
});
