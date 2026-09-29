# JERICHOTRACK (index.html) — HANDOVER

**Written 29 September 2026.** Covers the desktop app, `index.html`. The
companion phone app has its own note in `HANDOVER.md`; this one does not
replace it.

All times below are **UTC**, taken from the git log, not from memory.

Rafael is not a developer. Explain things in plain words and correct him when
he says something technically mistaken — he has asked for this explicitly.

---

## Standing rules Rafael set during this session

These were said plainly and more than once. They are not preferences.

1. **A question gets an answer, not code.** Do not build anything he did not
   ask for. He pulled this up twice.
2. **Never give theoretical advice.** Only things proven to work. If it has not
   been run, say so.
3. **Never state something as fact that has not been checked.**
4. **If it does not work, leave it alone.** Do not keep chasing a dead end.
5. **Daily data or nothing.** Monthly figures and lagging indicators were
   explicitly rejected.
6. **No unasked suggestions at the end of a reply** unless he asks for them.

---

## What is live and what is not

| Thing | State |
|---|---|
| `jericho-prices` Cloudflare Worker | **LIVE**, deployed 29 Sep 2026 |
| Everything in `index.html` | **NOT deployed.** Branch only. |
| `jericho-ai-inbox` worker (Intake) | Untouched this session |
| companion.html | Untouched this session |

The site is exactly as it was before this session until someone merges and
runs a Firebase deploy.

**Branch:** `claude/awesome-clarke-4pr9d6` — **20 commits ahead of `main`, of
which 9 are from this session** (`fe334a2` … `7957e06`). The other 11 are
older, unmerged work: companion v20/v21, the Intake Groq worker, the due-date
fix. Merging the branch merges all of it. If only this session's work is
wanted, cherry-pick the 9.

---

## Timeline — 29 September 2026

| Time (UTC) | Commit | What |
|---|---|---|
| 02:41 | `fe334a2` | Live Iron Ore 62% Fe feed on the Prices tab |
| 03:00 | `4089727` | Ignore `.claude/settings.local.json` |
| 03:08 | `5e98228` | Platinum and palladium feeds; search by material |
| 03:16 | `6121f32` | Commodity and services picker on leads and contacts |
| 03:19 | `bfd8064` | Ores/refined regrouping — **later reverted, see below** |
| 03:26 | `d789f15` | Copper split into ore and cathodes; picker on deals |
| 04:04 | `355e752` | Iron & steel feedstock; Map tab (globe, network, flow) |
| 04:12 | `c835c09` | Globe zoom; city geocoding |
| 04:21 | `7957e06` | Operations / Atlas style toggle |

Net change: **+892 lines, −16**, across `index.html`, `worker/prices-worker.js`
(new) and `.gitignore`. `index.html` is now 139 KB.

---

## 1. Live prices — what exists and what does not

### The question that started it

Which of the six manual broker-quote commodities (chrome ore, manganese,
ferrochrome, lithium, iron ore, antimony) could be automated?

### What was checked, not assumed

- **ApiVault** (`apivault.dev`) — queried its backend directly
  (`https://api.apivault.dev/api/all`). **1,454 APIs, 51 categories.** Grepped
  the lot: zero hits for metal, commodity, mining, ferro, chromium, manganese,
  lithium, iron ore, antimony, gold, silver, copper. Its Finance category is
  45 entries, all equities/banking/payments. The directory is also stale — it
  lists Frankfurter and ExchangeRate-API but not goldpricez, metals.dev or the
  EIA feed the app already uses.
- **public-api-lists** (GitHub) — newer and genuinely maintained. Same result:
  zero for all six.
- `api.publicapis.org` and `api.publicapis.dev` are **dead** (502 /
  `DEPLOYMENT_NOT_FOUND`).
- **Metals-API** claims coverage of five of six. Rejected: no real free tier
  ($19.99/mo minimum), undisclosed sourcing, and it quotes ferroalloys *per
  troy ounce*, which is not how they trade. Trustpilot shows billing
  complaints.
- **Yahoo Finance** carries the right iron ore contract as `TIO=F` — and its
  data is **frozen at 11 August 2021**, still serving 161.91 as if current.
  This is the single most important finding in this section: a dead feed
  returns a plausible-looking number with no outward sign of being wrong.

### Why these commodities have no free feed

