/*
 * DESKTOP APP - the crash paths.
 *
 * Rafael asked for "a system that does not crash". These are the routes by which
 * it actually could, each reproduced here rather than reasoned about:
 *
 *  - damaged saved data, which threw at the top level and killed the app on load
 *  - a device with no storage room, which threw out of the save button
 *  - a malformed record, which took down whatever was drawing it
 *  - any fault at all, which left the app silent with nothing on screen
 */
const { test, expect } = require('@playwright/test');
const app = require('./helpers/desktop');
const verify = require('./helpers/verify');

test.beforeEach(async () => { await verify.wipe(); });

test('@robot DeskItem50_damaged_saved_data_does_not_stop_the_app', async ({ page }) => {
  /* Write rubbish into the saved contacts before the app ever runs, the way a
     half-finished write or a full disk would leave it. */
  await page.addInitScript(() => {
    localStorage.setItem('jericho_contacts', '[{"name":"Chidi","company":"Lag');   // truncated
    localStorage.setItem('jericho_tasks', 'not json at all');
    localStorage.setItem('jericho_leads', '{"not":"a list"}');
  });

  const errors = await app.openApp(page);
  /* The app has to open at all. Before this it threw before any of its own code
     ran, leaving a blank page. */
  await expect(page.locator('#mainContent')).toBeVisible();
  await expect(page.locator('.nav button').first()).toBeVisible();

  // It says what happened rather than pretending the book was always empty.
  await expect(page.locator('#fatalErrorBanner')).toBeVisible();
  await expect(page.locator('#fatalErrorBanner')).toContainText(/could not be read/i);
  await expect(page.locator('#fatalErrorBanner'),
    'it must say the data was kept, not deleted').toContainText(/kept aside|nothing was deleted/i);

  // And the unreadable text is still recoverable.
  const kept = await page.evaluate(() => localStorage.getItem('jericho_contacts.broken'));
  expect(kept, 'the damaged contacts must be kept for recovery').toContain('Chidi');

  // The app is still usable afterwards: adding a contact works.
  await app.addContact(page, { name: 'Still Works', company: 'Fine Ltd' });
  const saved = await verify.waitFor('jericho_contacts', c => c.name === 'Still Works',
    { label: 'a contact saved after recovering from damaged data' });
  expect(saved.company).toBe('Fine Ltd');

  expect(errors.filter(e => /SAFETY STOP/.test(e)), 'no safety stop expected').toEqual([]);
});

test('@robot DeskItem51_a_full_device_says_so_instead_of_breaking', async ({ page }) => {
  await app.openApp(page);

  // Make this browser refuse to store anything more, as Safari does when full.
  await page.evaluate(() => {
    const real = Storage.prototype.setItem;
    window.__realSetItem = real;
    Storage.prototype.setItem = function (k, v) {
      if (String(k).startsWith('jericho_')) {
        const err = new Error('The quota has been exceeded.');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return real.call(this, k, v);
    };
  });

  await app.addContact(page, { name: 'Full Disk Test', company: 'No Room Ltd' });

  /* It must say so plainly, stay standing, and still get the contact to the
     cloud - which is the copy that actually matters. */
  /* The container, not ".toast" as well: matching both resolves to several
     elements at once and Playwright refuses that rather than guessing. */
  await expect(page.locator('#toastContainer'))
    .toContainText(/run out of room|refused to save/i, { timeout: 10000 });
  await expect(page.locator('#contactsBody')).toBeVisible();

  const saved = await verify.waitFor('jericho_contacts', c => c.name === 'Full Disk Test',
    { label: 'the contact in the cloud despite the full device' });
  expect(saved.company).toBe('No Room Ltd');

  // The app is not wedged: the tabs still work.
  await app.goToTab(page, 'dashboard');
  await expect(page.locator('#mainContent')).toBeVisible();
});

test('@robot DeskItem52_one_bad_record_does_not_take_down_the_tab', async ({ page }) => {
  /* A record whose fields are the wrong shape entirely - the kind an old backup
     or a half-finished import leaves behind. */
  await verify.seed('jericho_contacts', '940001', {
    id: 940001, name: 'Good Contact', company: 'Fine Ltd', type: 'Buyer',
    country: 'Turkey', trust: 'Green', kyc: 'Full KYC', commodity: 'Steel Scrap'
  });
  await verify.seed('jericho_contacts', '940002', {
    id: 940002, name: 'Bad Record', company: 'Broken Ltd',
    commodity: 12345, trust: null, kyc: null, type: null, country: null
  });

  const errors = await app.openApp(page);
  await app.waitForContacts(page, 2);
  await app.goToTab(page, 'contacts');

  /* The good record must still be listed. Before the renders were isolated, a
     throw here left the table empty and the app silent. */
  await expect(page.locator('#contactsBody')).toContainText('Good Contact');

  // The rest of the app keeps working too.
  await app.goToTab(page, 'dashboard');
  await expect(page.locator('#mainContent')).toBeVisible();
  await app.goToTab(page, 'backup');
  await expect(page.locator('#bkContacts')).toHaveText('2');

  expect(errors.filter(e => /SAFETY STOP/.test(e))).toEqual([]);
});

test('@robot DeskItem53_a_fault_is_shown_on_screen_not_swallowed', async ({ page }) => {
  await app.openApp(page);
  await expect(page.locator('#fatalErrorBanner'),
    'the banner stays out of the way when nothing is wrong').toBeHidden();

  /* Throw the way a real fault would - from a handler, where nothing is
     catching it. On an iPad there is no console, so the screen is the only
     place a fault can be seen. */
  await page.evaluate(() => { setTimeout(() => { throw new Error('deliberate test fault'); }, 0); });

  await expect(page.locator('#fatalErrorBanner')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#fatalErrorBanner')).toContainText('deliberate test fault');
  await expect(page.locator('#fatalErrorBanner'),
    'it should reassure him his data is intact').toContainText(/data is not affected/i);

  // A rejected promise is reported too, not only a thrown error.
  await page.evaluate(() => { Promise.reject(new Error('deliberate async fault')); });
  await expect(page.locator('#fatalErrorBanner')).toBeVisible();

  // And the app is still usable while the banner is up.
  await app.goToTab(page, 'contacts');
  await expect(page.locator('#contactsBody')).toBeVisible();
});
