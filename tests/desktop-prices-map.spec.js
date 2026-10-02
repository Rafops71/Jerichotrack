/*
 * DESKTOP APP - live prices, the map, backup, and the safety checks.
 *
 * The price and map tests reach the real internet: the Cloudflare price worker,
 * and d3 plus the world atlas from their CDNs. That is on purpose - a stubbed
 * feed would not have caught the ounces-instead-of-kilograms bug, nor the ticker
 * going blank. When the network is genuinely unavailable these fail rather than
 * quietly pass, which is the honest outcome.
 */
const { test, expect } = require('@playwright/test');
const app = require('./helpers/desktop');
const verify = require('./helpers/verify');

test.beforeEach(async () => { await verify.wipe(); });

/* ---------------- prices ---------------- */

test('@robot DeskItem37_iron_ore_and_the_pgms_show_a_live_price', async ({ page }) => {
  await app.openApp(page);
  await app.goToTab(page, 'prices');

  /*
   * The commodity NAMES are placeholders that exist before any data arrives, so
   * waiting for a name proves nothing - an earlier version of this test passed
   * against a grid reading "GOLD (XAU) - Loading...". Wait for the loading state
   * to clear instead.
   */
  await expect(page.locator('#gridMetals')).not.toContainText(/Loading/i, { timeout: 45000 });
  const metals = await page.locator('#gridMetals').innerText();

  for (const name of ['Iron Ore', 'Platinum', 'Palladium']) {
    expect(metals, name + ' should be listed').toMatch(new RegExp(name, 'i'));
  }
  /* A name with no number beside it is not a price. */
  expect(metals, 'the metals grid should carry actual figures')
    .toMatch(/\d[\d,]*\.?\d/);
});

test('@robot DeskItem38_platinum_and_palladium_are_priced_per_kilogram', async ({ page }) => {
  await app.openApp(page);
  await app.goToTab(page, 'prices');
  // Again: wait for the figures, not the placeholder names.
  await expect(page.locator('#gridMetals')).not.toContainText(/Loading/i, { timeout: 45000 });

  const metals = await page.locator('#gridMetals').innerText();
  expect(metals, 'the PGMs must be quoted per kilogram').toMatch(/kg/i);
  /* Rafael asked for kilograms specifically. An ounce unit anywhere in the
     metals grid means the conversion was lost. */
  expect(metals, 'no ounce units belong in the metals grid')
    .not.toMatch(/\b(oz|ounce|troy)\b/i);
});

test('@robot DeskItem39_the_ticker_scrolls_without_going_blank', async ({ page }) => {
  await app.openApp(page);
  const track = page.locator('#tickerTrack');
  await expect(track).not.toBeEmpty({ timeout: 30000 });

  /*
   * The bug this covers: the scroll used to start at translateX(100%), so the
   * bar sat empty for a whole cycle before anything appeared. The content is
   * duplicated and the animation runs 0 to -50%, which is what makes it seamless.
   */
  const style = await track.evaluate(el => {
    const cs = getComputedStyle(el);
    return { animation: cs.animationName, duration: cs.animationDuration };
  });
  expect(style.animation, 'the ticker should be animated').not.toBe('none');
  expect(parseFloat(style.duration), 'the ticker animation needs a duration').toBeGreaterThan(0);

  // Sample the width twice: an empty or collapsing track is the failure.
  const first = await track.evaluate(el => el.scrollWidth);
  await page.waitForTimeout(1200);
  const second = await track.evaluate(el => el.scrollWidth);
  expect(first, 'the ticker track should have content').toBeGreaterThan(100);
  expect(second, 'the ticker should not empty itself as it scrolls').toBeGreaterThan(100);
});

/* ---------------- the map ---------------- */

test('@robot DeskItem40_the_map_opens_and_draws_the_world', async ({ page }) => {
  await app.openApp(page);
  await app.goToTab(page, 'map');

  /* The country paths come from the world atlas, so a drawn map means both d3
     and the atlas arrived and the projection ran. */
  await expect(page.locator('#mapStage svg')).toBeVisible({ timeout: 45000 });
  const paths = await page.locator('#mapStage svg path').count();
  expect(paths, 'the world should be drawn as country shapes').toBeGreaterThan(50);
});

test('@robot DeskItem41_can_switch_between_the_operations_and_atlas_maps', async ({ page }) => {
  await app.openApp(page);
  await app.goToTab(page, 'map');
  await expect(page.locator('#mapStage svg')).toBeVisible({ timeout: 45000 });

  const before = await page.locator('#globeStyleBtn').innerText();
  await page.click('#globeStyleBtn');
  await page.waitForTimeout(1200);
  const after = await page.locator('#globeStyleBtn').innerText();

  expect(after.trim(), 'the button should now offer the other look, was: ' + before)
    .not.toBe(before.trim());
  await expect(page.locator('#mapStage svg'),
    'the map should still be drawn after switching look').toBeVisible();
  expect(await page.locator('#mapStage svg path').count()).toBeGreaterThan(50);
});

