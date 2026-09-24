/*
 * intake-worker-v1.js
 * Jericho Companion - Intake Worker - VERSION v1
 * Pairs with companion-v18.html (the "AI Inbox" screen).
 *
 * WHAT THIS DOES
 *   Takes messy text (pasted or dictated), asks an AI to pull structured items
 *   out of it, and returns them in exactly the shape companion.html expects.
 *   It saves nothing. The user reviews every item and presses Confirm; only
 *   then does the app write anything to Firestore.
 *
 * PROVIDER-AGNOSTIC BY DESIGN
 *   The AI provider, model and key are Cloudflare variables, not code. Any
 *   OpenAI-compatible endpoint works (Groq, Mistral, OpenAI, Together, ...).
 *   This matters because providers retire model names at short notice - when
 *   that happens you change one variable in the dashboard instead of editing
 *   and redeploying this file.
 *
 * REQUIRED CLOUDFLARE VARIABLES
 *   AI_BASE_URL      e.g. https://api.groq.com/openai/v1
 *                         https://api.mistral.ai/v1
 *   AI_MODEL         the exact model id, e.g. a current Groq or Mistral model
 *   AI_API_KEY       (secret) the provider key - this is what costs money
 *   INGEST_AUTH_KEY  (secret) your own password, must match the key you type
 *                    into the app's setup field
 *
 * LESSONS ALREADY BAKED IN
 *   1. CORS allows the X-API-Key header. The Diligence worker does not, which
 *      is why Companion could never have talked to it - the browser refuses to
 *      send the request at all.
 *   2. Models wrap JSON in packaging. Mistral in particular prepends a bare
 *      "JSON" label or a ```json fence. That was found the hard way in the
 *      Diligence tool. Stripped here, with a brace-matching fallback.
 *   3. A cut-off answer is reported as "truncated", never as a parse failure,
 *      so the app can tell the user something useful.
 *   4. Rate limiting is reported as itself, not as a generic error.
 */

const WORKER_VERSION = "v1";

/* The eight stages the app accepts. Anything else is coerced to "New" rather
   than being allowed through to create an unknown stage in the pipeline. */
const ALLOWED_STAGES = ["New", "Waiting Documents", "Waiting Financials",
  "Negotiation", "Final SPA", "Closed Won", "Closed Not Monetized", "Lost"];

const COMM_TYPES = ["Call", "Email", "WhatsApp", "Meeting", "Note"];
const COMM_DIRECTIONS = ["Outgoing", "Incoming"];
const COMM_OUTCOMES = ["Positive", "Neutral", "Negative", "Waiting"];
const QUOTE_DIRECTIONS = ["Offer", "Bid", "Reference"];

const MAX_INPUT_CHARS = 12000;

/* ------------------------------------------------------------------ */
/* Response helpers                                                     */
/* ------------------------------------------------------------------ */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // X-API-Key MUST be listed here or the browser will not send the request.
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  "Access-Control-Max-Age": "86400"
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, CORS)
  });
}

/* ------------------------------------------------------------------ */
/* Unwrapping the model's answer                                        */
/* ------------------------------------------------------------------ */

/* Models like to gift-wrap JSON. Remove the wrapping before parsing. */
function unwrap(text) {
  let t = String(text || "").trim();
  t = t.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  t = t.replace(/^JSON\s*/i, "").trim();            // bare "JSON" label
  t = t.replace(/^Here is the JSON[:\s]*/i, "").trim();
  return t;
}

/* Last resort: find the first balanced {...} block in the text. */
function firstJsonObject(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch (e) { return null; }
      }
    }
  }
  return null;
}

function parseModelJson(raw) {
  const cleaned = unwrap(raw);
  try { return JSON.parse(cleaned); } catch (e) { return firstJsonObject(cleaned); }
}

/* ------------------------------------------------------------------ */
/* Shaping - the app reads specific field names, so guarantee them      */
/* ------------------------------------------------------------------ */

const str = v => (v === null || v === undefined) ? "" : String(v).trim();
const pick = (v, allowed, fallback) =>
  allowed.includes(str(v)) ? str(v) : fallback;

/* Only accept YYYY-MM-DD; anything else becomes empty rather than a date the
   user did not intend. */
const isoDate = v => /^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : "";

const confidence = v => {
  const n = Number(v);
  return (isFinite(n) && n >= 0 && n <= 1) ? n : 0.8;
};

const arr = v => Array.isArray(v) ? v : [];

