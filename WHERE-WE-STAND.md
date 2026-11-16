# Where JerichoTrack stands — 16/11/2026

Written before compacting a long session, so none of it depends on memory.
Everything here was checked against the repo or the live site, not recalled.

## The app is live and healthy

`https://rafops71.github.io/Jerichotrack/` answers, and the Cloudflare price
worker answers. GitHub Pages serves `main`, so merging to `main` IS the deploy.
Last change was 18/10/2026. Nothing has touched it since.

Three apps on `main`: `index.html` (desktop CRM), `companion.html` (phone),
`Diligence.html` (standalone, deliberately untouched since 30/09).

## What was fixed on 18/10 and is now live

Nine faults, each found by testing rather than guessed at, each with a test so
it cannot return quietly:

- Find Duplicates compared every contact against every other: 19.4 SECONDS
  frozen at 2000 contacts, with the click timing out. Now buckets candidates on
  email, phone and company+surname; under 3 seconds, same pairs reported.
- A contact name containing markup RAN as code inside the signed-in app, and a
  company field with a stray `</td></tr>` split the table. 98 interpolations now
  go through `esc()`. companion.html had escaped text in 52 places all along;
  index.html escaped nowhere.
- Damaged saved data threw at the top level and left a BLANK SCREEN on startup.
  Now read through `readSaved()`, and unreadable text is kept as
  `<key>.broken` rather than discarded.
- A full device threw out of the save button. Now reported in plain words, and
  the cloud write still proceeds.
- One bad record took down a whole tab. Each render now runs through `safely()`.
- Any fault at all left the app silent. A fatal-error banner is now the first
  script on the page.
- The map hung forever on "Loading map...". Now 20s per step, says what failed,
  offers Try again.
- The map's dropdown was built once per visit and missed contacts that synced
  late. Now rebuilt when the book changes, keeping the chosen filter.
- The sync pill read "Synced — Live" while offline, because every snapshot set
  it, cache ones included. Now reads `snapshot.metadata`; shows
  "Not yet in the cloud" until the server has it.

## The robot

`node scripts/run-robot.js` runs both apps; `desktop` or `companion` narrows it.

- Desktop: 57 checklist items, **56 passing, 0 failing** at last run.
- Companion: 50 items, **46 passing, 0 failing**.
- The gate reads FAILED by design. Desktop item 47 (type a wrong password,
  confirm nothing is readable) needs a person. Four companion dictation items
  need a real microphone.

Harness traps already paid for, do not rediscover them:

- The emulator's debug logs grow ~30GB in a single 2000-contact run. They are
  symlinked to /dev/null in `run-robot.js`. The runner also refuses to start
  under 500MB free.
- Readiness requires BOTH ports (8080 and 9099). An orphaned emulator answering
  on 8080 alone used to make the runner skip setup and fail later.
- `verify.wipe()` treats HTTP 409 as "busy", not "broken".
- `seedMany` uses one `:commit` per 400 docs; one request per document was slow
  enough to blow the test timeout and look like the app being slow.
- The map draws on a CANVAS, not an svg. Asserting svg cost three wrong
  diagnoses, twice reported to Rafael as an app bug when the app was fine.
- Tests run on Chromium. Rafael uses Brave on the laptop (Chromium, so well
  covered) and the DuckDuckGo browser on iPad and iPhone (WebKit underneath,
  because iOS requires it — NOT covered here).

## Open, and whose they are

**Rafael's:**

1. The public website is built and stuck. Branch `claude/festive-hypatia-qfubv6`,
   15 commits: six photographs, a scroll-scrubbed brand film, `site/`. It has
   been waiting since 05/10 for him to create an empty public repo named
   `jericho-site` on GitHub, then say go.
2. Desktop item 47 — only a person can judge it.
3. Whether to copy his Platform orchestration here (see below).

**Mine, not yet done:**

- Four niggles reported 12/10 and never re-checked: leads not showing on the
  phone, dictation failing in Brave, database rules unchecked, robot unsure of
  contact names. They may already be fixed; nobody has looked.
- iPad/iPhone PORTRAIT puts 12 Contacts controls past the right edge with no
  sideways scroll, and 13 buttons there are under 32px. Rafael uses the iPad in
  landscape only and told me to leave it; recorded, not fixed.

## DANGER: the website branch would delete the safety net

`claude/festive-hypatia-qfubv6` was cut before October's testing work. Merged as
it stands it DELETES 12 test files, `tests/helpers/desktop.js`, `CLAUDE.md` and
`firebase.emulator.json` — about 1500 lines. Merge `main` into it first, keep
both sides, then run the robot. Do not merge it blind.

## The orchestration question

Rafael's Platform repo runs a five-layer tree: him, a "Handoff review and PR
merge" session (Opus) as the gate, a supervisor (Sonnet), ~12 Haiku workers one
task each, and read-only Opus reviewers. Observed habits: workers stop before
pushing and ask; one dated branch per task; nothing reaches main from a worker;
reviewers judge and change nothing; cheap models for narrow work.

I could only see the shape — session titles, parentage and status. There is no
tool here that reads another conversation's text.

He asked whether to emulate it in JerichoTrack. My recommendation, not yet
answered: copy two habits rather than the whole structure — work stops before
pushing, and an inspector that is not the author — because this repo is three
HTML files, and the Platform tree has cost $386 on its top session alone.

## How he wants to be worked with

`CLAUDE.md` is the agreement and it matters more than anything here. He is not a
developer and does not want to be. Labels, tests, timeouts and code structure
are mine to decide without asking. Anything that goes live, touches his data, or
changes what the app is FOR is his. Plain words, short sentences, one question
at a time or none. Never claim something works without running it.
