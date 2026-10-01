---
name: awesome-design-skills
description: Apply a named visual style or aesthetic to a UI — brutalism, glassmorphism, neumorphism, claymorphism, neobrutalism, bento, editorial, retro, vaporwave, dithered, skeuomorphism, matrix, terracotta and 54 more. Use when the user asks for a look or vibe rather than a specific company's brand ("make it brutalist", "glassmorphic card", "give it a retro arcade feel", "what styles can you do?"). Each style carries its own color, type, spacing and motion rules. Not for matching a named real-world brand.
license: MIT
user-invocable: true
argument-hint: "[style-name] [what to build]"
---

# awesome-design-skills

67 named visual styles from
[bergside/awesome-design-skills](https://github.com/bergside/awesome-design-skills).

## How to use

1. Match the user's requested look to a style in the catalog below. If they are browsing,
   list a handful of fitting candidates with a one-line description each and let them pick.
2. Read `styles/<style>/SKILL.md` — and `styles/<style>/DESIGN.md` where present — in this
   skill directory **before writing any UI code**. Those files hold the style's real rules;
   do not reconstruct the aesthetic from the name alone.
3. Apply the style consistently across the whole surface. Half-applied styles read as bugs.
4. Styles can be blended, but only deliberately: pick one as the base and borrow specific
   tokens from the other, and tell the user what you combined.

> These styles are bundled as reference files under one skill rather than as 67 separate
> skills, because many use generic names (`flat`, `clean`, `basic`, `modern`) and one is
> named `impeccable`, which would collide with the separately installed Impeccable skill.
> To promote a single style to a standalone skill:
> `cp -R .claude/skills/awesome-design-skills/styles/<style> .claude/skills/<style>`

## Catalog

agentic ant artistic basic bento bold brutalism cafe claude claymorphism clean codex colorful contemporary corporate cosmic creative dithered doodle dramatic editorial enterprise expressive fantasy fiction flat friendly futuristic geometric glassmorphism gradient immersive impeccable levels lingo material matrix minimal modern mono neobrutalism neon neumorphism pacman paper perspective power premium professional pulse refined retro riso roku sega shadcn sketch skeumorphism sleek spacious square stitch storytelling terracotta tetris vibrant vintage
