/*
 * Builds the page the robot user drives.
 *
 * This is NOT a mock and NOT a rewrite. It takes the real companion.html,
 * byte for byte, and inserts exactly the lines that point the Firebase SDK at
 * the local sandbox instead of the live cloud database. Every other line of
 * app code - all the buttons, all the saving, all the rendering - is the real
 * thing. companion.html itself is never modified.
 *
 * If this script cannot do what it expects, it fails loudly rather than
 * silently producing a page that cannot run, or one that talks to the live
 * database. That rule is enforced by mustReplace() below: every single edit is
 * checked, and an edit that matched nothing is fatal.
 *
 * WHY THAT MATTERS. This script used to patch the auth import by searching for
 * the literal string 'getAuth, signInAnonymously, onAuthStateChanged'. When the
 * password gate replaced anonymous sign-in with signInWithEmailAndPassword, that
 * search quietly matched nothing. The build still exited 0, but the page it
 * produced called connectAuthEmulator() without importing it - so the module
 * threw on load, window.__ROBOT_TEST_BUILD__ was never set, and all 46 tests
 * stopped at the safety check in tests/helpers/app.js with no clue why.
 *
 * So nothing here hardcodes a list of Firebase symbols any more. The import
 * blocks are parsed out of companion.html, and the local SDK bundle is
 * generated to re-export exactly what the app actually imports. Change the
 * app's imports and this follows automatically; break the parse and the build
 * stops.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'companion.html');
const OUT_DIR = path.join(ROOT, '.robot');
const OUT = path.join(OUT_DIR, 'companion.test.html');
const VENDOR_SRC = path.join(OUT_DIR, 'vendor-entry.js');
const VENDOR_OUT = path.join(OUT_DIR, 'vendor', 'firebase-bundle.js');

const SDK_VERSION = '10.13.0';

function fatal(msg, hint) {
  console.error('FATAL: ' + msg);
  if (hint) console.error('       ' + hint);
  process.exit(1);
}

/*
 * Replace that refuses to be a no-op. Every edit this script makes goes through
 * here, so "the app file changed shape" can never again look like success.
 */
function mustReplace(text, find, replace, what) {
  const parts = text.split(find);
  if (parts.length === 1) {
    fatal('could not find ' + what + ' in companion.html.',
          'The app file has changed shape. Fix this script rather than guessing.');
  }
  if (parts.length > 2) {
    fatal(what + ' appears ' + (parts.length - 1) + ' times in companion.html; expected exactly one.',
          'Patching an ambiguous anchor would put sandbox wiring in the wrong place.');
  }
  return parts[0] + replace + parts[1];
}

let html = fs.readFileSync(SRC, 'utf8');

/* ---- 1. Parse the Firebase import blocks out of the real app ------------- */

/*
 * Matches both shapes companion.html uses:
 *   import { initializeApp } from ".../firebase-app.js";
 *   import {\n  getAuth, signInWithEmailAndPassword, ...\n} from ".../firebase-auth.js";
 */
const IMPORT_RE = new RegExp(
  'import\\s*\\{([^}]*)\\}\\s*from\\s*"https://www\\.gstatic\\.com/firebasejs/' +
  SDK_VERSION.replace(/\./g, '\\.') +
  '/firebase-(app|firestore|auth)\\.js";',
  'g'
);

const imports = {};
for (const m of html.matchAll(IMPORT_RE)) {
  const [block, symbolList, module] = m;
  if (imports[module]) fatal('companion.html imports firebase-' + module + '.js more than once.');
  imports[module] = {
    block,
    symbols: symbolList.split(',').map(s => s.trim()).filter(Boolean)
  };
}

for (const module of ['app', 'firestore', 'auth']) {
  if (!imports[module]) {
    fatal('could not find the firebase-' + module + '.js import in companion.html.',
          'Expected an SDK ' + SDK_VERSION + ' gstatic import. Fix this script if the app moved SDK version.');
  }
}

/* The sandbox needs two functions the live app has no reason to import. */
const EXTRA = { firestore: 'connectFirestoreEmulator', auth: 'connectAuthEmulator' };

/* ---- 2. Add those two to the app's own import blocks --------------------- */

for (const [module, extra] of Object.entries(EXTRA)) {
  const { block, symbols } = imports[module];
  if (symbols.includes(extra)) {
    fatal('companion.html already imports ' + extra + '.',
          'The live app should never import an emulator function.');
  }
  const patched = block.replace(/\}\s*from/, ', ' + extra + '\n} from');
  if (patched === block) fatal('could not add ' + extra + ' to the firebase-' + module + '.js import.');
  html = mustReplace(html, block, patched, 'the firebase-' + module + '.js import block');
  imports[module].symbols = symbols.concat(extra);
}

/* ---- 3. Point the SDK at the local sandbox ------------------------------- */

