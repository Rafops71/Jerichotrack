/* PROBES - discovery. Findings get promoted to checklist items, then this goes. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const app = require('./helpers/desktop');
const verify = require('./helpers/verify');

test.setTimeout(240000);
const FIX = path.join(__dirname, '..', '.robot', 'fixtures');
function fixture(name, body) {
  fs.mkdirSync(FIX, { recursive: true });
  const p = path.join(FIX, name);
  fs.writeFileSync(p, body);
  return p;
}

/* ---------- 1. the Fire Button ---------- */
test('probe_local_storage_wiped_like_the_fire_button', async ({ page }) => {
  await verify.wipe();
  await verify.seed('jericho_contacts', '960001', {
    id: 960001, name: 'Chidi Okonkwo', company: 'Lagos Metals Ltd', type: 'Seller',
    country: 'Nigeria', city: 'Lagos', commodity: 'Copper Cathodes',
    trust: 'Green', kyc: 'Full KYC', notes: ''
  });
  await app.openApp(page);
  await app.waitForContacts(page, 1);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1500);
  console.log('FIRE: password asked again =', await page.locator('#lockScreen').isVisible());
  await app.openApp(page);
  await page.waitForTimeout(2500);
  console.log('FIRE: contacts back =', await page.evaluate(() => contacts.length));
  await app.goToTab(page, 'contacts');
  console.log('FIRE: name shown =', (await page.locator('#contactsBody').innerText()).includes('Chidi'));
  console.log('FIRE: banner =', await page.locator('#fatalErrorBanner').isVisible());
});

/* ---------- 2. iPad sizes ---------- */
for (const [label, w, h] of [['iPad portrait', 820, 1180], ['iPad landscape', 1180, 820], ['iPhone', 390, 844]]) {
  test('probe_layout_' + label.replace(/ /g, '_'), async ({ page }) => {
    await verify.wipe();
    await verify.seedMany('jericho_contacts', Array.from({ length: 12 }, (_, i) => ({
      id: 970000 + i, name: 'Person ' + i, company: 'Company ' + i + ' Ltd', type: 'Buyer',
      city: 'City' + i, country: 'Turkey', commodity: 'Steel Scrap',
      trust: 'Green', kyc: 'Full KYC', notes: '', phone: '+90 532 000 00' + i,
      email: 'p' + i + '@x.com', lat: 36 + i, lon: 36 + i
    })));
    await page.setViewportSize({ width: w, height: h });
    await app.openApp(page);
    await app.waitForContacts(page, 12);

    const report = [];
    for (const tab of ['dashboard', 'contacts', 'pipeline', 'tasks', 'prices', 'map', 'backup']) {
      await app.goToTab(page, tab);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => ({
        pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        offRight: [...document.querySelectorAll('button, input, select')]
          .filter(e => e.offsetParent !== null)
          .filter(e => e.getBoundingClientRect().right > window.innerWidth + 2).length,
        tiny: [...document.querySelectorAll('button')]
          .filter(e => e.offsetParent !== null)
          .filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 32; }).length
      }));
      report.push(tab + ' scroll=' + m.pageScroll + ' offscreen=' + m.offRight + ' small=' + m.tiny);
    }
    console.log(label.toUpperCase() + ' (' + w + 'x' + h + '):\n  ' + report.join('\n  '));
  });
}

/* ---------- 3. malformed import files ---------- */
test('probe_malformed_import_files', async ({ page }) => {
  await verify.wipe();
  await app.openApp(page);
  const cases = [
    ['empty.csv', ''],
    ['headers-only.csv', 'Full Name,Company,Email'],
    ['one-column.csv', 'Nonsense\nrow one\nrow two'],
    ['binary.vcf', Buffer.from([0, 1, 2, 3, 255, 254, 0, 66, 67]).toString('binary')],
    ['huge-line.csv', 'Full Name,Company\n' + 'A'.repeat(200000) + ',' + 'B'.repeat(200000)],
    ['no-end.vcf', 'BEGIN:VCARD\nVERSION:3.0\nFN:Half A Card\nORG:Truncated Ltd'],
    ['crlf-bom.csv', '﻿Full Name,Company\r\nBom Person,Bom Ltd\r\n'],
    ['quotes.csv', 'Full Name,Company\n"Unclosed quote,Still Here\n']
  ];
  for (const [name, body] of cases) {
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    await app.goToTab(page, 'contacts');
    await page.click('[onclick="showImport()"]').catch(() => {});
    let summary = '(no panel)';
    try {
      await page.setInputFiles('#impFile', fixture(name, body));
      await page.waitForTimeout(700);
      summary = ((await page.locator('#impSum').innerText()) || '').replace(/\s+/g, ' ').slice(0, 70);
    } catch (e) { summary = 'THREW: ' + e.message.split('\n')[0].slice(0, 50); }
    const alive = await page.evaluate(() => 1 + 1).catch(() => null);
    console.log(name.padEnd(18) + ' -> ' + summary + ' | alive=' + (alive === 2) +
      (errs.length ? ' | ERR: ' + errs[0].slice(0, 60) : ''));
    await page.click('[onclick="hideImport()"]').catch(() => {});
  }
  console.log('MALFORMED: banner =', await page.locator('#fatalErrorBanner').isVisible());
  console.log('MALFORMED: contacts saved =', (await verify.readCollection('jericho_contacts')).length);
});

