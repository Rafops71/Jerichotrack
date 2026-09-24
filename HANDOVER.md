# JERICHO COMPANION — HANDOVER

**Last updated: 24 September 2026.** Replaces the older handoff note, which is
now wrong in several places (see "Corrections" below).

Rafael is not a developer. Explain things in plain words, no jargon, and
correct him when he says something technically mistaken — he has asked for
this explicitly.

---

## What this is

Mobile-first CRM for commodity trading. Used mainly on **iPhone** (capture on
the go) and **iPad** (working). Shares one Firebase Firestore database with
JerichoTrack on desktop, so anything entered in either appears in both.

- **Repo:** https://github.com/Rafops71/Jerichotrack (GitHub Pages serves `main`)
- **App file:** `companion.html` — one file, no build step
- **Current version:** v18, on branch `claude/optimistic-euler-9xy09u`, **not yet merged to `main`**
- Firebase project `jericho-operation`, anonymous auth
- Collections: `jericho_leads`, `jericho_tasks`, `jericho_pipeline`,
  `jericho_meetings`, `jericho_companion_notes`, `jericho_commslog`,
  `jericho_broker_quotes`

Screens: Home, Follow-ups, Pipeline, Notes. Plus dictation and "AI Inbox"
(paste/dictate messy text → AI extracts items → user reviews editable cards →
**explicit Confirm before anything is saved**). That Confirm gate is
non-negotiable and is covered by a test.

---

## Corrections to the old handoff note

1. **There IS a Companion worker.** `jericho-ai-inbox` exists in Cloudflare and
   its code is complete and good. The old note implied otherwise.
2. **It has never been called.** Zero requests since it was created on
   20 August 2026. Rafael confirmed: he kept developing and never tested it.
   That — not a bug — is why "end-to-end extraction has never been confirmed".
3. **Its CORS and JSON-unwrapping are already correct.** It allows `X-API-Key`
   and already strips the bare `JSON` label and ``` fences. Do not "fix" these.
4. **Dictation language was already set** (`en-US`, now `en-GB` in v18).
5. **The ⚡ icon is gone** as of v18.

---

## State of play

### Done and pushed
- **`companion.html` v18** — duplicate-lead warning, ⚡ removed, layout no
  longer stretches on iPad/desktop, pinch-zoom unlocked, dictation language
  hoisted to a named constant (`DICTATION_LANGUAGE`, now `en-GB`).
- **Robot-user test system** — see `ROBOT.md`. One command
  (`node scripts/run-robot.js`) drives the real app in a real browser against a
  local sandbox database, then checks results through an independent path.
  **Last run: 32 of 37 checklist items passing, 0 failing.**
- **`worker/intake-worker-v1.js`** — an alternative Intake worker. **NOT
  deployed and probably should not be.** See below.

### Not done
- **The live test.** Nobody has ever run real text through the real worker.
  This is the only thing actually blocking the feature.
- **v18 is not on `main`**, so it is not live yet.
- **Firestore security rules never verified.** Unknown whether the intended
  "must be signed in" rule was ever applied to `jericho-operation`. Worth
  checking, because the Firebase config is public in a public repo — that is
  normal and not itself a leak, but the rules are what actually protect the data.
- **Dictation items 26–30** cannot be tested by the robot (need a real
  microphone). Includes the known bug where the last spoken chunk is lost if
  Stop is tapped mid-processing.

---

## THE NEXT STEP (do this first)

1. Cloudflare → Workers & Pages → `jericho-ai-inbox` → Settings → Variables.
   Set `INGEST_AUTH_KEY` to a password Rafael chooses (existing secrets cannot
   be read back, so just set a new one). Confirm `MISTRAL_API_KEY` is present.
2. In Companion → AI Inbox, enter:
   - `https://jericho-ai-inbox.rafael-e.workers.dev`
   - the same password
3. Paste real notes, press Process, report exactly what appears.

Expect a possible **429 / rate limit**. That is not a code failure — see below.

---

## The AI provider situation

Rafael is on **free tier everywhere**. He pays for Claude chat only, which does
**not** include Claude API access. Do not propose the Claude API.

`jericho-ai-inbox` uses **Mistral** (`mistral-small-latest`), and the Diligence
tool uses the same Mistral account. Diligence is enormously more expensive per
run — two large calls each time, one of them a self-audit, stuffed with full
article text — so it can drain the shared free allowance and leave Companion
hitting a wall it did not cause.

**Fix if rate-limited: give Companion its own key**, ideally a separate free
Groq account. Groq is already used on his email-client project.

**Warning:** Groq retires model names at short notice (two were decommissioned
on 21 September 2026). A retired name fails silently unless the error is
surfaced. Always check the provider's live model list rather than trusting a
remembered name.

---

## About `worker/intake-worker-v1.js`

Written in this session before the existing worker had been read. It is
**provider-agnostic** — base URL, model and key are Cloudflare variables, so
switching providers is a one-field change — and it gives clearer messages for
rate limits and retired models.

But the **existing** worker does two things this one does not: it verifies that
every quote the AI returns actually appears verbatim in the source text, and
deletes invented emails and phone numbers. That is better anti-fabrication.

**Recommendation: keep the existing worker. Do not replace it.** If provider
switching is wanted later, port those two features across rather than swapping
files.

---

## Standing rules (Rafael's)

- **Deliver complete files only** — he cannot apply partial diffs.
- Version in both the filename and an internal comment.
- **Cloudflare Worker code: paste as plain text in chat**, never as a link.
- Propose the approach and get explicit sign-off before writing production code.
- **Never claim "verified/tested/confirmed" without naming the exact check run.**
- No self-critique/clarification AI layer in Companion until base extraction is
  proven on real data.
- Preferred look: bright blue / white / pastel — confirm before big UI changes.

---

## Open questions

- **`empty-truth-3fb0`** — the other Cloudflare worker. Contents unknown. He
  mentioned workers for Diligence and for "Jarvis AI", but the account lists
  only two, so one of those is unaccounted for.
- **Supabase** is used on another project; no details gathered.
- Rename "AI Inbox" → "Intake" was agreed in principle, deliberately deferred
  until the feature actually works.

---

## Gotchas for whoever picks this up

- The robot drives **Chromium, not Safari**. Safari-only bugs will not appear.
- The robot writes only to a **local sandbox**; the build refuses to produce a
  page that still references `jericho-operation`.
- Network access in a cloud session is fixed at session start. The domain
  allowlist lives in the session's environment settings and needs a **new
  session** to take effect.
- `broker_quotes` is snake_case in the app's expected payload. The other five
  keys are not.