const AUTH_ANCHOR = 'const auth = getAuth(fbApp);';

html = mustReplace(
  html,
  AUTH_ANCHOR,
  AUTH_ANCHOR +
  '\n/* ROBOT TEST BUILD - local sandbox only, never the live database */\n' +
  "connectFirestoreEmulator(db, '127.0.0.1', 8080);\n" +
  "connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });\n" +
  'window.__ROBOT_TEST_BUILD__ = true;',
  'the Firebase setup line'
);

/*
 * Repoint the project id at the sandbox. This is a SAFETY measure as much as a
 * plumbing one: if the emulator wiring ever failed silently, the app would try
 * to reach a cloud project called "jericho-test" - which does not exist - rather
 * than writing into the real jericho-operation CRM.
 */
html = mustReplace(html, 'projectId: "jericho-operation"', 'projectId: "jericho-test"', 'the project id');
html = mustReplace(html, 'authDomain: "jericho-operation.firebaseapp.com"',
                   'authDomain: "jericho-test.firebaseapp.com"', 'the auth domain');
html = mustReplace(html, 'storageBucket: "jericho-operation.firebasestorage.app"',
                   'storageBucket: "jericho-test.firebasestorage.app"', 'the storage bucket');

/* ---- 4. Serve the SDK from a local bundle instead of the gstatic CDN ----- */

/*
 * Same library, same version - only the delivery path changes, so that the
 * robot can run with no internet access at all. The bundle is generated below
 * from the symbol lists parsed above, so it cannot drift out of step with what
 * the app imports.
 */
const CDN = new RegExp(
  'https://www\\.gstatic\\.com/firebasejs/' + SDK_VERSION.replace(/\./g, '\\.') +
  '/firebase-(app|firestore|auth)\\.js',
  'g'
);
const cdnHits = (html.match(CDN) || []).length;
if (cdnHits !== 3) fatal('expected 3 Firebase CDN imports, found ' + cdnHits + '.');
html = html.replace(CDN, './vendor/firebase-bundle.js');

/* ---- 5. Generate and bundle that local SDK copy -------------------------- */

const vendorEntry =
  '/* GENERATED by scripts/build-test-page.js - do not edit.\n' +
  '   Re-exports exactly the Firebase symbols companion.html imports, plus the\n' +
  '   two emulator-connection functions the sandbox build needs. Same SDK, same\n' +
  '   version (' + SDK_VERSION + ') as the CDN the live app uses - just served locally so\n' +
  '   the robot can run without internet access. */\n' +
  ['app', 'firestore', 'auth'].map(module =>
    'export {\n  ' + imports[module].symbols.join(', ') + "\n} from 'firebase/" + module + "';"
  ).join('\n') + '\n';

fs.mkdirSync(path.dirname(VENDOR_OUT), { recursive: true });
fs.writeFileSync(VENDOR_SRC, vendorEntry);

let esbuild;
try {
  esbuild = require('esbuild');
} catch {
  fatal('esbuild is not installed, so the local Firebase bundle cannot be built.',
        'Run `npm ci` first.');
}

const built = esbuild.buildSync({
  entryPoints: [VENDOR_SRC],
  outfile: VENDOR_OUT,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  logLevel: 'silent'
});
if (built.errors && built.errors.length) {
  console.error(built.errors.map(e => e.text).join('\n'));
  fatal('could not bundle the local Firebase SDK.');
}

/* ---- 6. Safety net: the page must not be able to reach the real project -- */

if (!html.includes('connectFirestoreEmulator(db')) fatal('emulator wiring was not inserted.');
if (!html.includes('window.__ROBOT_TEST_BUILD__ = true;')) fatal('the sandbox marker was not inserted.');
if (html.includes('gstatic.com')) fatal('a CDN reference survived into the sandbox build.');
if (html.includes('jericho-operation')) {
  fatal('the sandbox build still references the live project. Refusing to write it.');
}

/*
 * The bug this script shipped for a month was an import that was called but
 * never imported, which only showed up as a runtime error inside the browser.
 * So check it here, where it is cheap: every emulator function the page calls
 * must appear in the bundle's exports.
 */
const bundleText = fs.readFileSync(VENDOR_OUT, 'utf8');
for (const extra of Object.values(EXTRA)) {
  if (!html.includes(extra)) fatal(extra + ' is missing from the sandbox build.');
  if (!bundleText.includes(extra)) {
    fatal(extra + ' is not exported by the local Firebase bundle.',
          'The page would throw on load and every test would stop at the safety check.');
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);
console.log('Built ' + path.relative(ROOT, OUT) + ' (' + html.length + ' bytes) -> sandbox at 127.0.0.1:8080');
console.log('Built ' + path.relative(ROOT, VENDOR_OUT) + ' (' + bundleText.length + ' bytes) from the app\'s own imports');
