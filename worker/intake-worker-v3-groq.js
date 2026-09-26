/**
 * Jericho Intake Worker - v3 (Groq)
 *
 * This is the SAME worker as before. The extraction prompt, the anti-invention
 * rules, the snippet verification and the contact-field verification are all
 * untouched. Only the AI provider changed.
 *
 * What changed from v1:
 *   1. Calls Groq instead of Mistral (same request format, so nothing else moved).
 *   2. The model name is a VARIABLE, not code. Providers retire model names at
 *      short notice - when that happens you change one field in the dashboard
 *      instead of editing this file.
 *   3. Rate limits and retired models now come back as readable messages
 *      instead of a bare status number.
 *
 * Required in Cloudflare (Settings -> Variables):
 *   GROQ_API_KEY     (secret)  your Groq key - this is what costs money
 *   AI_MODEL                   the exact model id, copied from your Groq console
 *   INGEST_AUTH_KEY  (secret)  your own password; the app must send the same value
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key"
    };

    const json = (obj, status) => new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return json({ error: "Only POST requests are accepted" }, 405);
    }

    /*
     * CHANGED IN v2: the old version only demanded a password IF one had been
     * configured. With no password set, it accepted requests from anyone who
     * knew the address. Now a missing password is a setup error, not an open door.
     */
    if (!env.INGEST_AUTH_KEY) {
      return json({
        error: "setup",
        message: "This Worker has no INGEST_AUTH_KEY set. Add it in the Cloudflare dashboard under Settings > Variables."
      }, 500);
    }
    if (request.headers.get("X-API-Key") !== env.INGEST_AUTH_KEY) {
      return json({ error: "Unauthorized" }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "Invalid request body" }, 400);
    }

    const sourceText = (body.text || body.sourceText || "").trim();
    if (!sourceText) {
      return json({ error: "Missing text field" }, 400);
    }

    if (!env.GROQ_API_KEY) {
      return json({
        error: "setup",
        message: "Worker is missing GROQ_API_KEY - add it in Cloudflare dashboard -> Settings -> Variables"
      }, 500);
    }
    if (!env.AI_MODEL) {
      return json({
        error: "setup",
        message: "Worker is missing AI_MODEL - add it in Cloudflare dashboard -> Settings -> Variables, using a model id from your Groq console."
      }, 500);
    }

    /*
     * The model has no clock. Without today's date it cannot turn "by 30
     * September" into a YYYY-MM-DD, so it correctly left due dates blank -
     * it was obeying rule 1, not ignoring the schema. Supplying the date is
     * the fix; a sterner instruction would not have been.
     *
     * Cloudflare runs in UTC and Rafael is in Belgium, so "today" is taken in
     * APP_TIMEZONE (default Europe/Brussels). Without this, anything dictated
     * between local midnight and 02:00 in summer resolved a day early.
     */
    const TZ = env.APP_TIMEZONE || "Europe/Brussels";
    const now = new Date();
    // en-CA formats as YYYY-MM-DD, which is what the schema asks for.
    const todayISO = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
    }).format(now);
    const todayWeekday = now.toLocaleDateString("en-GB", { weekday: "long", timeZone: TZ });

    const extractionPrompt = `You are a precise, zero-invention data extraction assistant for a commodities brokerage CRM (Jericho).

TODAY IS ${todayWeekday}, ${todayISO}. Use this, and only this, to work out any date the text refers to.

CRITICAL RULES - NEVER BREAK THESE:
1. Do NOT invent, guess, or complete any information.
2. If a field is not explicitly and clearly present in the text, you MUST return null.
3. Never invent email addresses, phone numbers, prices, quantities, dates, names, companies, or stages.
4. Only extract what is actually written or clearly stated.
5. Multi-language text is expected (English and Spanish are common). Handle both correctly but still do not invent.
6. Return ONLY valid JSON. No markdown, no explanations, no extra text.
7. For every extracted item you MUST include a "sourceSnippet" field containing the shortest exact quote from the original text that supports that item (or null if none).
   The sourceSnippet must be copied verbatim, character-for-character, from the source text - never paraphrased or reconstructed from memory.
8. If the text contains nothing that can be safely extracted into any of the categories, return all six arrays empty.
9. If the same lead, task, quote or comms entry appears more than once, return only one item (prefer the more complete version).

Return exactly this JSON shape:

{
  "leads": [
    {
      "name": string | null,
      "company": string | null,
      "email": string | null,
      "phone": string | null,
      "country": string | null,
      "commodity": string | null,
      "notes": string | null,
      "confidence": number,
      "sourceSnippet": string | null
    }
  ],
  "tasks": [
    {
      "title": string,
      "category": string | null,
      "notes": string | null,
      "due": "YYYY-MM-DD" | null,
      "confidence": number,
      "sourceSnippet": string | null
    }
  ],
  "commslog": [
    {
      "contact": string | null,
      "type": "Call" | "Email" | "WhatsApp" | "Meeting" | "Note" | null,
      "direction": "Outgoing" | "Incoming" | null,
      "summary": string | null,
      "outcome": "Positive" | "Neutral" | "Negative" | "Waiting" | null,
      "followup": string | null,
      "followupDate": "YYYY-MM-DD" | null,
      "confidence": number,
      "sourceSnippet": string | null
    }
  ],
  "broker_quotes": [
    {
      "commodity": string | null,
      "price": string | null,
      "origin": string | null,
      "terms": string | null,
      "qty": string | null,
      "direction": "Offer" | "Bid" | "Reference" | null,
      "source": string | null,
      "notes": string | null,
      "confidence": number,
      "sourceSnippet": string | null
    }
  ],
  "pipeline": [
    {
      "commodity": string | null,
      "broker": string | null,
      "buyer": string | null,
      "seller": string | null,
      "quantity": string | null,
      "unit": string | null,
      "price": string | null,
      "origin": string | null,
      "stage": "New" | "Waiting Documents" | "Waiting Financials" | "Negotiation" | "Final SPA" | "Closed Won" | "Closed Not Monetized" | "Lost" | null,
      "notes": string | null,
      "confidence": number,
      "sourceSnippet": string | null
    }
  ],
  "notes": [
    {
      "text": string,
      "confidence": number,
      "sourceSnippet": string | null
    }
  ]
}

DATES - the text usually gives them in human form, and you must convert them:
- "by 30 September", "on the 30th", "end of month" -> work out the actual date from today's date above and return YYYY-MM-DD. A bare day and month with no year means the NEXT time that date occurs, counting today as valid.
- "tomorrow", "next Tuesday", "in two weeks", "Friday" -> same, resolve against today's date. "Next <weekday>" means the coming one; if today is that weekday, it means seven days from now.
- A date you have worked out from today's date is NOT an invention. It is a conversion, and it is required. Returning null because you were unsure of the year is wrong now that you have been given the year.
- Only return null when the text genuinely names no time at all. Vague words with no anchor - "soon", "shortly", "when he gets back" - stay null.
- Never return a date in the past. If your working produces one, you have misread it; return null instead.

THE TRADE THIS TEXT COMES FROM. The writer is a commodities trader. These are
the terms he actually uses. Much of the text is voice-dictated, and speech
recognition mangles exactly these words because they are not everyday English.

  Commodities: manganese, chrome, lithium, antimony, tin, lead, aluminium,
    cobalt, copper, zinc, nickel, iron ore, yellow corn, quinoa, sugar
  Forms and grades: cathode, cathodes, billet, billets, ore, concentrate,
    concentrates, alloy, alloys, ingot, ingots, scrap, fines, lumps
  Incoterms: EXW, FCA, CPT, CIP, DAP, DPU, DDP, FOB, CFR, CIF, FAS
  Trade language: off-taker, offtake, SPA, LOI, ICPO, proof of funds,
    bill of lading, assay, quotational period, indicative bid, firm offer,
    commercial quantity, payment terms, delivery terms, broker, miner,
    shipment window, letter of credit
  Origins often named: South Africa, Peru, Zimbabwe, Chile, Brazil, Zambia,
    Nigeria, DRC, Mexico, Kazakhstan, Turkey, Ghana, Namibia, Botswana

READING MANGLED WORDS. Where a word or phrase in the text is an obvious
phonetic match for a term above AND the sentence plainly supports it, read it
as the intended term. Real examples from this user's dictation:
  "copper kettles"  -> copper cathodes
  "steel delights"  -> steel billets
  "manga knees"     -> manganese
  "essay results"   -> assay results
THE HARD CASE, and the one that matters most: speech recognition usually
replaces a trade term with an ORDINARY ENGLISH WORD. It therefore does not look
wrong. It reads perfectly and means nothing commercially. When an everyday word
sits where a trade term plainly belongs, that is a mishearing, not a choice of
words. Seen in this user's own dictation:
  "essay" / "essays"            -> assay / assays  (testing a cargo)
  "anti money ingots"           -> antimony ingots
  "copper kettles"              -> copper cathodes
  "steel delights"              -> steel billets
  "a couple grade"              -> a copper grade
  "fright"                      -> freight
  "the great of the ore"        -> the grade of the ore
Apply the correction CONSISTENTLY: if you read it as assay in one field, it is
assay in every field, not assay in one and essay in another.

TERMS THAT ARE NOT MISHEARINGS - do not "fix" these:
  "anti-money laundering", "AML"   - a real requirement in this business, and
                                     nothing to do with antimony
  "due diligence", "KYC"           - real
  "essay" where the text genuinely discusses writing                - real
If the sentence is about compliance, paperwork or checks on a counterparty,
leave the words alone. Only the commercial sense of a cargo triggers a reading.

This is not inventing. You are reading what was said, not adding information.
The limits are strict:
- It must be phonetically close AND unmistakable from the surrounding sentence.
  If you are weighing two possibilities, leave the text alone.
- NEVER introduce a commodity, quantity, price or party that is not being
  discussed. Correcting a word is allowed; adding a fact is not.
- The sourceSnippet must STILL be copied verbatim from the original text,
  mangled words included, so the user can see exactly what was said and check
  you. Never "tidy" a quote.

Additional hard constraints:
- INCOTERMS - READ CAREFULLY. A port or city named after CIF, CFR, CIP, DAP, DDP or DPU is the DESTINATION, not the origin. A port or city named after FOB, FCA, EXW or FAS is the ORIGIN. "CIF Rotterdam" means the goods are going TO Rotterdam; it says nothing about where they come from, so "origin" must be null. Only fill "origin" when the text states where the goods come from - a country of origin, a mine, a producer, a load port. Putting a destination in the origin field is a serious error in this business.
- ONE PARAGRAPH AT A TIME. Do not carry a fact from one sentence or paragraph into an item described in a different one unless the text explicitly links them. If a price appears while discussing an offer, it belongs to that offer, not to a deal mentioned elsewhere. If a company makes an offer, that does NOT establish it as the seller on a separate deal. Leave the field null. A plausible inference stated as a fact is exactly the failure this prompt exists to prevent.
- For broker_quotes: only create an entry if a price or clear commercial terms are explicitly stated. Otherwise return an empty array.
- For meetings: never create a full meeting object. Turn any meeting mention into a task or a note instead.
- stage must be one of the exact enum values listed or null. Never invent a stage.
- confidence is your own estimate (0-1) of how clearly the information appears in the text. It is a rough heuristic only.
- All human-readable fields (notes, summary, title, etc.) must be in English. sourceSnippet stays in the original language.

Text to extract from:
---
${sourceText}
---`;

    /* CHANGED IN v2: Groq instead of Mistral. Same request shape. */
    async function callModel() {
      return fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + env.GROQ_API_KEY
        },
        body: JSON.stringify({
          model: env.AI_MODEL,
          messages: [{ role: "user", content: extractionPrompt }],
          temperature: 0,
          max_tokens: 4000
        })
      });
    }

    let aiResponse;
    try {
      aiResponse = await callModel();
      if (aiResponse.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        aiResponse = await callModel();
      }
    } catch (err) {
      return json({
        error: "network",
        message: "Could not reach the AI service (" + (err.message || "unknown error") + "). Your text is safe - try again.",
        rawText: sourceText
      });
    }

    /* CHANGED IN v2: these used to come back as a bare status number. */
    if (aiResponse.status === 429) {
      return json({
        error: "rate_limited",
        message: "The AI service is rate-limited right now. Your text is safe - wait a minute and try again."
      });
    }
    if (aiResponse.status === 401 || aiResponse.status === 403) {
      return json({
        error: "provider_auth",
        message: "Groq rejected this Worker's own key (HTTP " + aiResponse.status + "). Check GROQ_API_KEY in the Cloudflare dashboard. This is not the password you type into the app."
      });
    }
    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => "");
      return json({
        error: "provider_error",
        message: "The AI service returned an error (HTTP " + aiResponse.status + "): " + errText.slice(0, 250) +
                 ". If it mentions the model, the name in AI_MODEL may have been retired - pick a current one from your Groq console."
      });
    }

    const data = await aiResponse.json();
    const choice = data.choices && data.choices[0];
    let rawText = (choice && choice.message && choice.message.content) || "";

    rawText = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    rawText = rawText.replace(/^JSON\s*/i, "").trim();

    if (choice && choice.finish_reason && choice.finish_reason !== "stop") {
      return json({
        error: "truncated",
        message: "The AI response was cut off before it finished (finish_reason: " + choice.finish_reason + "). Please try again with a shorter text or split the input.",
        partialText: rawText.slice(0, 800)
      });
    }

    function extractJSONLoose(text) {
      if (!text) return null;
      const start = text.indexOf("{");
      if (start === -1) return null;

      let depth = 0;
      let inString = false;
      let escaped = false;
      let end = -1;

      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === "\\") {
            escaped = true;
          } else if (ch === '"') {
            inString = false;
          }
          continue;
        }
        if (ch === '"') {
          inString = true;
          continue;
        }
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }

      if (end === -1) return null;
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (e) {
        return null;
      }
    }

    let extracted = null;
    try {
      extracted = JSON.parse(rawText);
    } catch (e) {
      extracted = extractJSONLoose(rawText);
    }

    if (!extracted || typeof extracted !== "object") {
      return json({
        error: "parse_failed",
        message: "Could not parse a valid JSON object from the model response.",
        rawText: rawText
      });
    }

    const result = {
      leads: Array.isArray(extracted.leads) ? extracted.leads : [],
      tasks: Array.isArray(extracted.tasks) ? extracted.tasks : [],
      commslog: Array.isArray(extracted.commslog) ? extracted.commslog : [],
      broker_quotes: Array.isArray(extracted.broker_quotes) ? extracted.broker_quotes : [],
      pipeline: Array.isArray(extracted.pipeline) ? extracted.pipeline : [],
      notes: Array.isArray(extracted.notes) ? extracted.notes : []
    };

    const ALLOWED_STAGES = [
      "New",
      "Waiting Documents",
      "Waiting Financials",
      "Negotiation",
      "Final SPA",
      "Closed Won",
      "Closed Not Monetized",
      "Lost"
    ];

    function normalizeForMatch(s) {
      return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
    }

    function verifySnippet(item) {
      if (!item || typeof item !== "object") return item;
      if (item.sourceSnippet && typeof item.sourceSnippet === "string") {
        const normSource = normalizeForMatch(sourceText);
        const normSnippet = normalizeForMatch(item.sourceSnippet);
        if (!normSnippet || !normSource.includes(normSnippet)) {
          item.sourceSnippet = null;
        }
      } else {
        item.sourceSnippet = null;
      }
      return item;
    }

    function verifyContactFields(item) {
      if (!item || typeof item !== "object") return item;
      const normSource = normalizeForMatch(sourceText);
      if (item.email && typeof item.email === "string" && item.email.trim()) {
        if (!normSource.includes(normalizeForMatch(item.email))) {
          item.email = null;
        }
      }
      if (item.phone && typeof item.phone === "string" && item.phone.trim()) {
        if (!normSource.includes(normalizeForMatch(item.phone))) {
          item.phone = null;
        }
      }
      return item;
    }

    /*
     * "CIF Rotterdam" means the goods are going TO Rotterdam. The model filed
     * Rotterdam as the origin on a live run. The prompt now forbids it, but a
     * prompt is a request; this is a check. If the value in "origin" appears in
     * the source text directly after a destination Incoterm, it is a
     * destination, and the field is cleared.
     */
    const DESTINATION_INCOTERMS = ["CIF", "CFR", "CIP", "DAP", "DDP", "DPU", "DAT"];

    function verifyOrigin(item) {
      if (!item || typeof item !== "object") return item;
      const origin = (item.origin || "").trim();
      if (!origin) return item;
      const escaped = origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const asDestination = new RegExp(
        "\\b(?:" + DESTINATION_INCOTERMS.join("|") + ")\\s+" + escaped + "\\b", "i"
      );
      if (asDestination.test(sourceText)) {
        item.origin = null;
        item.originNote = "A destination was removed from the origin field - the text names it after a delivery term, so it is where the goods are going, not where they come from.";
      }
      return item;
    }

    /* ------------------------------------------------------------------ *
     * Due dates: a net behind the prompt rule.
     *
     * The prompt tells the model today's date, and it now converts "by 30
     * September" correctly about nine times in ten. The tenth still comes back
     * blank. The Incoterms rule has a code check behind it; this is the same
     * idea for dates.
     *
     * Deliberately conservative. It only reads UNAMBIGUOUS absolute forms and
     * "today"/"tomorrow", and only from the sentence the item itself came from
     * - never from elsewhere in the text, which would repeat the cross-paragraph
     * mistake this worker already guards against. Anything needing judgement
     * ("next Tuesday", "in two weeks", "end of month") is left to the model.
     * ------------------------------------------------------------------ */
    const MONTHS = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
    const todayParts = todayISO.split("-").map(Number);

    function isoFrom(y, m, d) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;  // e.g. 31 February
      return dt.toISOString().slice(0, 10);
    }

    /* A bare day-and-month means the next time it occurs, today counting as valid. */
    function nextOccurrence(month, day) {
      let iso = isoFrom(todayParts[0], month, day);
      if (iso && iso >= todayISO) return iso;
      return isoFrom(todayParts[0] + 1, month, day);
    }

    function shiftDays(n) {
      const dt = new Date(Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]));
      dt.setUTCDate(dt.getUTCDate() + n);
      return dt.toISOString().slice(0, 10);
    }

    function dateInSentence(sentence) {
      const t = " " + sentence.toLowerCase() + " ";
      if (/\btomorrow\b/.test(t)) return shiftDays(1);
      if (/\btoday\b/.test(t)) return todayISO;

      const names = Object.keys(MONTHS).join("|");
      let m = t.match(new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(" + names + ")[a-z]*\\b"));
      if (m) return nextOccurrence(MONTHS[m[2]], Number(m[1]));
      m = t.match(new RegExp("\\b(" + names + ")[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b"));
      if (m) return nextOccurrence(MONTHS[m[1]], Number(m[2]));
      return null;
    }

    /* The sentence an item came from, located by its own quote. */
    function sentenceFor(snippet) {
      if (!snippet) return null;
      const hay = normalizeForMatch(sourceText);
      const needle = normalizeForMatch(snippet);
      if (!needle || !hay.includes(needle)) return null;
      const sentences = sourceText.split(/(?<=[.!?\n])\s+/);
      for (const sen of sentences) {
        if (normalizeForMatch(sen).includes(needle)) return sen;
      }
      return null;
    }

    function fillMissingDue(item, field) {
      if (!item || typeof item !== "object") return item;
      if (item[field]) return item;
      const sentence = sentenceFor(item.sourceSnippet);
      if (!sentence) return item;
      const found = dateInSentence(sentence);
      /*
       * A bare day-and-month rolls forward to the next occurrence, which turns
       * a retrospective "I was supposed to send that on 10 September" into a
       * date next year. A regex cannot tell looking-back from looking-ahead,
       * so anything further out than ~4 months is left for the model to judge.
       */
      const within = found && found >= todayISO &&
        (Date.parse(found) - Date.parse(todayISO)) / 86400000 <= 120;
      if (within) {
        item[field] = found;
        item.dueDerived = true;   // the model missed it; this was read from the text
      }
      return item;
    }

    function validateStage(item) {
      if (!item || typeof item !== "object") return item;
      if (item.stage && !ALLOWED_STAGES.includes(item.stage)) {
        item.stage = null;
      }
      return item;
    }

    result.leads = result.leads.map(item => {
      item = verifySnippet(item);
      item = verifyContactFields(item);
      return item;
    });

    result.tasks = result.tasks.map(item => {
      item = verifySnippet(item);
      item = fillMissingDue(item, "due");
      return item;
    });
    result.commslog = result.commslog.map(item => {
      item = verifySnippet(item);
      item = fillMissingDue(item, "followupDate");
      return item;
    });
    result.broker_quotes = result.broker_quotes.map(item => {
      item = verifySnippet(item);
      item = verifyOrigin(item);
      return item;
    });

    result.pipeline = result.pipeline.map(item => {
      item = verifySnippet(item);
      item = verifyOrigin(item);
      item = validateStage(item);
      return item;
    });

    result.notes = result.notes.map(verifySnippet);

    return json({
      ok: true,
      data: result,
      meta: {
        workerVersion: "v3-groq",
        model: env.AI_MODEL,
        originalLength: sourceText.length,
        extractedAt: new Date().toISOString()
      }
    });
  }
};
