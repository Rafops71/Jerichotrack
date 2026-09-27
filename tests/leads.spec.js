const { test, expect } = require('@playwright/test');
const app = require('./helpers/app');
const verify = require('./helpers/verify');

test.beforeEach(async () => { await verify.wipe(); });

test('@robot Item10_lead_saves_and_persists', async ({ page }) => {
  await app.openApp(page);
  const name = 'Robot Lead ' + Date.now();
  await app.addLead(page, { name, company: 'Sandbox Metals', note: 'copper cathode' });
  const saved = await verify.waitFor('jericho_leads', d => d.name === name, { label: name });
  expect(saved.company).toBe('Sandbox Metals');
  expect(saved.notes).toBe('copper cathode');
});

test('@robot Item11_duplicate_lead_is_flagged_not_silently_duplicated', async ({ page }) => {
  await app.openApp(page);
  const name = 'Duplicate Person';
  await app.addLead(page, { name, company: 'Same Co' });
  await verify.waitFor('jericho_leads', d => d.name === name, { label: name });
  await app.addLead(page, { name, company: 'Same Co' });
  await page.waitForTimeout(2000);

  const all = await verify.readCollection('jericho_leads');
  const copies = all.filter(d => d.name === name);
  expect(copies.length,
    'Adding the same person twice through Quick Add Lead produced ' + copies.length +
    ' separate records with no warning. The app has duplicate detection ' +
    '(findExistingLead) but Quick Add Lead never calls it.').toBe(1);
});

/*
 * The trap from Rafael's original handoff: picking the "New Lead" tag on Add
 * Action wrote a task labelled "New Lead" and created no lead at all. It looked
 * like a contact had been captured when nothing had.
 */
test('@robot Item50_new_lead_tag_really_adds_a_lead', async ({ page }) => {
  await app.openApp(page);

  await app.tap(page, 'openActionSheet()');
  await page.fill('#actionTitle', 'Pieter at Meridian Metals');
  await page.fill('#actionNote', 'manganese, met at conference');
  await page.locator('#actionTagPicker .tag-opt[data-tag="New Lead"]').click();

  // It must take me to the lead sheet, carrying what I already typed.
  await expect(page.locator('#leadSheet')).toHaveClass(/show/);
  await expect(page.locator('#actionSheet')).not.toHaveClass(/show/);
  await expect(page.locator('#qlName')).toHaveValue('Pieter at Meridian Metals');
  await expect(page.locator('#qlNote')).toHaveValue('manganese, met at conference');

  await app.tap(page, 'saveQuickLead()');

  const lead = await verify.waitFor('jericho_leads', d => /Pieter/.test(d.name || ''),
    { label: 'a real lead' });
  expect(lead.name).toBe('Pieter at Meridian Metals');

  // And crucially: no task was created pretending to be one.
  expect(await verify.readCollection('jericho_tasks'),
    'a task was created instead of, or as well as, the lead').toHaveLength(0);
});