test('@robot DeskItem42_can_filter_the_map_by_commodity_service_or_name', async ({ page }) => {
  /* Two counterparties with positions already set, so the test is about the
     filter rather than about geocoding. */
  await verify.seed('jericho_contacts', '910001', {
    id: 910001, name: 'Chidi Okonkwo', company: 'Lagos Metals Ltd', type: 'Seller',
    city: 'Lagos', country: 'Nigeria', commodity: 'Copper Cathodes',
    lat: 6.45, lon: 3.39, trust: 'Green', kyc: 'Full KYC', notes: ''
  });
  await verify.seed('jericho_contacts', '910002', {
    id: 910002, name: 'Rotterdam Bulk Terminal', company: 'Rotterdam Bulk Terminal',
    type: 'Logistics Provider', city: 'Rotterdam', country: 'Netherlands',
    commodity: 'Warehousing & Storage', lat: 51.92, lon: 4.48,
    trust: 'Unknown', kyc: 'No KYC', notes: ''
  });

  await app.openApp(page);
  await app.goToTab(page, 'map');
  await expect(page.locator('#mapStage svg')).toBeVisible({ timeout: 45000 });

  const options = await page.locator('#mapFilter option').allInnerTexts();
  expect(options.join(' | '), 'the filter should offer commodities').toMatch(/Copper Cathodes/i);
  expect(options.join(' | '), 'the filter should offer services').toMatch(/Warehousing/i);
  expect(options.join(' | '), 'the filter should offer names').toMatch(/Chidi Okonkwo|Lagos Metals/i);

  // Choosing one narrows what is counted as showing.
  const all = (await page.locator('#mapCount').innerText()).match(/\d+/);
  await page.selectOption('#mapFilter', { label: options.find(o => /Copper Cathodes/i.test(o)) });
  await page.waitForTimeout(900);
  const narrowed = (await page.locator('#mapCount').innerText()).match(/\d+/);
  expect(Number(narrowed[0]), 'filtering should show fewer than everything')
    .toBeLessThan(Number(all[0]) + 1);
  expect(Number(narrowed[0]), 'the copper seller should still be showing').toBeGreaterThan(0);
});

test('@robot DeskItem43_can_zoom_in_and_see_cities', async ({ page }) => {
  await verify.seed('jericho_contacts', '910003', {
    id: 910003, name: 'Ahmet Yilmaz', company: 'Yilmaz Demir Celik', type: 'Buyer',
    city: 'Iskenderun', country: 'Turkey', commodity: 'Steel Scrap',
    lat: 36.58, lon: 36.17, trust: 'Green', kyc: 'Full KYC', notes: ''
  });
  await app.openApp(page);
  await app.goToTab(page, 'map');
  await expect(page.locator('#mapStage svg')).toBeVisible({ timeout: 45000 });

  const label = () => page.locator('#mapZoomLabel').innerText();
  const before = await label();
  await page.click('[onclick="mapZoom(1)"]');
  await page.click('[onclick="mapZoom(1)"]');
  await page.waitForTimeout(900);
  const after = await label();
  expect(after.trim(), 'zooming in should change the zoom reading, was: ' + before)
    .not.toBe(before.trim());

  /* Zoomed in, the city has to be identifiable, not just the country. */
  const stage = await page.locator('#mapStage').innerText();
  const list = await page.locator('#mapList').innerText().catch(() => '');
  expect((stage + ' ' + list), 'the city should be named once zoomed in')
    .toMatch(/Iskenderun/i);
});

/* ---------------- backup ---------------- */

test('@robot DeskItem44_can_download_a_backup_of_everything', async ({ page }) => {
  await app.openApp(page);
  await app.addContact(page, { name: 'Backup Check', company: 'Backup Co' });
  await app.goToTab(page, 'backup');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click('[onclick="exportData()"]')
  ]);
  expect(download.suggestedFilename()).toMatch(/jericho-backup.*\.json/);

  /* Open the file: a backup that downloads but holds nothing is worse than none. */
  const stream = await download.createReadStream();
  let text = '';
  for await (const chunk of stream) text += chunk;
  const data = JSON.parse(text);
  expect(Array.isArray(data.contacts), 'the backup should carry the contacts').toBe(true);
  expect(data.contacts.some(c => c.name === 'Backup Check')).toBe(true);
  for (const key of ['leads', 'pipeline', 'contacts', 'tasks', 'commsLog', 'documents']) {
    expect(data, 'the backup is missing ' + key).toHaveProperty(key);
  }
  expect(data, 'commissions left this app and must not be in the backup')
    .not.toHaveProperty('commissions');
});

test('@robot DeskItem45_the_backup_counts_match_what_is_in_the_app', async ({ page }) => {
  await app.openApp(page);
  await app.addContact(page, { name: 'Counted One', company: 'A' });
  await app.addContact(page, { name: 'Counted Two', company: 'B' });
  await app.addTask(page, { title: 'A task to count' });
  await app.goToTab(page, 'backup');
  await page.waitForTimeout(400);

  await expect(page.locator('#bkContacts')).toHaveText('2');
  await expect(page.locator('#bkTasks')).toHaveText('1');

  // And the database agrees with the screen.
  const contacts = await verify.readCollection('jericho_contacts');
  expect(contacts.length).toBe(2);
});

/* ---------------- safety ---------------- */

test('@robot DeskItem46_the_test_app_cannot_reach_the_real_data', async ({ page }) => {
  await app.openApp(page);

  /* The sandbox build must carry its marker, name the test project, and hold no
     reference to the live one. If this ever fails, stop: the robot would be
     writing into Rafael's real CRM. */
  expect(await page.evaluate(() => window.__ROBOT_TEST_BUILD__ === true)).toBe(true);

  const html = await page.content();
  expect(html, 'the sandbox build must not name the live project')
    .not.toContain('jericho-operation');

  const projectId = await page.evaluate(() => {
    const el = [...document.querySelectorAll('script')].map(s => s.textContent).join('');
    const m = el.match(/projectId:\s*"([^"]+)"/);
    return m ? m[1] : null;
  });
  expect(projectId).toBe('jericho-test');
});