The eight tickers already automated (FX, gold, silver, copper, Brent, WTI) are
**exchange-traded** — public price discovery, so free feeds exist. Chrome ore,
ferrochrome and manganese are **assessed prices**: there is no open exchange,
and the price *is* a proprietary survey product from Fastmarkets, CRU, Argus or
SMM. Selling that data is their business. A free feed would undercut it. This
is structural and is not going to change.

### What did work: FT / CME

`markets.ft.com` renders CME contracts. The internal chart endpoint is:

```
POST https://markets.ft.com/data/chartapi/series
{"days":10,"dataPeriod":"Day","dataInterval":1,"returnDateType":"ISO8601",
 "elements":[{"Type":"price","Symbol":"<XID>"}]}
```

**XIDs in use** (from the `data-mod-config` attribute on each tearsheet page):

| Commodity | XID | FT page |
|---|---|---|
| Iron Ore 62% Fe CFR China (TSI) | `608346748` | `?c=Iron+ore` |
| Platinum | `18366493` | `?c=Platinum` |
| Palladium | `18483223` | `?c=Palladium` |

FT's public symbol-search endpoint does **not** index commodities — only
equities and funds. The XID has to be scraped from the tearsheet page.

### The two blockers, and how they were settled

1. **No CORS.** `markets.ft.com` sends no `Access-Control-Allow-Origin`, so the
   browser cannot call it from `index.html`. Hence `worker/prices-worker.js`.
2. **IP filtering.** FT allows some egress IPs and blocks others. Proven by
   isolating it: same headers, same TLS, same body — via the sandbox proxy
   200, direct from the container 403. It was *not* headers and *not* TLS
   fingerprint. Whether a Cloudflare Worker would be allowed was unknown until
   deployed. **It is allowed.** This could change without notice.

### `worker/prices-worker.js`

Deployed as `jericho-prices`, separate from `jericho-ai-inbox` so a failure
here cannot affect Intake.

```
https://jericho-prices.rafael-e.workers.dev/ironore
https://jericho-prices.rafael-e.workers.dev/platinum
https://jericho-prices.rafael-e.workers.dev/palladium
```

Deploy:

```
npx wrangler deploy worker/prices-worker.js --name jericho-prices \
  --compatibility-date 2025-01-01
```

