# The robot user

A fake user that drives the real Companion app the way you do — tapping the
real buttons — and then checks the results by reading the database directly,
through a path that shares no code with the app. The app is never allowed to
mark its own homework.

## Run it

```bash
npm install          # first time only
node scripts/run-robot.js
```

That builds a sandbox copy of the app, starts a local sandbox database, drives
the app, and prints a tick/cross table — one line per function on the approved
checklist. It exits with an error if any function has no passing test.

## Where it writes

**Nowhere real.** It uses a local sandbox database (the Firebase Emulator) that
lives on this machine only. The sandbox copy of the app is built with the
project name changed to `jericho-test`, so even if the sandbox wiring ever
failed, the app would reach for a cloud project that does not exist rather than
your live CRM. The build refuses to produce a page that still mentions
`jericho-operation`.

`companion.html` itself is never modified.

## The checklist

`tests/checklist.js` holds the approved list of 37 functions in plain words.
The report is generated from that list, not from the test files — so deleting
a test turns its line into a cross rather than making it disappear.

## What the robot cannot check

Items 26–30 (dictation) need a real microphone and real speech recognition.
They are marked `—` and still count as **not covered**, so the gate stays red
until they are checked by hand on a real device and that check is recorded.

The Intake tests (31–37) run against a **stand-in worker**, because the real
Intake worker has never been built. They prove the app's half of the
conversation is correct. They prove nothing about the real worker.

The robot drives Chromium, not Safari. Safari-only problems will not show up.

## CI

`.github/workflows/robot.yml` runs the same thing on every push. A red gate
means the change does not go live.
