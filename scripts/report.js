/*
 * Turns the robot's results into a tick/cross table, one line per checklist
 * item, and FAILS if any item has no passing test.
 *
 * It is driven by the approved checklist, not by the test files, so deleting a
 * test does not make an item disappear - it turns it into a cross.
 */
const fs = require('fs');
const path = require('path');
const CHECKLIST = require('../tests/checklist');

const RESULTS = path.join(__dirname, '..', '.robot', 'results.json');
if (!fs.existsSync(RESULTS)) {
  console.error('No results found at .robot/results.json - run the robot first (npm run robot).');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));

/* Flatten Playwright's nested report into { ItemNN: status }. */
const outcomes = {};
const flakes = new Set();
(function walk(suites) {
  for (const s of suites || []) {
    for (const spec of s.specs || []) {
      const m = /Item(\d{2})/.exec(spec.title);
      if (!m) continue;
      const n = Number(m[1]);
      // A test may be retried. It counts as passing only if its final attempt
      // passed, and as FLAKY if it needed more than one attempt - which is
      // shown, not swallowed.
      let ok = true, flaky = false;
      for (const t of (spec.tests || [])) {
        const res = t.results || [];
        if (!res.length) { ok = false; continue; }
        if (res[res.length - 1].status !== 'passed') ok = false;
        else if (res.length > 1) flaky = true;
      }
      outcomes[n] = outcomes[n] === false ? false : ok;
      if (flaky) flakes.add(n);
    }
    walk(s.suites);
  }
})(raw.suites);

const PASS = '✓', FAIL = '✗', MANUAL = '—';
const rows = [];
let covered = 0, failed = 0, uncovered = 0;
let lastGroup = null;

for (const item of CHECKLIST) {
  const result = outcomes[item.n];
  let mark, note = '';
  if (result === true) { mark = PASS; covered++; if (flakes.has(item.n)) note = 'FLAKY - passed on retry'; }
  else if (result === false) { mark = FAIL; failed++; note = 'TEST FAILING'; }
  else if (item.manual) { mark = MANUAL; uncovered++; note = 'NOT CHECKED BY ROBOT'; }
  else { mark = FAIL; uncovered++; note = 'NO TEST'; }
  rows.push({ item, mark, note, group: item.group });
}

const width = Math.max(...CHECKLIST.map(i => i.text.length));
console.log('\n  JERICHO COMPANION - ROBOT USER REPORT');
console.log('  ' + new Date().toISOString().replace('T', ' ').slice(0, 16) + '\n');
for (const r of rows) {
  if (r.group !== lastGroup) { console.log('  ' + r.group.toUpperCase()); lastGroup = r.group; }
  const n = String(r.item.n).padStart(2, '0');
  console.log(`   ${r.mark}  ${n}  ${r.item.text.padEnd(width)}  ${r.note}`);
}

console.log('\n  ' + '-'.repeat(width + 20));
console.log(`  passing: ${covered}/${CHECKLIST.length}   failing: ${failed}   not covered: ${uncovered}`);

if (flakes.size) {
  console.log(`  flaky: ${flakes.size} item(s) needed a second attempt - see FLAKY above.`);
}
for (const r of rows) {
  if (r.mark === MANUAL) console.log(`  note  ${String(r.item.n).padStart(2, '0')}: ${r.item.manual}`);
}

if (failed || uncovered) {
  console.log('\n  GATE: FAILED - not every function on the checklist has a passing test.\n');
  process.exit(1);
}
console.log('\n  GATE: PASSED - every function on the checklist has a passing test.\n');
