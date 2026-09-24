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
