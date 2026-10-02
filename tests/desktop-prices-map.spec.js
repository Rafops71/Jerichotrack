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

/*
 * The globe draws on a CANVAS, not an svg - d3.geoPath(proj, ctx) paints to a 2D
 * context. The network and flow views are the svg ones. Asserting svg here cost
 * three wrong diagnoses, twice reported as an app bug when the map was working
 * the whole time; so these check the canvas, and check it was actually painted
 * rather than merely created.
 */

/** Is this canvas painted, or a blank rectangle? */
async function canvasIsPainted(page) {
  return page.evaluate(() => {
    const c = document.querySelector('#mapStage canvas');
    if (!c) return { painted: false, why: 'no canvas' };
    const ctx = c.getContext('2d');
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let lit = 0;
    for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 8) lit++;   // sample alpha
    return { painted: lit > 50, lit, w: c.width, h: c.height };
  });
}

/** A cheap signature of what the canvas currently shows, to spot a redraw. */
async function canvasSignature(page) {
  return page.evaluate(() => {
    const c = document.querySelector('#mapStage canvas');
    if (!c) return 'none';
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let h = 0;
    for (let i = 0; i < data.length; i += 4 * 301) h = (h * 31 + data[i]) % 1e9;
    return String(h);
  });
}

test('@robot DeskItem40_the_map_opens_and_draws_the_world', async ({ page }) => {
  await app.openApp(page);
  await app.goToTab(page, 'map');

  /* Wait for either outcome and report what the app said. A bare timeout tells
     you nothing about why, which is what sent me down three wrong paths. */
  await page.waitForFunction(
    () => {
      if (document.querySelector('#mapStage canvas')) return true;
      const l = document.getElementById('mapLoading');
      return !!(l && /could not load/i.test(l.textContent || ''));
    },
    null,
    { timeout: 60000 }
  ).catch(() => {});

  const said = (await page.locator('#mapLoading').innerText().catch(() => '')).trim();
  const libs = await page.evaluate(() => ({ d3: typeof window.d3, topo: typeof window.topojson }));
  expect(await page.locator('#mapStage canvas').count(),
    'the map did not draw. The app said: "' + said + '". d3=' + libs.d3 + ', topojson=' + libs.topo)
    .toBeGreaterThan(0);

  const paint = await canvasIsPainted(page);
  expect(paint.painted,
    'the canvas exists but nothing was painted on it: ' + JSON.stringify(paint)).toBe(true);
});

test('@robot DeskItem41_can_switch_between_the_operations_and_atlas_maps', async ({ page }) => {
  await app.openApp(page);
  await app.goToTab(page, 'map');
  await expect(page.locator('#mapStage canvas')).toHaveCount(1, { timeout: 60000 });

  const beforeLabel = (await page.locator('#globeStyleBtn').innerText()).trim();
  const beforePixels = await canvasSignature(page);

  await page.click('#globeStyleBtn');
  await page.waitForTimeout(1500);

  const afterLabel = (await page.locator('#globeStyleBtn').innerText()).trim();
  expect(afterLabel, 'the button should now offer the other look, was: ' + beforeLabel)
    .not.toBe(beforeLabel);

  /* The look has to actually change, not just the button text. */
  expect(await canvasSignature(page),
    'switching the look should repaint the map differently').not.toBe(beforePixels);
  expect((await canvasIsPainted(page)).painted,
    'the map should still be painted after switching look').toBe(true);
});

test('@robot DeskItem42_can_filter_the_map_by_commodity_service_or_name', async ({ page }) => {
  /* Two counterparties with positions already set, so this is about the filter
     rather than about geocoding. */
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
  await app.waitForContacts(page, 2);        // before the filter builds itself
  await app.goToTab(page, 'map');
  await expect(page.locator('#mapStage canvas')).toHaveCount(1, { timeout: 60000 });

  const options = await page.locator('#mapFilter option').allInnerTexts();
  const joined = options.join(' | ');
  expect(joined, 'the filter should offer commodities').toMatch(/Copper Cathodes/i);
  expect(joined, 'the filter should offer services').toMatch(/Warehousing/i);
  expect(joined, 'the filter should offer names').toMatch(/Chidi Okonkwo|Lagos Metals/i);

  // Everyone first: the count reads "N of M shown".
  await expect(page.locator('#mapCount')).toContainText('2 of 2');

  // Narrowing to one commodity leaves one, and it is the right one.
  await page.selectOption('#mapFilter', { label: options.find(o => /Copper Cathodes/i.test(o)) });
  await page.waitForTimeout(900);
  await expect(page.locator('#mapCount')).toContainText('1 of 2');
  await expect(page.locator('#mapList')).toContainText('Lagos Metals Ltd');
  await expect(page.locator('#mapList'),
    'the warehouse does not trade copper and should drop out').not.toContainText('Rotterdam');
});

test('@robot DeskItem43_can_zoom_in_and_see_cities', async ({ page }) => {
  await verify.seed('jericho_contacts', '910003', {
    id: 910003, name: 'Ahmet Yilmaz', company: 'Yilmaz Demir Celik', type: 'Buyer',
    city: 'Iskenderun', country: 'Turkey', commodity: 'Steel Scrap',
    lat: 36.58, lon: 36.17, trust: 'Green', kyc: 'Full KYC', notes: ''
  });
  await app.openApp(page);
  await app.waitForContacts(page, 1);
  await app.goToTab(page, 'map');
  await expect(page.locator('#mapStage canvas')).toHaveCount(1, { timeout: 60000 });

  const before = (await page.locator('#mapZoomLabel').innerText()).trim();
  const beforePixels = await canvasSignature(page);

  await page.click('[onclick="mapZoom(1)"]');
  await page.click('[onclick="mapZoom(1)"]');
  await page.waitForTimeout(1200);

  expect((await page.locator('#mapZoomLabel').innerText()).trim(),
    'zooming should change the zoom reading, was: ' + before).not.toBe(before);
  expect(await canvasSignature(page),
    'zooming in should redraw the globe larger').not.toBe(beforePixels);

  /* The city has to be identifiable, not just the country. The canvas labels are
     painted pixels, so the readable proof is the match list beside the map. */
  await expect(page.locator('#mapList'),
    'the city should be named next to the map').toContainText(/Iskenderun/i);
  await expect(page.locator('#mapList')).toContainText(/Turkey/i);
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
