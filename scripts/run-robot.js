/*
 * One command to run the whole thing:
 *   1. build the sandbox copy of the app
 *   2. make sure the local sandbox database is up
 *   3. drive the app with the robot user
 *   4. print the tick/cross table and set the exit code
 *
 * Exit code 0 only if every checklist item has a passing test.
 */
const { spawnSync, spawn } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: false, ...opts });

async function emulatorIsUp() {
  try {
    const r = await fetch('http://127.0.0.1:8080/');
    return r.status === 200;
  } catch { return false; }
}

(async () => {
  console.log('\n[1/4] Building the sandbox copy of the app...');
  if (run('node', ['scripts/build-test-page.js']).status !== 0) process.exit(1);

  console.log('\n[2/4] Checking the local sandbox database...');
  let up = await emulatorIsUp();
  let emulator = null;
  if (!up) {
    console.log('      not running - starting it');
    emulator = spawn('npx', ['firebase', 'emulators:start', '--project', 'jericho-test',
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

  console.log('\n[3/4] Running the robot user...');
  run('npx', ['playwright', 'test']);

  console.log('\n[4/4] Report');
  const report = run('node', ['scripts/report.js']);

  if (emulator) emulator.kill();
  process.exit(report.status === 0 ? 0 : 1);
})();
