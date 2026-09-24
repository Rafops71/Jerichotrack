/*
 * THE ROBOT USER
 *
 * Every action here is a real tap on a real button in the real app, exactly
 * as a person would do it. Nothing here reaches into the app's internals to
 * take a shortcut, and nothing here checks whether an action worked - that is
 * the independent verifier's job.
 */

/** Open the app and wait until it has signed in to the sandbox. */
async function openApp(page) {
  const errors = [];

  /*
   * KNOWN ENVIRONMENT LIMITATION - not an app bug, and deliberately narrow.
   *
   * Firebase Auth loads a helper script from apis.google.com. The machine the
   * robot runs on blocks that host at the network level, so the request fails
   * here and would NOT fail on a real phone. Anonymous sign-in still succeeds
   * (Item02 proves it). Only this exact host with this exact failure is
   * ignored; every other failed request still fails the test.
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
    // The browser's own generic "Failed to load resource" echoes a requestfailed
    // or a 4xx we already record above with the actual URL, so drop the duplicate.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });

  await page.goto('/.robot/companion.test.html');

  // Refuse to run against anything but the sandbox build.
  const isTestBuild = await page.evaluate(() => window.__ROBOT_TEST_BUILD__ === true);
  if (!isTestBuild) throw new Error('SAFETY STOP: not the sandbox build - refusing to continue.');

  /*
   * A single page signs in to the local sandbox in about 200ms. Under a full
   * suite run - dozens of fresh browser contexts, each fetching the Firebase
   * bundle and creating its own anonymous user - it can occasionally take far
   * longer, and a 20s limit made random tests fail with no app fault.
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
