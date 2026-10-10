# Preserve Levels rival choice in Continue: evidence

Base: `8024139186972632f153826cd89097990402dc52`. Date: 2026-10-09.

Levels offers AI or passive rivals, but the checkpoint stored only sector, seed and team. After a reload, `levelEnemies` returned to `ai`; Continue silently changed a passive expedition into an AI-controlled one.

Checkpoints now save a validated enemy-mode ID and restore it before the sector is built. Legacy checkpoints without the field remain valid and intentionally default to AI; unknown new values are rejected with the rest of malformed checkpoint data.

Validation: `npm run check && npm test && npm run build` (77 tests). Chromium 153 at 390×844 saved a passive sector, reloaded the page, and continued with `enemies: passive`, zero AI rivals, the same stored seed/team and no page errors. The regression test also covers legacy and invalid values.
