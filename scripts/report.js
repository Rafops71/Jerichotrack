/*
 * Turns the robot's results into a tick/cross table, one line per checklist
 * item, and FAILS if any item has no passing test.
 *
 * It is driven by the approved checklists, not by the test files, so deleting a
 * test does not make an item disappear - it turns it into a cross.
 *
 * Two apps, two checklists, two tables. The companion app's tests are titled
 * ItemNN and the desktop app's DeskItemNN, so one results file holds both
 * without their numbers colliding.
 *
 *   node scripts/report.js            both tables
 *   node scripts/report.js desktop    the desktop table only
 */
const fs = require('fs');
const path = require('path');

const APPS = [
  { key: 'companion', title: 'JERICHO COMPANION (phone)', prefix: 'Item',     checklist: require('../tests/checklist') },
  { key: 'desktop',   title: 'JERICHOTRACK (desktop)',    prefix: 'DeskItem', checklist: require('../tests/desktop-checklist') }
];

const only = (process.argv[2] || '').toLowerCase();
const apps = only ? APPS.filter(a => a.key === only) : APPS;
if (!apps.length) {
  console.error('Unknown app "' + only + '". Use companion, desktop, or nothing for both.');
  process.exit(1);
}

const RESULTS = path.join(__dirname, '..', '.robot', 'results.json');
if (!fs.existsSync(RESULTS)) {
  console.error('No results found at .robot/results.json - run the robot first (npm run robot).');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));

/*
 * Flatten Playwright's nested report into { prefix: { NN: status } }.
 *
 * "DeskItem07" also contains the text "Item07", so the longer prefix has to be
 * tried first or every desktop test would be filed as a companion one.
 */
const outcomes = {}; const flakes = {};
for (const a of APPS) { outcomes[a.prefix] = {}; flakes[a.prefix] = new Set(); }
const PREFIXES = APPS.map(a => a.prefix).sort((x, y) => y.length - x.length);

(function walk(suites) {
  for (const s of suites || []) {
    for (const spec of s.specs || []) {
      const prefix = PREFIXES.find(p => new RegExp(p + '\\d{2}').test(spec.title));
      if (!prefix) continue;
      const n = Number(new RegExp(prefix + '(\\d{2})').exec(spec.title)[1]);

      // A test may be retried. It counts as passing only if its final attempt
      // passed, and as FLAKY if it needed more than one attempt - shown, not
      // swallowed.
      let ok = true, flaky = false;
      for (const t of (spec.tests || [])) {
        const res = t.results || [];
        if (!res.length) { ok = false; continue; }
        if (res[res.length - 1].status !== 'passed') ok = false;
        else if (res.length > 1) flaky = true;
      }
      outcomes[prefix][n] = outcomes[prefix][n] === false ? false : ok;
      if (flaky) flakes[prefix].add(n);
    }
    walk(s.suites);
  }
})(raw.suites);

const PASS = '✓', FAIL = '✗', MANUAL = '—';
let anyFailed = false;

console.log('\n  ROBOT USER REPORT');
console.log('  ' + new Date().toISOString().replace('T', ' ').slice(0, 16));

for (const appDef of apps) {
  const { checklist, prefix } = appDef;
  const got = outcomes[prefix], flaked = flakes[prefix];
  const rows = [];
  let covered = 0, failed = 0, uncovered = 0, drafts = 0;

  for (const item of checklist) {
    const result = got[item.n];
    let mark, note = '';
    if (result === true) { mark = PASS; covered++; if (flaked.has(item.n)) note = 'FLAKY - passed on retry'; }
    else if (result === false) { mark = FAIL; failed++; note = 'TEST FAILING'; }
    else if (item.manual) { mark = MANUAL; uncovered++; note = 'NOT CHECKED BY ROBOT'; }
    else { mark = FAIL; uncovered++; note = 'NO TEST'; }
    if (item.draft) { drafts++; note = (note ? note + ' · ' : '') + 'WORDING NOT YET APPROVED'; }
    rows.push({ item, mark, note, group: item.group });
  }

  const width = Math.max(...checklist.map(i => i.text.length));
  console.log('\n  ' + '='.repeat(width + 20));
  console.log('  ' + appDef.title);
  console.log('  ' + '='.repeat(width + 20) + '\n');

  let lastGroup = null;
  for (const r of rows) {
    if (r.group !== lastGroup) { console.log('  ' + r.group.toUpperCase()); lastGroup = r.group; }
    const n = String(r.item.n).padStart(2, '0');
    console.log(`   ${r.mark}  ${n}  ${r.item.text.padEnd(width)}  ${r.note}`);
  }

  console.log('\n  ' + '-'.repeat(width + 20));
  console.log(`  passing: ${covered}/${checklist.length}   failing: ${failed}   not covered: ${uncovered}`);
  if (flaked.size) console.log(`  flaky: ${flaked.size} item(s) needed a second attempt - see FLAKY above.`);
  if (drafts) console.log(`  draft: ${drafts} item(s) were written by Claude and Rafael has not corrected them yet.`);
  for (const r of rows) {
    if (r.mark === MANUAL) console.log(`  note  ${String(r.item.n).padStart(2, '0')}: ${r.item.manual}`);
  }
  if (failed || uncovered) anyFailed = true;
}

if (anyFailed) {
  console.log('\n  GATE: FAILED - not every function on the checklists has a passing test.\n');
  process.exit(1);
}
console.log('\n  GATE: PASSED - every function on the checklists has a passing test.\n');
