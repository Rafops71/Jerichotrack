/*
 * THE ROBOT USER
 *
 * Every action here is a real tap on a real button in the real app, exactly
 * as a person would do it. Nothing here reaches into the app's internals to
 * take a shortcut, and nothing here checks whether an action worked - that is
 * the independent verifier's job.
 */

const sandboxAccount = require('./sandbox-account');

/** Open the app, get through the password gate, and wait until it has signed in. */
async function openApp(page) {
  const errors = [];

  /*
   * KNOWN ENVIRONMENT DIFFERENCE - handled by removing it, not by ignoring it.
   *
   * Firebase Auth pulls a helper script from apis.google.com for its popup and
   * redirect sign-in flows. This app uses neither: it signs in with an email and
   * password, so the script does nothing for us. The machine the robot runs on
   * blocks that host at the network level, so the request fails here and would
   * NOT fail on a real phone.
   *
   * This used to be an exception in the error collector below, ignoring that one
   * host with one error text. That was fragile: the same block produced
   * ERR_TOO_MANY_RETRIES instead of ERR_TUNNEL_CONNECTION_FAILED and Item01 duly
   * went red for an environment reason. Maintaining a list of spellings of
   * "unreachable" means the assertion slowly stops meaning "nothing failed".
   *
   * So the request is stubbed with an empty script instead. It never reaches the
   * network, there is no failure to ignore, and the collector below is now
   * absolute: ANY failed request fails the test, this host included.
   */
  await page.route('https://apis.google.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: ''
  }));

  page.on('pageerror', e => errors.push('script error: ' + e));
  page.on('requestfailed', r => {
    const reason = (r.failure() && r.failure().errorText) || 'unknown';
    errors.push('could not load ' + r.url() + ' (' + reason + ')');
  });
  page.on('response', r => {
    if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' for ' + r.url());
  });
  page.on('console', m => {
    // The browser's own generic "Failed to load resource" echoes a requestfailed
    // or a 4xx we already record above with the actual URL, so drop the duplicate.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });

  await page.goto('/.robot/companion.test.html');

  // Refuse to run against anything but the sandbox build.
  const isTestBuild = await page.evaluate(() => window.__ROBOT_TEST_BUILD__ === true);
  if (!isTestBuild) throw new Error('SAFETY STOP: not the sandbox build - refusing to continue.');

  /*
   * Get through the password gate the same way a person does: type the password
   * and press Unlock. Nothing here reaches into the app to sign in behind the
   * gate's back, so the gate itself is now exercised on every single test.
   *
   * The gate is shown until Firebase reports a signed-in account, so on a fresh
   * browser context it is always up. If a future change signs the robot in
   * some other way, this skips rather than failing.
   */
  const lockScreen = page.locator('#lockScreen');
  if (await lockScreen.isVisible()) {
    await page.fill('#lockPass', sandboxAccount.password);
    await page.click('#lockBtn');

    /*
     * A wrong password leaves the gate up with a message, which would otherwise
     * surface 60s later as an unexplained sign-in timeout. Say what happened.
     */
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

  /*
   * A single page signs in to the local sandbox in about 200ms. Under a full
   * suite run - dozens of fresh browser contexts, each fetching the Firebase
   * bundle and signing in again - it can occasionally take far longer, and a
   * 20s limit made random tests fail with no app fault.
   *
   * This is the harness waiting longer, not the check being softened: the
   * assertion is still "the app signs in", and a page that never signs in
   * still fails.
   */
  await page.waitForFunction(() => window._fbReady === true, null, { timeout: 60000 });
  return errors;
}

const tap = (page, onclick) => page.click(`[onclick="${onclick}"]`);

async function addLead(page, { name, company = '', note = '' }) {
  await tap(page, 'openLeadSheet()');
  await page.fill('#qlName', name);
  if (company) await page.fill('#qlCompany', company);
  if (note) await page.fill('#qlNote', note);
  await tap(page, 'saveQuickLead()');
}

async function addNote(page, text) {
  await tap(page, 'openNoteSheet()');
  await page.fill('#noteText', text);
  await tap(page, 'saveNote()');
}

async function addAction(page, { title, note = '', date = '' }) {
  await tap(page, 'openActionSheet()');
  await page.fill('#actionTitle', title);
  if (note) await page.fill('#actionNote', note);
  if (date) await page.fill('#actionDate', date);
  await tap(page, 'saveAction()');
}

async function goToScreen(page, screen) {
  await page.click(`[onclick="showScreen('${screen}',this)"]`);
}

module.exports = { openApp, tap, addLead, addNote, addAction, goToScreen };
