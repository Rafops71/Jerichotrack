/*
 * One command to run the whole thing:
 *   1. build the sandbox copy of the app
 *   2. make sure the local sandbox database is up
 *   3. create the sandbox sign-in account
 *   4. drive the app with the robot user
 *   5. print the tick/cross table and set the exit code
 *
 * Exit code 0 only if every checklist item has a passing test.
 */
const { spawnSync, spawn } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const sandboxAccount = require('../tests/helpers/sandbox-account');

const AUTH_EMULATOR = 'http://127.0.0.1:9099';

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: false, ...opts });

async function emulatorIsUp() {
  try {
    const r = await fetch('http://127.0.0.1:8080/');
    return r.status === 200;
  } catch { return false; }
}

async function authEmulatorIsUp() {
  try {
    const r = await fetch(AUTH_EMULATOR + '/');
    return r.status < 500;
  } catch { return false; }
}

/*
 * The app signs in with a named account now, so the robot needs that account to
 * exist in the sandbox before it can get past the password gate. This creates
 * it in the local Auth emulator, which needs no real credentials and accepts
 * any api key. The account is local-only and dies with the emulator.
 *
 * Returning false rather than throwing: the caller stops the run, because a
 * missing account would otherwise show up as 46 unexplained sign-in timeouts.
 */
async function seedSandboxAccount() {
  const url = AUTH_EMULATOR +
    '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=sandbox-no-real-key';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: sandboxAccount.email,
        password: sandboxAccount.password,
        returnSecureToken: true
      })
    });
    if (resp.ok) return true;

    const body = await resp.json().catch(() => ({}));
    const reason = (body.error && body.error.message) || ('HTTP ' + resp.status);
    // A reused emulator from an earlier run already has the account. Fine.
    if (reason === 'EMAIL_EXISTS') return true;
    console.error('      FAILED to create the sandbox account: ' + reason);
    return false;
  } catch (e) {
    console.error('      FAILED to reach the Auth emulator: ' + e.message);
    return false;
  }
}

(async () => {
  /*
   * Which app to test. Both are tested by default, because a change to one has
   * caught a break in the other before now. Narrow it when iterating:
   *   node scripts/run-robot.js companion
   *   node scripts/run-robot.js desktop
   */
  const only = (process.argv[2] || '').toLowerCase();
  if (only && only !== 'companion' && only !== 'desktop') {
    console.error('Unknown app "' + only + '". Use companion, desktop, or nothing for both.');
    process.exit(1);
  }
  const doCompanion = only !== 'desktop';
  const doDesktop = only !== 'companion';

  console.log('\n[1/5] Building the sandbox copies of the apps...');
  if (doCompanion && run('node', ['scripts/build-test-page.js', 'companion.html']).status !== 0) process.exit(1);
  if (doDesktop && run('node', ['scripts/build-test-page.js', 'index.html']).status !== 0) process.exit(1);

  console.log('\n[2/5] Checking the local sandbox database...');
  let up = await emulatorIsUp();
  let emulator = null;
  if (!up) {
    console.log('      not running - starting it');
    /*
     * --config firebase.emulator.json, NOT the default firebase.json. The
     * production rules name Rafael's real account id, so inside the emulator -
     * where the sandbox account has a different id - every write is refused and
     * both apps look broken for a reason that is not their fault.
     */
    emulator = spawn('npx', ['firebase', 'emulators:start', '--project', 'jericho-test',
                             '--config', 'firebase.emulator.json',
                             '--only', 'firestore,auth'],
                     { cwd: ROOT, stdio: 'ignore', detached: false });
    for (let i = 0; i < 60 && !up; i++) {
      await new Promise(r => setTimeout(r, 1000));
      up = await emulatorIsUp();
    }
  }
  if (!up) {
    console.error('      FAILED: the sandbox database never came up. Nothing was tested.');
    if (emulator) emulator.kill();
    process.exit(1);
  }
  console.log('      sandbox ready on 127.0.0.1:8080');

  console.log('\n[3/5] Creating the sandbox sign-in account...');
  let authUp = false;
  for (let i = 0; i < 30 && !authUp; i++) {
    authUp = await authEmulatorIsUp();
    if (!authUp) await new Promise(r => setTimeout(r, 1000));
  }
  if (!authUp) {
    console.error('      FAILED: the Auth emulator never came up. Nothing was tested.');
    if (emulator) emulator.kill();
    process.exit(1);
  }
  if (!await seedSandboxAccount()) {
    console.error('      Nothing was tested: without this account the app cannot sign in.');
    if (emulator) emulator.kill();
    process.exit(1);
  }
  console.log('      ' + sandboxAccount.email + ' ready in the sandbox');

  console.log('\n[4/5] Running the robot user...');
  const projects = [];
  if (doCompanion) projects.push('--project=companion');
  if (doDesktop) projects.push('--project=desktop');
  run('npx', ['playwright', 'test'].concat(projects));

  console.log('\n[5/5] Report');
  const report = run('node', ['scripts/report.js'].concat(only ? [only] : []));

  if (emulator) emulator.kill();
  process.exit(report.status === 0 ? 0 : 1);
})();
