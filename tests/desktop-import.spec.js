/*
 * DESKTOP APP - bulk contact import.
 *
 * The fixtures are written to disk and handed to the real <input type="file">,
 * so the browser's own file reading is exercised rather than stubbed. Every
 * "did it save" claim comes from the sandbox database, never from the screen.
 *
 * Items 21 to 24 are the ones that cost real contacts during development:
 * matching too loosely swallowed a new colleague into an existing record and
 * lost them silently, which is worse than a duplicate. They are regression
 * tests for that, not hypotheticals.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const app = require('./helpers/desktop');
const verify = require('./helpers/verify');

const FIXTURES = path.join(__dirname, '..', '.robot', 'fixtures');

/** Write a fixture and return its path. */
function fixture(name, body) {
  fs.mkdirSync(FIXTURES, { recursive: true });
  const p = path.join(FIXTURES, name);
  fs.writeFileSync(p, body);
  return p;
}

const VCF = [
  'BEGIN:VCARD', 'VERSION:3.0',
  'N:Okonkwo;Chidi;;;', 'FN:Chidi Okonkwo',
  'ORG:Lagos Metals Ltd;Trading', 'TITLE:Managing Director',
  'TEL;TYPE=CELL:+234 801 555 0199', 'EMAIL;TYPE=WORK:chidi@lagosmetals.com',
  'ADR;TYPE=WORK:;;12 Marina Road;Lagos;;101001;Nigeria',
  'NOTE:Met at LME week. Copper cathodes.',
  'END:VCARD',
  'BEGIN:VCARD', 'VERSION:2.1',
  'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Hans G=C3=BCnther',
  'ORG:Rheinstahl GmbH', 'TEL;CELL:+49 170 5550101', 'EMAIL:hans@rheinstahl.de',
  'ADR;WORK:;;Hafenstrasse 4;Duisburg;;47119;Germany',
  'END:VCARD',
  'BEGIN:VCARD', 'VERSION:3.0', 'FN:', 'TEL:+1 555 000 0000', 'END:VCARD'
].join('\r\n');

const CSV = [
  'First Name,Last Name,Company,Job Title,E-mail Address,Mobile Phone,City,Country,Notes',
  'Ahmet,Yilmaz,"Yilmaz Demir Celik, A.S.",Purchasing Manager,ahmet@yilmazdemir.com.tr,+90 532 555 0143,Iskenderun,Turkey,"HMS 1&2, 5000t/month"',
  'Li,Wei,Tianjin Ore Import Co,Trader,li.wei@tjore.cn,+86 138 5550 0177,Tianjin,China,Iron ore 62%'
].join('\n');

test.beforeEach(async () => { await verify.wipe(); });

test('@robot DeskItem16_can_import_a_vcf_from_my_phone', async ({ page }) => {
  await app.openApp(page);
  await app.importFile(page, fixture('phone.vcf', VCF));

  await expect(page.locator('#contactsBody')).toContainText('Chidi Okonkwo');
  const saved = await verify.waitFor('jericho_contacts', c => c.name === 'Chidi Okonkwo',
    { label: 'the imported vCard contact' });
  expect(saved.company).toBe('Lagos Metals Ltd');
  expect(saved.phone).toBe('+234 801 555 0199');
  expect(saved.city).toBe('Lagos');
  expect(saved.country).toBe('Nigeria');
  /* The job title belongs in Role. It used to land in Notes, where it beat the
     real NOTE to the field and that note was lost. */
  expect(saved.type).toBe('Managing Director');
  expect(saved.notes).toContain('Met at LME week');

  // A card with no name at all is dropped rather than imported blank.
  const all = await verify.readCollection('jericho_contacts');
  expect(all.length, 'the nameless third card should not have been imported').toBe(2);
});

test('@robot DeskItem17_can_import_a_csv_and_it_matches_the_columns', async ({ page }) => {
  await app.openApp(page);
  await app.importFile(page, fixture('book.csv', CSV));

  const saved = await verify.waitFor('jericho_contacts', c => c.name === 'Ahmet Yilmaz',
    { label: 'the imported CSV contact' });
  // First name and Last name were two columns and must be joined into one name.
  expect(saved.name).toBe('Ahmet Yilmaz');
  expect(saved.type).toBe('Purchasing Manager');
  expect(saved.email).toBe('ahmet@yilmazdemir.com.tr');
  expect(saved.city).toBe('Iskenderun');
});

test('@robot DeskItem18_shows_what_it_found_before_saving_anything', async ({ page }) => {
  await app.openApp(page);
  await app.goToTab(page, 'contacts');
  await page.click('[onclick="showImport()"]');
  await page.setInputFiles('#impFile', fixture('book.csv', CSV));
  await page.waitForTimeout(500);

  await expect(page.locator('#impSum')).toContainText('2');
  await expect(page.locator('#impPrev')).toContainText('Ahmet Yilmaz');
  await expect(page.locator('#impGo'), 'the Import button should be offered').toBeVisible();

  /* Nothing may be written until the button is pressed. */
  await verify.stayedEmpty('jericho_contacts', 2000);

  await page.click('[onclick="hideImport()"]');
  await page.waitForTimeout(300);
  await verify.stayedEmpty('jericho_contacts', 1500);
});

test('@robot DeskItem19_importing_the_same_file_twice_does_not_double_up', async ({ page }) => {
  await app.openApp(page);
  await app.importFile(page, fixture('book.csv', CSV));
  await verify.waitFor('jericho_contacts', c => c.name === 'Li Wei');
  const first = (await verify.readCollection('jericho_contacts')).length;
  expect(first).toBe(2);

  const summary = await app.importFile(page, fixture('book.csv', CSV));
  expect(summary, 'the second import should say it is skipping them').toMatch(/skip/i);

  await page.waitForTimeout(800);
  const second = (await verify.readCollection('jericho_contacts')).length;
  expect(second, 'importing the same file twice must not add anybody').toBe(first);
});

