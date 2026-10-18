/*
 * DESKTOP APP - volume, and text from outside.
 *
 * These exist because the answer to "have you stress tested it" was no. Both
 * faults were measured before being fixed:
 *
 *  - Find Duplicates compared every contact against every other. At 2000 that
 *    is two million comparisons and it froze the app for 19.4 seconds, with the
 *    click that started it timing out. An iPad would be worse.
 *  - A contact name containing markup RAN, and a company field containing a
 *    stray </td></tr> split the table into an extra row.
 */
const { test, expect } = require('@playwright/test');
const app = require('./helpers/desktop');
const verify = require('./helpers/verify');

// Seeding two thousand records over HTTP is slow; the measuring is not.
test.setTimeout(420000);

function manyContacts(n) {
  const countries = ['Turkey','China','Nigeria','Germany','Netherlands','Mexico','India','Brazil'];
  const mats = ['Steel Scrap','Iron Ore','Copper Cathodes','Platinum','Pig Iron','PNS Scrap'];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: 800000 + i,
      name: 'Person ' + i + ' Surname' + (i % 97),
      company: 'Company ' + (i % 713) + ' Ltd',
      type: ['Buyer','Seller','Broker','Agent'][i % 4],
      city: 'City' + (i % 211), country: countries[i % countries.length],
      phone: '+90 532 ' + String(1000000 + i).slice(-7),
      email: 'p' + i + '@co' + (i % 713) + '.com',
      commodity: mats[i % mats.length], introBy: '', linkedin: '',
      trust: ['Green','Yellow','Red','Unknown'][i % 4],
      kyc: ['Full KYC','Partial KYC','No KYC'][i % 3],
      followup: '', notes: 'Note for ' + i, date: '01/10/2026',
      lat: -30 + (i % 120), lon: -170 + (i % 340)
    });
  }
  return out;
}

test('@robot DeskItem54_two_thousand_contacts_do_not_freeze_the_app', async ({ page }) => {
  await verify.wipe();
  await verify.seedMany('jericho_contacts', manyContacts(2000));

  const errors = await app.openApp(page);
  /* Seeded into the DATABASE, not localStorage: the app syncs a moment after
     opening and would otherwise replace a local-only seed with nothing, which
     is how the first attempt at this measured an empty list and looked fine. */
  await app.waitForContacts(page, 2000);

  for (const tab of ['contacts', 'dashboard', 'map', 'backup']) {
    const started = Date.now();
    await app.goToTab(page, tab);
    const took = Date.now() - started;
    expect(took, 'opening ' + tab + ' with 2000 contacts took ' + took + 'ms').toBeLessThan(15000);
  }

  await expect(page.locator('#bkContacts'), 'all 2000 should be accounted for').toHaveText('2000');
  await app.goToTab(page, 'contacts');
  expect(await page.locator('#contactsBody tr').count()).toBe(2000);
  await expect(page.locator('#fatalErrorBanner'),
    'volume alone must not produce a fault').toBeHidden();
  expect(errors.filter(e => /SAFETY STOP/.test(e))).toEqual([]);
});

test('@robot DeskItem55_find_duplicates_on_two_thousand_is_quick', async ({ page }) => {
  await verify.wipe();
  await verify.seedMany('jericho_contacts', manyContacts(2000));
  await app.openApp(page);
  await app.waitForContacts(page, 2000);
  await app.goToTab(page, 'contacts');

  const started = Date.now();
  await page.click('[onclick="showDupes()"]');
  await expect(page.locator('#dupeBox')).toBeVisible();
  const took = Date.now() - started;

  /* Measured at 19,420ms before the fix, with the click itself timing out.
     Three seconds is still slow, and far enough below it to catch a regression
     on a machine slower than this one. */
  expect(took, 'Find Duplicates on 2000 contacts took ' + took + 'ms').toBeLessThan(3000);

  // Still responsive, and still correct: these 2000 are all different people.
  expect(await page.evaluate(() => 1 + 1)).toBe(2);
  await expect(page.locator('#dupeList')).toContainText(/no duplicates/i);
});

test('@robot DeskItem56_an_imported_name_with_code_in_it_is_shown_as_text', async ({ page }) => {
  await verify.wipe();
  /* Exactly what a .vcf or .csv from outside can carry. */
  await verify.seed('jericho_contacts', '950001', {
    id: 950001,
    name: '<img src=x onerror="window.__ran=1">Nasty',
    company: '</td></tr><tr><td>Broken Row',
    type: 'Buyer', country: 'Turkey', trust: 'Green', kyc: 'Full KYC',
    commodity: 'Steel Scrap', notes: '<b>bold</b>'
  });
  await verify.seed('jericho_contacts', '950002', {
    id: 950002, name: 'Normal Person', company: 'Normal Ltd',
    type: 'Seller', country: 'Germany', trust: 'Green', kyc: 'Full KYC', commodity: 'Pig Iron'
  });

  await app.openApp(page);
  await app.waitForContacts(page, 2);
  await app.goToTab(page, 'contacts');
  await page.waitForTimeout(600);

  expect(await page.evaluate(() => window.__ran === 1),
    'code in a contact name must never run').toBe(false);
  expect(await page.locator('#contactsBody img').count(),
    'markup in a name must not become a real element').toBe(0);
  expect(await page.locator('#contactsBody tr').count(),
    'a stray closing tag must not split the table').toBe(2);

  // It is shown as the words it is, so he can see what arrived and fix it.
  await expect(page.locator('#contactsBody')).toContainText('<img src=x');
  await expect(page.locator('#contactsBody')).toContainText('Normal Person');
});

/*
 * Item 57. The pill used to read "Synced - Live" through an entire offline
 * session, because every snapshot flipped it to online -- including the ones
 * Firestore serves from its own cache when a save is made with no signal.
 * Rafael trades from his phone; "it is in the cloud" has to mean that.
 */
test('@robot DeskItem57_offline_never_claims_the_cloud', async ({ page, context }) => {
  await verify.wipe();
  await app.openApp(page);
  await page.waitForTimeout(1500);
  expect(await page.locator('#syncStatus').innerText()).toContain('Synced');

  await context.setOffline(true);
  await page.waitForTimeout(600);
  await app.addContact(page, { name: 'No Signal Sam', company: 'Dead Zone Ltd' });
  await page.waitForTimeout(2500);

  const offlinePill = (await page.locator('#syncStatus').innerText()).trim();
  console.log('   while offline the pill reads: ' + JSON.stringify(offlinePill));
  // The work is kept, and shown.
  expect(await page.locator('#contactsBody').innerText()).toContain('No Signal Sam');
  // But it must not be called synced.
  expect(offlinePill).not.toContain('Synced');
  expect(offlinePill).not.toContain('Live');

  await context.setOffline(false);
  await page.waitForTimeout(7000);
  const backPill = (await page.locator('#syncStatus').innerText()).trim();
  console.log('   back online the pill reads: ' + JSON.stringify(backPill));
  expect(backPill).toContain('Synced');
  const inCloud = (await verify.readCollection('jericho_contacts'))
    .some(c => c.name === 'No Signal Sam');
  expect(inCloud, 'the offline contact should reach the cloud once reconnected').toBe(true);
});