Needs `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit) and
`CLOUDFLARE_ACCOUNT_ID` in the environment.

**The staleness rule is the point of this file.** Both the worker and
`applyWorkerQuote()` in `index.html` refuse any close older than **10 days**
and show an error instead. Neither falls back to a cached value. This exists
because of the Yahoo finding above: on a deal carrying a five-figure
commission, a stale price that looks fine is the worst failure mode there is.

Responses cache for 15 minutes so the upstream is hit once per quarter hour
rather than once per page load.

### Live tickers: 11

EUR/USD · USD/ZAR · EUR/ZAR · Gold · Silver · Copper · Brent · WTI ·
**Iron Ore 62% Fe · Platinum · Palladium**

### Still manual: 12

Chrome Ore · Ferrochrome · Manganese Ore · Antimony · Lithium ·
HBI · Pig Iron · Billet · Steel Scrap · Ferrous Scrap – BONUS ·
Ferrous Scrap – HMS 1&2 · PNS Scrap

FT carries 27 commodities. Checked explicitly for scrap, steel, pig iron, HBI,
billet and rebar: **none of them are there.**

---

## 2. Contacts — the commodity picker

### The bug that prompted it

Leads and contacts had always carried a **Commodity Focus** field, but the
global search read only name, company, country and notes. It skipped
`commodity` entirely. So *"who works with chrome?"* — the one question this
book is actually asked — was the one question it could not answer. Role/Type
was not searched either, so "logistics" found nothing despite
**Logistics Provider** already existing in the Role dropdown.

Both are now searched, and the result line shows the material so a hit explains
itself.

### Free text became a picker

"Chrome", "chrome ore" and "Cr" were three different things to the search. It
is now a multi-select, because a broker routinely works several materials.

**Storage is unchanged:** the selection is joined into the same
comma-separated string the field always held, so everything typed before the
picker still reads and searches normally. Nothing was migrated.

### The list, and why it is shaped this way

**Ores & Metals (14)** — Chrome Ore · Ferrochrome · Manganese Ore · Iron Ore ·
Antimony · Lithium · Platinum · Palladium · Rhodium · Gold · Silver ·
**Copper Ore** · **Copper Cathodes** · Crude Oil

**Iron & Steel (7)** — Hot Briquetted Iron (HBI) · Pig Iron · Billet ·
Steel Scrap · Ferrous Scrap – BONUS · Ferrous Scrap – HMS 1&2 · PNS Scrap

**Services & Logistics (7)** — Shipping / Ocean Freight · Freight Forwarding ·
Inspection & Assay · Warehousing & Storage · Customs Clearance · Trade Finance ·
Insurance

Plus a free-text box for anything not listed.

Decisions behind it:

- **Copper is split** into ore and cathodes because a concentrate seller and a
  cathode buyer are not the same counterparty. Rafael raised this.
- **Ferrous sits in its own group**, not appended to Materials. Twenty-one
  items in one flat list stops being scannable, and a scrap yard and a pig iron
  supplier are not interchangeable.
- **Materials are at material level, not grade level.** A broker trades chrome
  ore, not only 42%. The grade list (`Chrome Ore 38/40/42/44/46% Cr2O3`,
  `Ferrochrome HC/MC/LC`) stays in the **Broker Quotes** form, where the grade
  is the thing being quoted. Two lists, two jobs.
- **Services sit beside materials** so a freight forwarder is found the same
  way as a chrome broker.
- **Billet** was added on Rafael's word; **rebar** was not — it was never asked
  for.

### What was built and then reverted

Commit `bfd8064` restructured the list into four groups and split antimony,
lithium and the PGMs into ore/refined forms, adding ferromanganese,
silico-manganese, spodumene and PGM concentrate. **None of that was asked
for.** Rafael asked whether the copper distinction existed; the answer was
"no". `d789f15` reverted it and kept only the copper split. Two groups, then
three once ferrous arrived.

### A real bug worth remembering

The original sixth ferrous item read
`Ferrous Scrap – HMS 1&2, 80/20 or 90/10`. **That name contains a comma**, and
commas separate materials in storage — so it was read back as two fake
materials and broke the map filter. Rafael dropped the grades, which fixed it.

A guard now warns in the console if any future list item contains a comma. **Do
not put a comma in a commodity name.**

---

## 3. The Map tab

New nav entry between **Relationships** and **Backup**. One nav slot, three
views behind a segmented control: **Globe · Network · Flow**.

It was placed there rather than as two more nav buttons because the nav is
already eleven items and wraps on mobile.

### What the globe is for

This was clarified late and matters. The globe is **a search tool, not a
picture**. The use cases Rafael gave:

> *"I need a logistics company in Mexico"* → filter Logistics, look at Mexico
>
> *"Who buys scrap metal in Europe?"* → filter Steel Scrap, Europe lights up

Matching contacts light up; everyone else fades but stays visible, so a gap
reads as a gap. One dropdown, three optgroups, exactly as asked: **by material,
by role, by name.**

**Every material is listed, including ones nobody trades yet** (marked
"· none yet"), and selecting one says *"Nobody in your book matches X. That is
a gap worth filling."* Hiding unused materials would hide exactly the gaps
worth finding.

### Cities and geocoding

The book stored only a country, so a country centroid was all that could be
drawn. Contacts and leads now have a **City** field beside Country.

- Geocoder: **Open-Meteo** (`geocoding-api.open-meteo.com`) — no API key, CORS
  allowed, no usage-policy friction.
- Geocoding runs **after** the record is saved, so saving never waits on the
  network and a failed lookup costs nothing but precision.
- Results cache in `localStorage` under `jericho_geocache`.
- **"Place cities on map"** button backfills records saved before the field
  existed.
- Anyone without a usable city falls back to a country centroid and is marked
  **"country only"** in the match list, so a pin never looks more precise than
  it is. Anyone with no recognisable country at all is **named under the map**
  rather than silently dropped.

Two geocoding traps, both hit and fixed:

1. **City names are ambiguous.** There is a Veracruz in **Panama** and a Dubai
   in **India**. Taking the first result would have put the Mexican forwarder
   in Central America. Results are matched against the country on the record.
2. **The geocoder names countries its own way.** It calls Turkey
   *"Republic of Türkiye"*, so Istanbul and Izmir both failed at first. Country
   names are normalised (accents stripped, prefixes like "Republic of" removed)
   and a small alias table covers what Rafael actually types: UAE, USA, UK,
   DRC, Holland, South Korea, Ivory Coast, Czech Republic.

`COUNTRY_LL` holds **104 country centroids** as the fallback.

### Zoom

Wheel, `−` / `+` / `Reset` buttons for touch, and clicking a match in the list
flies the globe to that counterparty and zooms in.

Below **2.2×** markers group by country and carry a count — several contacts in
one country would otherwise sit on top of each other. Above it they separate
into cities, each labelled. Dragging turns less per pixel the further in you
are, so the globe stays controllable.

### Two looks

One button switches between:

- **Operations** — flat grey land, pale sea. Every bit of colour on screen
  belongs to a counterparty, so trust rings read instantly. For working a list.
- **Atlas** — land shaded by climate band the way a printed physical atlas
  separates tundra, forest, steppe and desert, over a graded ocean with a lit
  sphere and a gold graticule. For turning the screen round and showing someone.

Both are drawn in the browser. No imagery downloads. The choice is remembered
in `localStorage` under `jericho_globe_style`.

A **coloured continents** style was built and shown as an option; Rafael chose
Operations and Atlas. It is not in the app.

### Network and Flow

- **Network** — force-directed. Counterparties and materials as points, joined
  where they trade it. Related parties pull together, so the clustering appears
  on its own. Drag any point; hover isolates.
- **Flow** — Sankey. Origin country → material → the role that receives it.
  Band thickness is counterparty count.

Both fall back to a plain message when there is nothing to draw (no commodity
recorded, or a graph shape Sankey cannot lay out).

### Loading

`d3` 7.9.0, `d3-sankey` 0.12.3, `topojson` 3.0.2 and the world atlas
(`world-atlas@2/countries-110m.json`, ~107 KB) load **only when the Map tab is
first opened**, not on page load. The rest of the app starts exactly as fast as
before. A failed load shows a message in place of the map rather than a blank
panel.

---

## 4. Deals

The Pipeline deal form's `Commodity *` was free text, so a deal typed
"chrome ore 42%" and a contact holding "Chrome Ore" were different strings and
nothing connected them. Deals now pick from the same list, so a deal's material
matches the people who trade it and one search returns both.

The required-field check still works: saving with nothing selected is refused.

---

## Not done

- **Satellite imagery on the globe.** Would need raster tiles from a map
  provider, reprojected per frame. Possible in the app; not free and not
  instant. The Atlas style is the closest thing that stays free.
- **Live feed for any of the 12 manual commodities.** None exists. See §1.
- **A deal → network link** ("open this deal's commodity on the map"). Raised,
  not asked for, not built.
- **Staleness badge on manual broker quotes.** The live feeds refuse stale
  data; the manual quotes have no age signal at all. Raised, not built.
- **API keys are in the page source.** `KEY_EIA`, `KEY_GOLDPRICEZ`,
  `KEY_METALS_DEV` are readable by anyone who views source. Free-tier, so the
  damage is small, but they belong behind the worker now that one exists.
- **`toast('Contact saved')` fires before the cloud write confirms.** It says
  saved when it means queued.

---

## Gotchas

- **Never put a comma in a commodity name.** It is the storage separator. There
  is a console warning, but nothing enforces it.
- **The FT feed depends on FT allowing Cloudflare's egress IP.** It does today.
  If the price cards start showing "Feed error", check
  `curl https://jericho-prices.rafael-e.workers.dev/ironore` — a 403 means the
  IP was blocked, not that the code broke.
- **`jericho-prices` and `jericho-ai-inbox` are separate workers on purpose.**
  Do not merge them.
- **The globe needs a city to be precise.** Existing contacts have none, so
  they sit at country level until someone fills the field in and presses
  "Place cities on map".
- **Everything in this session was verified in a real headless browser**
  against seeded records, not reasoned about. Keep doing that — two of the
  bugs above (the comma, the Türkiye mismatch) only appeared when the code was
  actually run.

---

## To go live

```
git checkout main
git merge claude/awesome-clarke-4pr9d6      # brings 20 commits, 9 from this session
firebase deploy --only hosting
```

The `jericho-prices` worker is already deployed and does not need redeploying.
