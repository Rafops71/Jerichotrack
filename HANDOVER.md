# JERICHO COMPANION — HANDOVER

**Last updated: 24 September 2026 (v19, live).** Replaces the older handoff note, which is
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
- **Current version:** v19. **Merged to `main` and live.** Development continues
  on branch `claude/optimistic-euler-9xy09u`.
- **Restore point:** branch `pre-v19-main` holds the last v17 state. To roll the
  live app back: `git push origin pre-v19-main:main --force-with-lease`
- Firebase project `jericho-operation`, anonymous auth
- Collections: `jericho_leads`, `jericho_tasks`, `jericho_pipeline`,
  `jericho_meetings`, `jericho_companion_notes`, `jericho_commslog`,
  `jericho_broker_quotes`

Screens: Home, Follow-ups, Pipeline, Notes. Plus dictation and **Intake**
(renamed from "AI Inbox" in v19): paste/dictate messy text → AI extracts items
→ user reviews editable cards → **explicit Confirm before anything is saved**.
That Confirm gate is non-negotiable and is covered by a test.

---

## Corrections to the old handoff note

1. **There IS a Companion worker.** `jericho-ai-inbox` exists in Cloudflare and
   its code is complete and good. The old note implied otherwise.
2. **It has never been called.** Zero requests since it was created on
   20 August 2026. Rafael confirmed: he kept developing and never tested it.
   That — not a bug — is why "end-to-end extraction has never been confirmed".
3. **Its CORS and JSON-unwrapping are already correct.** It allows `X-API-Key`
   and already strips the bare `JSON` label and ``` fences. Do not "fix" these.
4. **Dictation language was already set** (`en-US`, now `en-GB`).
5. **The ⚡ icon is gone.**

---

## State of play

### Done and pushed

**`companion.html` v18**
- Duplicate-lead warning on Quick Add Lead (the existing `findExistingLead`
  matches on email/phone only, which Quick Add never collects, so a separate
  name+company check was added rather than widening it and changing how Intake
  merges).
- ⚡ removed; layout no longer stretches on iPad/desktop (centred 680px column);
  pinch-zoom unlocked; `DICTATION_LANGUAGE` constant, set to `en-GB`.

**`companion.html` v19**
- **A real bug, found by the checklist.** Items added by hand get a numeric id;
  items added by Intake get a UUID from `makeId()`. Card buttons interpolated
  the id into `onclick` **unquoted**, so a UUID produced
  `completeAction(3f2504e0-4f89-...)` — not valid JavaScript. Every Done and
  Delete button on every AI-created item silently did nothing. Never noticed
  because Intake had never run. Ids are now quoted and compared as text, and
  `makeId()` is used everywhere.
- Edit button on follow-ups, and calls can be edited or cancelled. Both reopen
  the same sheet pre-filled and update the same record.
- Deleting takes two taps ("Sure?", resets after 5s). Same pattern as the v18
  duplicate warning.
- Tap a deal → stage picker. Stage only; adding/editing deals stays on desktop.
- Dictation grace period after stop raised 1200ms → 3500ms
  (`DICT_STOP_GRACE_MS`). **A mitigation, not a confirmed fix** — see below.
- "AI Inbox" renamed to **Intake** throughout the interface. This doubles as a
  version check: if a device still shows "AI Inbox", it is serving a cached
  pre-v19 copy.

**`worker/intake-worker-v2-groq.js`** — the deployable Intake worker
- Rafael's own worker with **Groq** in place of Mistral. The extraction prompt,
  `verifySnippet`, `verifyContactFields`, `validateStage` and the stage
  whitelist are all untouched — those are the parts worth keeping.
- The model is now a Cloudflare variable (`AI_MODEL`), not hardcoded, because
  Groq retires model names at short notice. Rafael's is `openai/gpt-oss-120b`,
  already proven on his email-client project.
- **Closes a security hole in the deployed v1 worker.** v1 read "if a key is
  configured, require it", so with `INGEST_AUTH_KEY` unset it accepted requests
  from anyone who knew the address. v2 refuses to run without one.
- Rate limits, retired models and a bad provider key now return readable
  messages instead of a bare status code.
- `worker/tests/test-intake-worker-v2.mjs` exercises the real worker code with
  the provider stood in: **15 checks, all passing**, including that an invented
  email and an unverifiable quote are both discarded.
- **Not proven:** behaviour against the real Groq API.
- **Robot-user test system** — see `ROBOT.md`. One command
  (`node scripts/run-robot.js`) drives the real app in a real browser against a
  local sandbox database, then checks results through an independent path.
  **Last run: 37 of 42 checklist items passing, 0 failing.**
- **`worker/intake-worker-v1.js`** — an alternative Intake worker. **NOT
  deployed and probably should not be.** See below.

### Not done
- **The live test.** Nobody has ever run real text through the real worker.
  This is the only thing actually blocking the feature.
- **Firestore security rules never verified.** Unknown whether the intended
  "must be signed in" rule was ever applied to `jericho-operation`. Worth
  checking, because the Firebase config is public in a public repo — that is
  normal and not itself a leak, but the rules are what actually protect the data.
- **Dictation items 26–30** cannot be tested by the robot (need a real
  microphone).
- **The last-chunk dictation bug is NOT fixed.** It could not be reproduced
  from the code — the recogniser's `onend` handler already recovers pending
  interim text. Only the early-give-up timer was lengthened. To go further,
  ask Rafael what exactly is lost: the last word, the last sentence, or
  everything since the last pause.
- **Leads have nowhere to live in Companion.** You can add a lead, but no
  screen lists them. Once saved on the phone it is invisible until you open
  JerichoTrack on the desktop.

---

## THE NEXT STEP (do this first)

**Nothing has ever been run through the Intake pipeline end to end.** That is
the only thing still blocking the feature. Everything else is built and tested.

1. Deploy `worker/intake-worker-v2-groq.js` to the Cloudflare worker
   `jericho-ai-inbox`.
2. Set on it: `GROQ_API_KEY` (secret), `AI_MODEL` = `openai/gpt-oss-120b`,
   `INGEST_AUTH_KEY` (secret, any value — tell Rafael what it is). Leave
   `MISTRAL_API_KEY` in place until Groq is confirmed working, then delete it.
3. Call the worker directly with real text and show the raw reply.
4. Then drive the live app: configure Intake with the worker address
   (`https://jericho-ai-inbox.rafael-e.workers.dev`) and that password, paste
   the same text, press Process, and report what the cards show.