/* ---------- 4. rapid clicking and double submit ---------- */
test('probe_rapid_clicking', async ({ page }) => {
  await verify.wipe();
  await app.openApp(page);
  await app.goToTab(page, 'contacts');
  await page.click('[onclick="showAddContact()"]');
  await page.fill('#contactName', 'Double Click Test');
  await page.fill('#contactCompany', 'Twice Ltd');

  // Hammer Save.
  for (let i = 0; i < 5; i++) await page.click('[onclick="saveContact()"]').catch(() => {});
  await page.waitForTimeout(1500);
  const rows = await verify.readCollection('jericho_contacts');
  console.log('RAPID SAVE: contacts created =', rows.length, '(1 would be ideal)');

  // Hammer the tabs.
  const tabs = ['dashboard','contacts','pipeline','tasks','commslog','documents','prices','relationships','map','backup'];
  for (let i = 0; i < 3; i++) {
    for (const t of tabs) await page.click(`[onclick="showSection('${t}',this)"]`).catch(() => {});
  }
  await page.waitForTimeout(800);
  const visible = await page.evaluate(() =>
    [...document.querySelectorAll('.content')].filter(e => e.style.display !== 'none').length);
  console.log('RAPID TABS: sections visible =', visible, '(1 expected) | alive =',
    (await page.evaluate(() => 1 + 1)) === 2);
  console.log('RAPID: banner =', await page.locator('#fatalErrorBanner').isVisible());
});

/* ---------- 5. offline, then back ---------- */
test('probe_offline_then_online', async ({ page, context }) => {
  await verify.wipe();
  await app.openApp(page);

  await context.setOffline(true);
  await page.waitForTimeout(800);
  await app.addContact(page, { name: 'Saved While Offline', company: 'No Signal Ltd' });
  const pill = await page.locator('#syncStatus').innerText();
  console.log('OFFLINE: pill =', JSON.stringify(pill.trim()), '| shown on screen =',
    (await page.locator('#contactsBody').innerText()).includes('Saved While Offline'));

  await context.setOffline(false);
  await page.waitForTimeout(6000);
  const inCloud = (await verify.readCollection('jericho_contacts')).some(c => c.name === 'Saved While Offline');
  console.log('BACK ONLINE: reached the cloud =', inCloud, '| pill =',
    JSON.stringify((await page.locator('#syncStatus').innerText()).trim()));
  console.log('OFFLINE: banner =', await page.locator('#fatalErrorBanner').isVisible());
});

/* ---------- 6. two tabs on the same data ---------- */
test('probe_two_tabs_at_once', async ({ page, context }) => {
  await verify.wipe();
  await app.openApp(page);
  const second = await context.newPage();
  await app.openApp(second);

  await app.addContact(page, { name: 'From Tab One', company: 'One Ltd' });
  await page.waitForTimeout(3000);
  const seenBySecond = await second.evaluate(() => contacts.some(c => c.name === 'From Tab One'));
  console.log('TWO TABS: tab two sees tab one\'s contact =', seenBySecond);

  await app.addContact(second, { name: 'From Tab Two', company: 'Two Ltd' });
  await page.waitForTimeout(3000);
  const rows = await verify.readCollection('jericho_contacts');
  console.log('TWO TABS: both saved =', rows.length, '(2 expected):',
    rows.map(r => r.name).join(', '));
  console.log('TWO TABS: tab one still has both =',
    await page.evaluate(() => contacts.length));
  console.log('TWO TABS: banner one =', await page.locator('#fatalErrorBanner').isVisible(),
    '| banner two =', await second.locator('#fatalErrorBanner').isVisible());
  await second.close();
});