function shape(data) {
  return {
    leads: arr(data.leads).filter(i => str(i.name)).map(i => ({
      name: str(i.name), company: str(i.company), email: str(i.email),
      phone: str(i.phone), country: str(i.country), commodity: str(i.commodity),
      notes: str(i.notes), sourceSnippet: str(i.sourceSnippet),
      confidence: confidence(i.confidence)
    })),
    tasks: arr(data.tasks).filter(i => str(i.title)).map(i => ({
      title: str(i.title), category: str(i.category) || "Follow-up",
      due: isoDate(i.due), notes: str(i.notes),
      sourceSnippet: str(i.sourceSnippet), confidence: confidence(i.confidence)
    })),
    notes: arr(data.notes).filter(i => str(i.text)).map(i => ({
      text: str(i.text), sourceSnippet: str(i.sourceSnippet),
      confidence: confidence(i.confidence)
    })),
    commslog: arr(data.commslog).filter(i => str(i.contact) || str(i.summary)).map(i => ({
      contact: str(i.contact),
      type: pick(i.type, COMM_TYPES, "Note"),
      direction: pick(i.direction, COMM_DIRECTIONS, "Outgoing"),
      summary: str(i.summary),
      outcome: pick(i.outcome, COMM_OUTCOMES, "Neutral"),
      followupDate: isoDate(i.followupDate),
      sourceSnippet: str(i.sourceSnippet), confidence: confidence(i.confidence)
    })),
    broker_quotes: arr(data.broker_quotes).filter(i => str(i.commodity)).map(i => ({
      commodity: str(i.commodity), price: str(i.price), origin: str(i.origin),
      terms: str(i.terms), quantity: str(i.quantity),
      direction: pick(i.direction, QUOTE_DIRECTIONS, "Reference"),
      source: str(i.source), notes: str(i.notes),
      sourceSnippet: str(i.sourceSnippet), confidence: confidence(i.confidence)
    })),
    pipeline: arr(data.pipeline).filter(i => str(i.commodity)).map(i => ({
      commodity: str(i.commodity), broker: str(i.broker), buyer: str(i.buyer),
      seller: str(i.seller), quantity: str(i.quantity), unit: str(i.unit),
      price: str(i.price), origin: str(i.origin),
      stage: pick(i.stage, ALLOWED_STAGES, "New"),
      notes: str(i.notes), sourceSnippet: str(i.sourceSnippet),
      confidence: confidence(i.confidence)
    }))
  };
}

/* ------------------------------------------------------------------ */
/* The prompt                                                           */
/* ------------------------------------------------------------------ */

function buildPrompt(text, today) {
  return (
"You extract structured records from a commodity trader's rough notes. The notes " +
"come from typing or voice dictation, so expect fragments, misspellings and no " +
"punctuation. Today's date is " + today + ".\n\n" +

"THE MOST IMPORTANT RULE: never invent anything. Every value you output must be " +
"stated or unambiguously implied in the notes. If a field is not mentioned, return " +
"an empty string. An empty field is correct; a plausible guess is a bug. Do not " +
"infer a company from a person's name, a country from a city you were not given, " +
"or a price from context.\n\n" +

"Pull out only what is actually there. It is normal for most categories to be " +
"empty. Returning one lead and nothing else is a perfectly good answer.\n\n" +

"CATEGORIES:\n" +
"- leads: a person worth remembering. name is required.\n" +
"- tasks: something to do. title is required. due must be YYYY-MM-DD; work out " +
"real dates from phrases like 'tomorrow' or 'next Tuesday' using today's date. " +
"If no date is mentioned, leave due empty.\n" +
"- notes: a fact worth keeping that is not a person, task or deal.\n" +
"- commslog: a record that contact happened. type must be one of " +
COMM_TYPES.join(", ") + ". direction must be " + COMM_DIRECTIONS.join(" or ") +
". outcome must be one of " + COMM_OUTCOMES.join(", ") + ".\n" +
"- broker_quotes: a price someone quoted. direction must be one of " +
QUOTE_DIRECTIONS.join(", ") + ".\n" +
"- pipeline: an actual deal in progress. stage must be exactly one of: " +
ALLOWED_STAGES.join(" | ") + ". If the stage is unclear use \"New\".\n\n" +

"For every item include:\n" +
"- sourceSnippet: the words from the notes that item came from, max 12 words, " +
"copied verbatim. If you cannot quote it, do not output the item.\n" +
"- confidence: 0.0 to 1.0. Use below 0.7 when you are unsure - the user is shown " +
"those in a different colour and checks them harder. Be honest; a low score is " +
"useful, a falsely high one is not.\n\n" +

"Respond with ONLY a JSON object, no markdown, no code fence, no commentary " +
"before or after, in exactly this shape:\n" +
'{"leads":[{"name":"","company":"","email":"","phone":"","country":"","commodity":"","notes":"","sourceSnippet":"","confidence":0.9}],' +
'"tasks":[{"title":"","category":"","due":"","notes":"","sourceSnippet":"","confidence":0.9}],' +
'"notes":[{"text":"","sourceSnippet":"","confidence":0.9}],' +
'"commslog":[{"contact":"","type":"","direction":"","summary":"","outcome":"","followupDate":"","sourceSnippet":"","confidence":0.9}],' +
'"broker_quotes":[{"commodity":"","price":"","origin":"","terms":"","quantity":"","direction":"","source":"","notes":"","sourceSnippet":"","confidence":0.9}],' +
'"pipeline":[{"commodity":"","broker":"","buyer":"","seller":"","quantity":"","unit":"","price":"","origin":"","stage":"","notes":"","sourceSnippet":"","confidence":0.9}]}\n' +
"Include every key, using an empty array where you found nothing.\n\n" +

"THE NOTES:\n" + text
  );
}

/* ------------------------------------------------------------------ */
/* Calling the provider                                                 */
/* ------------------------------------------------------------------ */

async function callModel(env, prompt) {
  // Build the URL properly so a base that already carries a query string (used
  // by the local test harness) does not end up malformed.
  const base = new URL(env.AI_BASE_URL);
  base.pathname = base.pathname.replace(/\/+$/, "") + "/chat/completions";
  return fetch(base.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + env.AI_API_KEY
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 4000,
      // Ask for guaranteed-valid JSON where the provider supports it. Harmless
      // where it does not - the unwrapping above is the safety net.
      response_format: { type: "json_object" }
    })
  });
}

/* ------------------------------------------------------------------ */
/* Entry point                                                          */
/* ------------------------------------------------------------------ */

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "POST") return json({ error: "Only POST is accepted" }, 405);

    /* --- your own password, checked before anything costs money --- */
    if (!env.INGEST_AUTH_KEY) {
      return json({ error: "setup", message: "This Worker has no INGEST_AUTH_KEY set. Add it in the Cloudflare dashboard under Settings > Variables." }, 500);
    }
    if (request.headers.get("X-API-Key") !== env.INGEST_AUTH_KEY) {
      return json({ error: "unauthorized" }, 401);
    }

    for (const required of ["AI_BASE_URL", "AI_MODEL", "AI_API_KEY"]) {
      if (!env[required]) {
        return json({ error: "setup", message: "This Worker is missing " + required + ". Add it in the Cloudflare dashboard under Settings > Variables." }, 500);
      }
    }

    let body;
    try { body = await request.json(); }
    catch (e) { return json({ error: "bad_request", message: "The request body was not valid JSON." }, 400); }

    const text = String(body && body.text || "").trim();
    if (!text) return json({ error: "bad_request", message: "No text was sent." }, 400);
    if (text.length > MAX_INPUT_CHARS) {
      return json({
        error: "too_long",
        message: "That text is " + text.length + " characters, which is more than this can handle in one go (" +
                 MAX_INPUT_CHARS + "). Split it into smaller pieces.",
        rawText: text
      }, 200);
    }

    const today = new Date().toISOString().slice(0, 10);
    const prompt = buildPrompt(text, today);

    /* --- ask the model, with one retry on rate limiting --- */
    let resp;
    try {
      resp = await callModel(env, prompt);
      if (resp.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        resp = await callModel(env, prompt);
      }
    } catch (e) {
      return json({
        error: "network",
        message: "Could not reach the AI service (" + ((e && e.message) || "network error") + "). Your text is safe - try again.",
        rawText: text
      }, 200);
    }

    if (resp.status === 429) {
      return json({
        error: "rate_limited",
        message: "The AI service is rate-limited right now (this happens on free plans). Your text is safe - wait a minute and try again.",
        rawText: text
      }, 200);
    }
    if (resp.status === 401 || resp.status === 403) {
      return json({
        error: "provider_auth",
        message: "The AI service rejected this Worker's own key (HTTP " + resp.status + "). Check AI_API_KEY in the Cloudflare dashboard. This is not the key you typed into the app.",
        rawText: text
      }, 200);
    }
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return json({
        error: "provider_error",
        message: "The AI service returned an error (HTTP " + resp.status + "): " + detail.slice(0, 200) +
                 ". If it mentions the model, the model name in AI_MODEL may have been retired.",
        rawText: text
      }, 200);
    }

    let payload;
    try { payload = await resp.json(); }
    catch (e) {
      return json({ error: "provider_error", message: "The AI service sent something unreadable.", rawText: text }, 200);
    }

    const choice = payload.choices && payload.choices[0];
    const raw = choice && choice.message && choice.message.content;

    /* A cut-off answer is its own problem, and must not be reported as a
       parse failure - the user needs to be told to send less text. */
    if (choice && choice.finish_reason && choice.finish_reason !== "stop") {
      return json({
        error: "truncated",
        message: "The AI ran out of room before finishing (" + choice.finish_reason + "). Try shorter text, or split it up.",
        partialText: String(raw || "").slice(0, 800),
        rawText: text
      }, 200);
    }

    const parsed = parseModelJson(raw);
    if (!parsed || typeof parsed !== "object") {
      return json({
        error: "parse_failed",
        message: "The AI replied, but not in a form this could read.",
        rawText: String(raw || "").slice(0, 2000)
      }, 200);
    }

    const data = shape(parsed);
    const total = Object.keys(data).reduce((n, k) => n + data[k].length, 0);

    return json({
      ok: true,
      data: data,
      meta: {
        workerVersion: WORKER_VERSION,
        model: env.AI_MODEL,
        itemsFound: total,
        extractedAt: today
      }
    });
  }
};