5. Say explicitly whether anything was invented.

**Deployment is not proof.** The proof is text going in and correct cards
coming out.

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

## Agreed and queued, not built

Rafael reviewed a list of suggested improvements and picked these. Nothing here
has been started.

- **Search** — one search box covering leads, follow-ups, deals and notes, with
  results grouped by kind. Agreed this should also be where leads finally
  become visible on the phone, rather than adding a fifth bottom-nav button.
  **Still undecided:** whether leads get a proper screen of their own instead.
- **Manual add for broker quotes and comms log.** Today these can only be
  created by Intake; there is no button to record one by hand.
- **Dictation language picker.** Rafael reports recognition quality is poor.
  v19 changed the language from `en-US` to `en-GB` (`DICTATION_LANGUAGE`), so
  that change is a suspect and is one word to revert. He works in English,
  Spanish and French, so a picker in the Intake setup would let him choose per
  session instead of waiting on a new version. The likelier win is extending
  `DICTATION_DICTIONARY` with his actual mis-hearings — ask him for examples of
  what he said versus what appeared.
- **Look and feel.** Rafael wants a settings screen with colour sliders and a
  choice of three layouts. This is by far the largest item on the list and
  amounts to a redesign — show mock-ups and get sign-off before writing code.
  His stated preference remains bright blue / white / pastel.

## Environment notes (this cost an hour — do not repeat it)

- Network access for a cloud session is set on the **cloud environment**, not in
  Settings. There is no settings page or URL for it: at claude.ai/code, click
  the cloud icon showing the environment's name in the row **above the message
  box**, hover the environment, click the gear. Levels are None / Trusted /
  Full / Custom. **Trusted does not include Cloudflare or any AI provider.**
- **Settings → Capabilities → Domain allowlist is a different feature** (the
  chat analysis sandbox). Adding domains there does nothing for cloud sessions.
- A session reads this **once, at startup**. Changing it never affects a running
  session — a new session is required.
- The Cloudflare MCP connector is **read-only for Workers**: it can list workers
  and read their code, but cannot deploy or set variables. Those need network
  access to `api.cloudflare.com` plus an API token.

## Open questions

- **`empty-truth-3fb0`** — the other Cloudflare worker. Contents unknown. He
  mentioned workers for Diligence and for "Jarvis AI", but the account lists
  only two, so one of those is unaccounted for.
- **Supabase** is used on another project; no details gathered.
- ~~Rename "AI Inbox" → "Intake"~~ **Done in v19.** The interface says Intake;
  code identifiers still say "ingest", which is fine and invisible to the user.

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
