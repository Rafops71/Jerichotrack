# Project skills

Third-party Claude Code skills vendored into this repo so they are available to
anyone who clones it. Project skills are auto-discovered from `.claude/skills/<name>/SKILL.md`.

| Skill | Source | Version | License |
|---|---|---|---|
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 4.4.0 | Apache-2.0 |
| `img2threejs` | [img2threejs/img2threejs](https://github.com/img2threejs/img2threejs) | 2.0.0 | Apache-2.0 |
| `awesome-design-md` | [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | 74 brands | MIT |
| `awesome-design-skills` | [bergside/awesome-design-skills](https://github.com/bergside/awesome-design-skills) | 67 styles | MIT |

## Notes on what was changed from upstream

- **img2threejs** — the 1.6 MB `forge/tests/` suite is not vendored; nothing the skill
  references at runtime lives there. Everything `SKILL.md` points at is present.
- **awesome-design-md** — upstream is a collection of `DESIGN.md` token files with no
  `SKILL.md`, so it is not discoverable as a skill on its own. The `SKILL.md` here is a
  thin wrapper written for this repo that routes a named brand to the right file. The
  brand files themselves are unmodified.
- **awesome-design-skills** — upstream's 67 styles are vendored under `styles/` behind one
  wrapper `SKILL.md` rather than as 67 top-level skills. Several use generic names
  (`flat`, `clean`, `basic`, `modern`) and one is named `impeccable`, which would collide
  with the Impeccable skill above. The style files themselves are unmodified.

To promote a single style to a standalone skill:

```sh
cp -R .claude/skills/awesome-design-skills/styles/<style> .claude/skills/<style>
```

## Updating

Re-clone upstream and re-copy; these are vendored snapshots, not submodules.
