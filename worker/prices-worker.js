/**
 * Jericho Prices Worker
 * -----------------------------------------------------------------------------
 * Serves the commodities Jericho tracks that have a genuine live feed:
 * Iron Ore 62% Fe CFR China (TSI) — the CME "TIO" contract, front month —
 * plus the two PGMs that matter to South African trade, platinum and palladium.
 *
 * Why a worker at all: markets.ft.com returns no Access-Control-Allow-Origin
 * header, so index.html cannot call it directly from the browser. This proxy
 * adds CORS and caches the response so we hit the upstream once per 15 minutes
 * rather than once per page load.
 *
 * Deploy separately from the intake worker so a failure here cannot affect
 * Intake:  wrangler deploy worker/prices-worker.js --name jericho-prices
 *
 * Routes:  GET /ironore   /platinum   /palladium
 */

// FT's internal chart series endpoint. Each XID comes from the corresponding
// tearsheet at markets.ft.com/data/commodities/tearsheet/summary?c=<name>
const FT_SERIES = "https://markets.ft.com/data/chartapi/series";

const SYMBOLS = {
  "/ironore": {
    xid: "608346748",
    symbol: "TIO",
    name: "Iron Ore 62% Fe, CFR China (TSI)",
    unit: "USD / metric tonne"
  },
  "/platinum": {
    xid: "18366493",
    symbol: "PL",
    name: "Platinum",
    unit: "USD / troy oz"
  },
  "/palladium": {
    xid: "18483223",
    symbol: "PA",
    name: "Palladium",
    unit: "USD / troy oz"
  }
};

// The upstream is undocumented, so treat any shape change as a hard failure
// rather than guessing, and never serve a close we cannot put a date on.
const CACHE_SECONDS = 900;
const MAX_AGE_DAYS = 10;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}

async function fetchQuote(spec) {
  const body = {
    days: 10,
    dataNormalized: false,
    dataPeriod: "Day",
    dataInterval: 1,
    realtime: false,
    yFormat: "0.###",
    timeServiceFormat: "JSON",
    returnDateType: "ISO8601",
    elements: [
      { Label: "a", Type: "price", Symbol: spec.xid, OverlayIndicators: [], Params: {} }
    ]
  };

  const res = await fetch(FT_SERIES, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error("upstream HTTP " + res.status);

  const data = await res.json();
  if (data.Status === 0) throw new Error(data.StatusString || "upstream rejected the request");

  const dates = data.Dates || [];
  const element = (data.Elements || [])[0];
  const close = ((element && element.ComponentSeries) || []).find(s => s.Type === "Close");
  const values = (close && close.Values) || [];

  // Walk back from the newest point so a trailing null does not read as "no data".
  let i = values.length - 1;
  while (i >= 0 && (values[i] === null || values[i] === undefined)) i--;
  if (i < 0 || !dates[i]) throw new Error("no dated close in upstream response");

  const price = values[i];
  const prev = i > 0 ? values[i - 1] : null;
  const asOf = String(dates[i]).slice(0, 10);
  const ageDays = Math.floor((Date.now() - Date.parse(asOf)) / 86400000);

  // The failure mode that matters is a feed that quietly freezes: a stale close
  // still looks like a plausible price. Refuse it instead of serving it.
  if (!Number.isFinite(ageDays) || ageDays > MAX_AGE_DAYS) {
    throw new Error("upstream close is stale (" + asOf + ")");
  }

  const change = prev === null ? null : price - prev;

  return {
    ok: true,
    symbol: spec.symbol,
    name: spec.name,
    price,
    unit: spec.unit,
    asOf,
    ageDays,
    change,
    pct: change === null || !prev ? null : (change / prev) * 100,
    source: "FT"
  };
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const spec = SYMBOLS[url.pathname];
    if (!spec) return json({ ok: false, error: "not found" }, 404);
    if (request.method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);

    const cache = caches.default;
    const cacheKey = new Request(url.origin + url.pathname, { method: "GET" });
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    try {
      const payload = await fetchQuote(spec);
      const res = json(payload);
      res.headers.set("Cache-Control", "public, max-age=" + CACHE_SECONDS);
      await cache.put(cacheKey, res.clone());
      return res;
    } catch (err) {
      // Never fall back to a remembered number here: the app shows an explicit
      // error instead, so a dead feed can never masquerade as a live price.
      return json({ ok: false, error: String(err.message || err) }, 502);
    }
  }
};
