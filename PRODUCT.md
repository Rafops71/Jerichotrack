# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing codebase answers this. The three internal apps (`index.html`,
`companion.html`, `Diligence.html`) are each a single hand-written HTML file with
no build step, no framework and no bundler, served by GitHub Pages from `main`.
The public site follows the same constraint: one file, no build step.

## Users

**Primary:** trading houses and fellow brokers who already know Jericho — met at
a conference, introduced by another broker, or already in conversation — and who
look the firm up afterwards to check it is a real business rather than a man with
a phone.

They are peers. They judge on vocabulary and on whether the firm plainly
understands the mechanics of the trade, and they spot a fake instantly. The site
removes doubt; it is not lead generation and does not need to create interest.

## Product Purpose

Prove to people who already know Jericho that it is a serious firm.

Success is a counterparty closing the page with their doubt removed. It is not
measured in enquiries.

## Positioning

A physical commodity intermediary connecting source to end user across
continents, with sourcing weighted to South America and Africa.

The firm's capital is knowing who is good — the book and the judgement, not
tonnage or balance sheet.

**Not cleared for publication.** The user has confirmed this as product truth but
has NOT cleared it as a site claim. See *Capabilities and Constraints*.

## Operating Context

- **Base: Dubai.** Confirmed as the only location the site may name.
- Jericho does **not** provide services or logistics. Those are bought from third
  parties by the counterparties; the site must never present them as Jericho's.
- Physical commodity brokerage: finds the material, qualifies both ends, holds the
  transaction together until it ships and is paid.
- Two principals, Rafael and Rodrigo, with no staff. Evidenced in the internal
  CRM, which assigns every task to `Rafael`, `Rodrigo` or `Both` and shares one
  live database between them.
- Working languages English, Spanish and French.
- Deal stages as actually worked, from the internal CRM: Offer (seller quote) →
  Qualified → Negotiation → Contract → Closed Won / **Closed Not Monetized** /
  Lost. The "Closed Not Monetized" stage records a cargo that completed without
  Jericho being paid, which is the structural risk of intermediation.
- Counterparty types handled, from the internal CRM: Broker, Buyer, Seller,
  Principal, Agent, Financier, Logistics Provider, Mining Company, Refinery,
  Smelter, Trading House, End User.
- A separate internal Diligence Engine screens counterparty documents before a
  first deal: registration-number formats, IBAN mod-97 and BIC structure checks,
  and PDF metadata reporting.

## Capabilities and Constraints

**What the site may state as fact (user-confirmed):**

1. The name Jericho.
2. Dubai as the base.
3. The four commodity groups, with the materials named under each as listed
   below.

**Everything else is a placeholder or omitted.** The user explicitly did not clear
the two-principal structure, the counterparty-screening claim, the legal entity,
registration, VAT, trade licence, or any location beyond Dubai. These are true or
pending but may not appear as site claims yet.

**The four groups (confirmed complete and accurate):**

| Group | Materials |
|---|---|
| Energy | Crude oil, fuels, coal |
| Ferrous | Iron ore, pig iron, hot briquetted iron, billet, steel scrap, ferrous scrap |
| Non-ferrous | Copper, platinum, palladium, rhodium, gold, silver |
| Critical materials | Chrome, manganese, antimony, lithium |

**Absolute content prohibitions, set by the user and non-negotiable:**

- **No Incoterms** anywhere on the site.
- **No technical detail on any material** — no grades, no specifications.
- **No assay references and no purity percentages**, shown or mentioned.
- **The network is never exposed.** Any route, node, source or port shown must be
  the ordinary publicly-known industry one for that product. Regions and
  continents only; never a port, never a counterparty.
- **No invented Jericho statistics** of any kind: tonnes traded, shipments,
  suppliers, buyers, countries served, years of experience, transaction value.
  None exist in verified form.

**Undecided, recorded rather than invented:**

- Legal entity name, registration number, VAT number, trade licence.
- Contact email and phone.
- Whether a European desk is named at all.
- The logo and the extended company name.

## Brand Commitments

- **Name:** Jericho. The `JERICHO` wordmark is explicitly a **placeholder** — a
  logo and an extended name will replace it.
- **Languages:** English and Spanish, both from launch. The user works in English,
  Spanish and French.
- **Voice, as instructed:** quiet confidence. Precision and specificity rather
  than superlatives. No marketing language, no claims the firm cannot answer for.

## Evidence on Hand

- `GLOBAL-TRADE-FACTS-RESEARCH.md` — verified global trade figures with sources,
  reference years, and each figure marked measured, preliminary, estimate or
  commercial vessel-tracking data. These describe the **world market**, never
  Jericho. Available to the site as background interest, not as proof of anything
  about the firm.
- No photography, no logo, no case studies, no testimonials, no client names, no
  track record, no volumes. **Future work must not fabricate any of these.**
- Image slots are to be left in the markup so the user can supply pictures later.

## Product Principles

1. **A blank beats a guess.** If a fact was not supplied, the page shows nothing
   or a visible placeholder. This is the firm's own operating principle applied to
   its own website, and it was broken once already by inventing a city.
2. **Written for a peer, not a prospect.** The reader already knows the trade.
   Precision is the persuasion; explanation condescends.
3. **The book is the business, and the book stays private.** Demonstrate reach and
   judgement without exposing a single relationship.
4. **Quiet carries further than loud.** The firm is two people; overstatement is
   the fastest way to be found out by someone who would know.

## Accessibility & Inclusion

No product-specific requirement established. Standard practice applies: legible
contrast in both themes, keyboard-operable controls, and motion that respects
`prefers-reduced-motion`.
