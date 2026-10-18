/* PROBE: DuckDuckGo's Fire Button wipes local storage. Does the app recover? */
const { test, expect } = require('@playwright/test');
const app = require('./helpers/desktop');
const verify = require('./helpers/verify');

test('probe_local_storage_wiped_like_the_fire_button', async ({ page }) => {
  await verify.wipe();
  // Data exists in the cloud, as it would after real use.
  await verify.seed('jericho_contacts', '960001', {
    id: 960001, name: 'Chidi Okonkwo', company: 'Lagos Metals Ltd', type: 'Seller',
    country: 'Nigeria', city: 'Lagos', commodity: 'Copper Cathodes',
    trust: 'Green', kyc: 'Full KYC', notes: ''
  });
  await verify.seed('jericho_tasks', '960002', {
    id: 960002, title: 'Chase the B/L', priority: 'High', due: '2020-01-01',
    completed: false, linked: 'Lagos Metals'
  });

  await app.openApp(page);
  await app.waitForContacts(page, 1);
  console.log('BEFORE WIPE  : contacts=' + await page.evaluate(() => contacts.length) +
    ', localKeys=' + await page.evaluate(() =>
      Object.keys(localStorage).filter(k => k.startsWith('jericho')).length));

  /* The Fire Button: everything this site stored, gone, mid-session. */
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(2000);

  const gateUp = await page.locator('#lockScreen').isVisible();
  console.log('AFTER WIPE   : password asked again = ' + gateUp);

  // Sign in again, as he would.
  const errors = await app.openApp(page);
  await page.waitForTimeout(2500);

  const recovered = await page.evaluate(() => ({
    contacts: typeof contacts !== 'undefined' ? contacts.length : -1,
    tasks: typeof tasks !== 'undefined' ? tasks.length : -1
  }));
  console.log('AFTER SIGNIN : contacts=' + recovered.contacts + ', tasks=' + recovered.tasks);
  console.log('BANNER       : ' + (await page.locator('#fatalErrorBanner').isVisible()
    ? (await page.locator('#fatalErrorBanner').innerText()).replace(/\n/g, ' ').slice(0, 130)
    : '(hidden)'));
  await app.goToTab(page, 'contacts');
  console.log('CONTACTS SHOWN: ' + (await page.locator('#contactsBody').innerText()).includes('Chidi Okonkwo'));
  console.log('ERRORS       : ' + (errors.length ? errors.slice(0, 3).join(' | ') : '(none)'));
});