test('@robot DeskItem20_a_comma_inside_a_company_name_does_not_break_it', async ({ page }) => {
  await app.openApp(page);
  await app.importFile(page, fixture('book.csv', CSV));
  const saved = await verify.waitFor('jericho_contacts', c => c.name === 'Ahmet Yilmaz');
  /* A naive split(',') would shift every column after this one. */
  expect(saved.company).toBe('Yilmaz Demir Celik, A.S.');
  expect(saved.country).toBe('Turkey');
});

test('@robot DeskItem21_accents_and_turkish_spelling_are_the_same_person', async ({ page }) => {
  await app.openApp(page);
  /* Same man, three exports: accented, unaccented, and Turkish dotless i. Same
     mobile written three ways. One contact, not three. */
  const body = [
    'Full Name,Company,Mobile Phone,City,Country',
    'Hans Günther,Rheinstahl GmbH,+49 170 5550101,Duisburg,Germany',
    'Hans Gunther,Rheinstahl GmbH,0049 170 5550101,Duisburg,Germany',
    'Ahmet Yılmaz,Yilmaz Demir Celik A.S.,+90 532 555 0143,Iskenderun,Turkey',
    'Ahmet Yilmaz,Yilmaz Demir Celik AS,0090 532 555 0143,Iskenderun,Turkey'
  ].join('\n');
  await app.importFile(page, fixture('accents.csv', body));

  await verify.waitFor('jericho_contacts', c => /nther|unther/.test(c.name || ''));
  await page.waitForTimeout(600);
  const rows = await verify.readCollection('jericho_contacts');
  expect(rows.length,
    'four rows describing two people should import as two contacts, got: ' +
    rows.map(r => r.name).join(' / ')).toBe(2);
});

test('@robot DeskItem22_one_number_written_three_ways_is_one_number', async ({ page }) => {
  await app.openApp(page);
  const body = [
    'Full Name,Company,Mobile Phone',
    'Chidi Okonkwo,Lagos Metals Ltd,+234 801 555 0199',
    'C. Okonkwo,Lagos Metals,00234 801 555 0199',
    'CHIDI OKONKWO,Lagos Metals Ltd,0801 555 0199'
  ].join('\n');
  await app.importFile(page, fixture('phones.csv', body));

  await verify.waitFor('jericho_contacts', c => /okonkwo/i.test(c.name || ''));
  await page.waitForTimeout(600);
  const rows = await verify.readCollection('jericho_contacts');
  expect(rows.length,
    'one man written three ways should be one contact, got: ' +
    rows.map(r => r.name).join(' / ')).toBe(1);
});

test('@robot DeskItem23_colleagues_with_their_own_mobiles_stay_two_people', async ({ page }) => {
  await app.openApp(page);
  /* THE IMPORTANT ONE. Matching on a shared phone or an initialled name used to
     swallow a real colleague into an existing record, which loses a contact
     rather than duplicating one. */
  const body = [
    'Full Name,Company,E-mail Address,Mobile Phone',
    'Ahmet Yilmaz,Yilmaz Demir Celik A.S.,ahmet@yilmazdemir.com.tr,+90 532 555 0143',
    'Ayse Yilmaz,Yilmaz Demir Celik A.S.,ayse@yilmazdemir.com.tr,+90 532 555 0288',
    'A. Yilmaz,Yilmaz Demir Celik A.S.,,+90 532 555 0411'
  ].join('\n');
  await app.importFile(page, fixture('colleagues.csv', body));

  await verify.waitFor('jericho_contacts', c => c.name === 'Ahmet Yilmaz');
  await page.waitForTimeout(600);
  const rows = await verify.readCollection('jericho_contacts');
  expect(rows.length,
    'three colleagues at one firm with their own mobiles must stay three contacts, got: ' +
    rows.map(r => r.name).join(' / ')).toBe(3);
});

test('@robot DeskItem24_two_people_sharing_a_company_inbox_stay_two_people', async ({ page }) => {
  await app.openApp(page);
  /* Small firms print info@ on every card, so a shared address is not proof of
     being the same person. */
  const body = [
    'Full Name,Company,E-mail Address,Mobile Phone',
    'Mehmet Demir,Yilmaz Demir Celik A.S.,info@yilmazdemir.com.tr,+90 326 555 0100',
    'Fatma Kaya,Yilmaz Demir Celik A.S.,info@yilmazdemir.com.tr,+90 326 555 0100'
  ].join('\n');
  await app.importFile(page, fixture('inbox.csv', body));

  await verify.waitFor('jericho_contacts', c => c.name === 'Mehmet Demir');
  await page.waitForTimeout(600);
  const rows = await verify.readCollection('jericho_contacts');
  expect(rows.length,
    'two colleagues sharing one inbox must stay two contacts, got: ' +
    rows.map(r => r.name).join(' / ')).toBe(2);
});

test('@robot DeskItem25_imported_contacts_reach_the_database', async ({ page }) => {
  await app.openApp(page);
  await app.importFile(page, fixture('phone.vcf', VCF));

  /* Read back from the database rather than the screen, and check the fields
     survived the trip rather than only the names. */
  const hans = await verify.waitFor('jericho_contacts', c => /G.{0,2}nther/.test(c.name || ''),
    { label: 'the accented contact in the database' });
  expect(hans.email).toBe('hans@rheinstahl.de');
  expect(hans.company).toBe('Rheinstahl GmbH');
  expect(hans.trust, 'an imported contact starts at Unknown trust').toBe('Unknown');
  expect(hans.kyc, 'an imported contact starts with no KYC').toBe('No KYC');
});
