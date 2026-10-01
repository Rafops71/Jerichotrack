---
name: awesome-design-md
description: Build or restyle a UI to match a specific real-world brand's design system — Apple, Stripe, Vercel, Linear, Spotify, Airbnb, BMW and 67 more. Use when the user names a brand or product as the visual target ("make it look like Stripe", "Apple-style landing page", "match Vercel's dashboard"), or wants a DESIGN.md authored for their own product. Supplies exact color, typography, spacing, radius, shadow and motion tokens per brand. Not for generic style direction with no named brand.
license: MIT
user-invocable: true
argument-hint: "[brand-slug] [what to build]"
---

# awesome-design-md

74 brand design systems as plain Markdown token specs, from
[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md).

## How to use

1. Resolve the brand the user named to a slug in the catalog below.
2. Read `design-md/<slug>/DESIGN.md` in this skill directory **before writing any UI code**.
   That file is the source of truth for the brand's tokens — do not approximate them from memory.
3. Build using those exact tokens. Keep token names semantic in the user's code rather than
   hardcoding hex values twice.
4. If the user wants a spec for *their own* product instead of a known brand, use any
   `DESIGN.md` here as the structural template and fill it from their product's actual values.

If the named brand is not in the catalog, say so and offer the closest match rather than
silently substituting one.

## Catalog

airbnb airtable apple binance bmw bmw-m bugatti cal claude clay clickhouse cohere coinbase composio cursor dell-1996 elevenlabs expo ferrari figma framer hashicorp hp ibm intercom kraken lamborghini linear.app lovable mastercard meta minimax mintlify miro mistral.ai mongodb nike nintendo-2001 notion nvidia ollama opencode.ai pinterest playstation posthog raycast renault replicate resend revolut runwayml sanity sentry shopify slack spacex spotify starbucks stripe supabase superhuman tesla theverge together.ai uber vercel vodafone voltagent warp webflow wired wise x.ai zapier
