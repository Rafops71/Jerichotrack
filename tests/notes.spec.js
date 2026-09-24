const { test, expect } = require('@playwright/test');
const app = require('./helpers/app');
const verify = require('./helpers/verify');

test.beforeEach(async () => { await verify.wipe(); });

test('@robot Item21_quick_note_saves', async ({ page }) => {
  await app.openApp(page);
  const text = 'Robot note ' + Date.now();
  await app.addNote(page, text);
  const saved = await verify.waitFor('jericho_companion_notes', d => d.text === text, { label: text });
  expect(saved.text).toBe(text);
});

test('@robot Item22_note_can_be_deleted', async ({ page }) => {
  await app.openApp(page);
  const text = 'Delete this note ' + Date.now();
  await app.addNote(page, text);
  await verify.waitFor('jericho_companion_notes', d => d.text === text);

  await app.goToScreen(page, 'notes');
  await page.locator('#notesList button:has-text("Delete")').first().click();

  const started = Date.now();
  let remaining = [];
  while (Date.now() - started < 10000) {
    remaining = await verify.readCollection('jericho_companion_notes');
    if (!remaining.some(d => d.text === text)) break;
    await new Promise(r => setTimeout(r, 250));
  }
  expect(remaining.some(d => d.text === text), 'the deleted note is still in the database').toBe(false);
});
