/*
 * DESKTOP APP - the Find Duplicates review screen.
 *
 * The screen only ever PROPOSES. Item 28 is the one that matters: nothing may be
 * merged until Rafael presses Merge on that pair, so the test proves the pair is
 * still intact while the screen is open.
 */
const { test, expect } = require('@playwright/test');
const app = require('./helpers/desktop');
const verify = require('./helpers/verify');

test.beforeEach(async () => { await verify.wipe(); });

/*
 * Two records of the same man, seeded straight into the database so the test is
 * about the finder rather than about the importer. The fuller one carries trust,
 * KYC and a commodity; the thinner one carries an email and a role the fuller
 * one lacks, so a correct merge has to take something from each.
 */
async function seedSameManTwice() {
  await verify.seed('jericho_contacts', '900001', {
    id: 900001, name: 'Ahmet Yilmaz', company: 'Yilmaz Demir Celik AS',
    type: '', city: 'Iskenderun', country: 'Turkey', phone: '0090 532 555 0143',
    email: '', commodity: 'HMS 1&2', introBy: '', trust: 'Green', kyc: 'Full KYC',
    followup: '', linkedin: '', notes: 'Reliable, pays on time', date: '01/10/2026'
  });
  await verify.seed('jericho_contacts', '900002', {
    id: 900002, name: 'Ahmet Yilmaz', company: 'Yilmaz Demir Celik, A.S.',
    type: 'Purchasing Manager', city: 'Iskenderun', country: 'Turkey',
    phone: '+90 532 555 0143', email: 'ahmet@yilmazdemir.com.tr', commodity: '',
    introBy: '', trust: 'Unknown', kyc: 'No KYC', followup: '', linkedin: '',
    notes: '', date: '01/10/2026'
  });
}

test('@robot DeskItem26_find_duplicates_shows_pairs_that_look_the_same', async ({ page }) => {
  await seedSameManTwice();
  await app.openApp(page);
  await app.openDuplicateFinder(page);

  await expect(page.locator('#dupeBox')).toBeVisible();
  await expect(page.locator('.dup-pair'), 'the seeded pair should be offered').toHaveCount(1);
  await expect(page.locator('.dup-pair')).toContainText('Ahmet Yilmaz');
});

test('@robot DeskItem27_it_says_why_in_plain_words', async ({ page }) => {
  await seedSameManTwice();
  await app.openApp(page);
  await app.openDuplicateFinder(page);

  const why = (await page.locator('.dup-why').first().innerText()).toLowerCase();
  /* A reason Rafael can read back, not a score or a code. */
  expect(why, 'the reason should name what actually matched, got: ' + why)
    .toMatch(/same (phone|name|email)/);
  expect(why, 'the reason must not be a number or a code').not.toMatch(/0\.\d|score|confidence/);
});

test('@robot DeskItem28_nothing_merges_until_i_press_merge', async ({ page }) => {
  await seedSameManTwice();
  await app.openApp(page);
  await app.openDuplicateFinder(page);
  await expect(page.locator('.dup-pair')).toHaveCount(1);

  /* The screen is open and showing a proposal. Both records must still be there. */
  await page.waitForTimeout(1500);
  const rows = await verify.readCollection('jericho_contacts');
  expect(rows.length, 'merely opening the screen must not merge anybody').toBe(2);

  // Closing it without pressing Merge must also change nothing.
  await page.click('[onclick="hideDupes()"]');
  await page.waitForTimeout(800);
  expect((await verify.readCollection('jericho_contacts')).length).toBe(2);
});

test('@robot DeskItem29_merging_keeps_the_fuller_record_and_loses_nothing', async ({ page }) => {
  await seedSameManTwice();
  await app.openApp(page);
  await app.openDuplicateFinder(page);
  await page.click('.dup-pair .btn-success');
  await page.waitForTimeout(1200);

  const rows = await verify.readCollection('jericho_contacts');
  expect(rows.length, 'after merging there should be one contact').toBe(1);
  const kept = rows[0];

  // What the fuller record had is kept.
  expect(kept.trust).toBe('Green');
  expect(kept.kyc).toBe('Full KYC');
  expect(kept.commodity).toBe('HMS 1&2');
  expect(kept.notes).toContain('Reliable, pays on time');

  // What only the other record had is absorbed, not lost.
  expect(kept.email, 'the email only the thinner record had must survive')
    .toBe('ahmet@yilmazdemir.com.tr');
  expect(kept.type, 'the role only the thinner record had must survive')
    .toBe('Purchasing Manager');
});

test('@robot DeskItem30_not_the_same_person_is_remembered', async ({ page }) => {
  await seedSameManTwice();
  await app.openApp(page);
  await app.openDuplicateFinder(page);
  await expect(page.locator('.dup-pair')).toHaveCount(1);

  await page.click('.dup-pair .btn-cancel');
  await page.waitForTimeout(500);
  await expect(page.locator('.dup-pair'),
    'a dismissed pair should leave the screen').toHaveCount(0);

  // Both contacts are untouched...
  expect((await verify.readCollection('jericho_contacts')).length).toBe(2);

  // ...and the pair does not come back on a reload.
  await page.reload();
  await page.waitForFunction(() => window._fbReady === true, null, { timeout: 60000 });
  await app.openDuplicateFinder(page);
  await expect(page.locator('.dup-pair'),
    'the dismissal should be remembered after a reload').toHaveCount(0);
  await expect(page.locator('#dupeList')).toContainText(/no duplicates/i);
});
