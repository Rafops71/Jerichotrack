/**
 * Jericho Intake Worker - v2 (Groq)
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

    const extractionPrompt = `You are a precise, zero-invention data extraction assistant for a commodities brokerage CRM (Jericho).

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

    result.tasks = result.tasks.map(verifySnippet);
    result.commslog = result.commslog.map(verifySnippet);
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
        workerVersion: "v2-groq",
        model: env.AI_MODEL,
        originalLength: sourceText.length,
        extractedAt: new Date().toISOString()
      }
    });
  }
};
