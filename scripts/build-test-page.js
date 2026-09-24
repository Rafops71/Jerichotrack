/*
 * Builds the page the robot user drives.
 *
 * This is NOT a mock and NOT a rewrite. It takes the real companion.html,
 * byte for byte, and inserts exactly two lines that point the Firebase SDK at
 * the local sandbox instead of the live cloud database. Every other line of
 * app code - all the buttons, all the saving, all the rendering - is the real
 * thing. companion.html itself is never modified.
 *
 * If this script cannot find the anchor lines it expects, it fails loudly
 * rather than silently producing a page that talks to the live database.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'companion.html');
const OUT_DIR = path.join(ROOT, '.robot');
const OUT = path.join(OUT_DIR, 'companion.test.html');

const FIRESTORE_IMPORT = 'enableIndexedDbPersistence\n}';
const AUTH_ANCHOR = 'const auth = getAuth(fbApp);';

let html = fs.readFileSync(SRC, 'utf8');

if (!html.includes(AUTH_ANCHOR)) {
  console.error('FATAL: could not find the Firebase setup line in companion.html.');
  console.error('The app file has changed shape. Fix this script rather than guessing.');
  process.exit(1);
}
if (!html.includes(FIRESTORE_IMPORT)) {
  console.error('FATAL: could not find the Firestore import block in companion.html.');
  process.exit(1);
}

// Pull in the two emulator-connection functions alongside the existing imports.
html = html.replace(
  FIRESTORE_IMPORT,
  'enableIndexedDbPersistence, connectFirestoreEmulator\n}'
);
html = html.replace(
  'getAuth, signInAnonymously, onAuthStateChanged',
  'getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator'
);

// Point them at the local sandbox. Must happen before any read or write.
html = html.replace(
  AUTH_ANCHOR,
  AUTH_ANCHOR +
  '\n/* ROBOT TEST BUILD - local sandbox only, never the live database */\n' +
  "connectFirestoreEmulator(db, '127.0.0.1', 8080);\n" +
  "connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });\n" +
  "window.__ROBOT_TEST_BUILD__ = true;"
);

// Repoint the project id at the sandbox. This is a SAFETY measure as much as a
// plumbing one: if the emulator wiring ever failed silently, the app would try
// to reach a cloud project called "jericho-test" - which does not exist - rather
// than writing into the real jericho-operation CRM.
if (!html.includes('projectId: "jericho-operation"')) {
  console.error('FATAL: could not find the project id in companion.html.');
  process.exit(1);
}
html = html.replace('projectId: "jericho-operation"', 'projectId: "jericho-test"');
html = html.replace('authDomain: "jericho-operation.firebaseapp.com"', 'authDomain: "jericho-test.firebaseapp.com"');
html = html.replace('storageBucket: "jericho-operation.firebasestorage.app"', 'storageBucket: "jericho-test.firebasestorage.app"');

// Serve the Firebase SDK from the local bundle instead of the gstatic CDN.
// Same library, same version - only the delivery path changes, so that the
// robot can run with no internet access at all.
const CDN = /https:\/\/www\.gstatic\.com\/firebasejs\/10\.13\.0\/firebase-(app|firestore|auth)\.js/g;
const cdnHits = (html.match(CDN) || []).length;
if (cdnHits !== 3) {
  console.error('FATAL: expected 3 Firebase CDN imports, found ' + cdnHits + '.');
  process.exit(1);
}
html = html.replace(CDN, './vendor/firebase-bundle.js');

// Safety net: the generated page must not be able to reach the real project.
if (html.includes('connectFirestoreEmulator(db') === false) {
  console.error('FATAL: emulator wiring was not inserted.');
  process.exit(1);
}
if (html.includes('gstatic.com')) {
  console.error('FATAL: a CDN reference survived into the sandbox build.');
  process.exit(1);
}
if (html.includes('jericho-operation')) {
  console.error('FATAL: the sandbox build still references the live project. Refusing to write it.');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);
console.log('Built ' + path.relative(ROOT, OUT) + ' (' + html.length + ' bytes) -> sandbox at 127.0.0.1:8080');
