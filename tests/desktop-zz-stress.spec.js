/* STRESS PROBE - discovery, not a checklist item. Deleted once it has reported. */
const { test, expect } = require('@playwright/test');
const app = require('./helpers/desktop');
const verify = require('./helpers/verify');

test.setTimeout(600000);

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

test('stress_volume_2000_contacts', async ({ page }) => {
  await verify.wipe();
  const rows = manyContacts(2000);
  /* Seeding 2000 documents one at a time over HTTP is slow, so the app is given
     them through its own local store instead - the same shape it would hold
     after a sync. */
  await page.addInitScript(data => {
    localStorage.setItem('jericho_contacts', JSON.stringify(data));
  }, rows);

  const t0 = Date.now();
  const errors = await app.openApp(page);
  console.log('OPEN with 2000 contacts: ' + (Date.now() - t0) + 'ms');

  const t1 = Date.now();
  await app.goToTab(page, 'contacts');
  await expect(page.locator('#contactsBody tr').first()).toBeVisible({ timeout: 60000 });
  console.log('CONTACTS tab render: ' + (Date.now() - t1) + 'ms, rows=' +
    await page.locator('#contactsBody tr').count());

  const t2 = Date.now();
  await app.goToTab(page, 'dashboard');
  console.log('DASHBOARD: ' + (Date.now() - t2) + 'ms');

  const t3 = Date.now();
  await app.goToTab(page, 'map');
  const drew = await page.locator('#mapStage canvas').count().catch(() => 0);
  console.log('MAP open: ' + (Date.now() - t3) + 'ms, canvas=' + drew);

  const t4 = Date.now();
  await app.goToTab(page, 'backup');
  console.log('BACKUP: ' + (Date.now() - t4) + 'ms, count=' +
    await page.locator('#bkContacts').innerText());

  console.log('ERRORS: ' + (errors.length ? errors.slice(0, 5).join(' | ') : '(none)'));
  console.log('BANNER: ' + (await page.locator('#fatalErrorBanner').isVisible() ?
    (await page.locator('#fatalErrorBanner').innerText()).slice(0, 160) : '(hidden)'));
});

test('stress_find_duplicates_on_2000', async ({ page }) => {
  await verify.wipe();
  await page.addInitScript(data => {
    localStorage.setItem('jericho_contacts', JSON.stringify(data));
  }, manyContacts(2000));
  await app.openApp(page);
  await app.goToTab(page, 'contacts');

  const t0 = Date.now();
  let froze = false;
  await page.click('[onclick="showDupes()"]').catch(e => { froze = true; });
  // Is the browser still answering after the scan?
  const alive = await page.evaluate(() => 1 + 1).catch(() => null);
  const ms = Date.now() - t0;
  const pairs = await page.evaluate(() => (typeof DUP !== 'undefined' ? DUP.pairs.length : -1)).catch(() => -1);
  console.log('FIND DUPLICATES on 2000: ' + ms + 'ms, pairs=' + pairs +
    ', page responsive=' + (alive === 2) + ', clickFailed=' + froze);
});
