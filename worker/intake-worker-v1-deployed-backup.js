/**
 * Jericho AI Inbox Worker
 * Phase 1 - Frozen Spec + bug fixes + ChatGPT/Mistral review round 2
 *
 * Secrets required in Cloudflare:
 * - MISTRAL_API_KEY
 * - INGEST_AUTH_KEY (any string you choose - Companion must send the same value)
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Only POST requests are accepted" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (env.INGEST_AUTH_KEY) {
      const provided = request.headers.get("X-API-Key");
      if (provided !== env.INGEST_AUTH_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const sourceText = (body.text || body.sourceText || "").trim();
    if (!sourceText) {
      return new Response(JSON.stringify({ error: "Missing text field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!env.MISTRAL_API_KEY) {
      return new Response(JSON.stringify({
        error: "Worker is missing MISTRAL_API_KEY - add it in Cloudflare dashboard -> Settings -> Variables"
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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
- For broker_quotes: only create an entry if a price or clear commercial terms are explicitly stated. Otherwise return an empty array.
- For meetings: never create a full meeting object. Turn any meeting mention into a task or a note instead.
- stage must be one of the exact enum values listed or null. Never invent a stage.
- confidence is your own estimate (0-1) of how clearly the information appears in the text. It is a rough heuristic only.
- All human-readable fields (notes, summary, title, etc.) must be in English. sourceSnippet stays in the original language.

Text to extract from: