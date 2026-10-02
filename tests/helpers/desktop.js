/*
 * THE ROBOT USER - DESKTOP APP (index.html)
 *
 * The companion robot in app.js drives the phone app. This one drives the
 * desktop CRM, and follows the same two rules: every action here is a real
 * click on a real button, and nothing here checks whether an action worked.
 * Checking is the independent verifier's job, so a test can never pass because
 * the app said so.
 */

const sandboxAccount = require('./sandbox-account');

/** Open the desktop app, get through the password gate, wait until signed in. */
async function openApp(page) {
  const errors = [];

  /*
   * KNOWN ENVIRONMENT LIMITATION - the same one app.js documents, for the same
   * reason. Firebase Auth fetches a helper from apis.google.com, which this
   * machine blocks at the network level. It would not fail on Rafael's iPad.
   * Sign-in still succeeds. Only this host with this exact failure is ignored.
   */
  const isBlockedByEnvironment = (url, reason) =>
    url.startsWith('https://apis.google.com/') && /ERR_TUNNEL_CONNECTION_FAILED/.test(reason || '');

  page.on('pageerror', e => errors.push('script error: ' + e));
  page.on('requestfailed', r => {
    const reason = (r.failure() && r.failure().errorText) || 'unknown';
    if (isBlockedByEnvironment(r.url(), reason)) return;
    errors.push('could not load ' + r.url() + ' (' + reason + ')');
  });
  page.on('response', r => {
    if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' for ' + r.url());
  });
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });

  await page.goto('/.robot/index.test.html');

  const isTestBuild = await page.evaluate(() => window.__ROBOT_TEST_BUILD__ === true);
  if (!isTestBuild) throw new Error('SAFETY STOP: not the sandbox build - refusing to continue.');

  // Through the gate the way a person does: type the password, press Unlock.
  const lockScreen = page.locator('#lockScreen');
  if (await lockScreen.isVisible()) {
    await page.fill('#lockPass', sandboxAccount.password);
    await page.click('#lockBtn');

    await Promise.race([
      page.waitForFunction(() => window._fbReady === true, null, { timeout: 60000 }),
      page.waitForFunction(
        () => {
          const e = document.getElementById('lockErr');
          return !!(e && e.textContent.trim());
        },
        null,
        { timeout: 60000 }
      ).then(async () => {
        const msg = await page.locator('#lockErr').textContent();
        throw new Error(
          'the password gate refused the sandbox account: "' + (msg || '').trim() + '". ' +
          'The Auth emulator user is seeded by scripts/run-robot.js - check that step ran.'
        );
      })
    ]);
  }

  await page.waitForFunction(() => window._fbReady === true, null, { timeout: 60000 });
  return errors;
}

/*
 * Wait until the app itself holds the expected number of contacts.
 *
 * Seeding the sandbox database does not mean the app has them yet - they arrive
 * over a Firestore snapshot a moment later. Opening the Map tab before they land
 * builds its filter from an empty book and, because buildMapFilter only ever
 * builds once per session, it stays empty. Two map tests failed on exactly that
 * and looked like missing features.
 */
async function waitForContacts(page, n) {
  await page.waitForFunction(
    expected => typeof contacts !== 'undefined' && contacts.length >= expected,
    n,
    { timeout: 30000 }
  );
}

/** Click the tab of that name in the row under the search bar. */
async function goToTab(page, tab) {
  await page.click(`[onclick="showSection('${tab}',this)"]`);
  await page.waitForTimeout(150);
}

/** The visible headings on the dashboard, in the order they appear. */
async function dashboardHeadings(page) {
  return page.$$eval('#mainContent .section-title', els => els.map(e => e.textContent.trim()));
}

/** The names on the tab buttons, in order. */
async function tabNames(page) {
  return page.$$eval('.nav button', els => els.map(e => e.textContent.trim()));
}

async function addContact(page, { name, company = '', city = '', country = '', email = '', phone = '' }) {
  await goToTab(page, 'contacts');
  await page.click('[onclick="showAddContact()"]');
  await page.fill('#contactName', name);
  if (company) await page.fill('#contactCompany', company);
  if (city) await page.fill('#contactCity', city);
  if (country) await page.fill('#contactCountry', country);
  if (email) await page.fill('#contactEmail', email);
  if (phone) await page.fill('#contactPhone', phone);
  await page.click('[onclick="saveContact()"]');
  await page.waitForTimeout(250);
}

/*
 * Import a file the way Rafael does: open the panel, choose the file, let the
 * preview appear, then press the green button. The file is written to disk by
 * the test and handed to the real <input type="file">, so the browser's own
 * file reading is exercised rather than stubbed.
 */
async function importFile(page, filePath, duplicateMode) {
  await goToTab(page, 'contacts');
  await page.click('[onclick="showImport()"]');
  await page.setInputFiles('#impFile', filePath);
  await page.waitForTimeout(400);
  if (duplicateMode) {
    await page.check(`input[name="impDupe"][value="${duplicateMode}"]`);
    await page.waitForTimeout(150);
  }
  const summary = (await page.textContent('#impSum')) || '';
  await page.click('#impGo');
  await page.waitForTimeout(600);
  return summary.trim();
}

async function openDuplicateFinder(page) {
  await goToTab(page, 'contacts');
  await page.click('[onclick="showDupes()"]');
  await page.waitForTimeout(300);
}

async function addTask(page, { title, due = '', priority = '' }) {
  await goToTab(page, 'tasks');
  await page.click('[onclick="showAddTask()"]');
  await page.fill('#taskTitle', title);
  if (due) await page.fill('#taskDue', due);
  if (priority) await page.selectOption('#taskPriority', priority);
  await page.click('[onclick="saveTask()"]');
  await page.waitForTimeout(250);
}

module.exports = {
  openApp, goToTab, waitForContacts, dashboardHeadings, tabNames,
  addContact, importFile, openDuplicateFinder, addTask
};
