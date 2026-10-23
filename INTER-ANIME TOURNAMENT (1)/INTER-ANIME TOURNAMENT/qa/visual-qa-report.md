# Visual QA report — INTER-ANIME TOURNAMENT

Mode: both (asset + page). Tooling: headless Chrome 1280x720, mobile emulation 844x390 / 390x844 with touch, published URL check.

- Typecheck: not applicable (plain ES modules)
- Lint: not applicable
- Build: not applicable (no build step)
- Tests: passed (qa/tests/sim-roundrobin.mjs: 240/240 CPU bouts end in KO; all 16 specials land on a dummy and start cooldown)
- Browser smoke test: passed (no page errors; only favicon 404, fixed with an inline icon)
- Browser interaction QA: passed (keyboard select, fight, block/dodge/jump, KO, rematch, pause, arcade stage advance, tournament to champion, reserved slot)
- Asset technical QA: passed (15 webp files readable; sprite-fill heuristics flagged full-bleed cards/backdrop as major, which is not applicable to opaque framed card art; reclassified as note)
- Asset visual inspection: passed (qa/assets/runtime-assets-contact-sheet-labeled.png; each card matches its fighter; no text/watermarks)
- Page browser QA: passed
- Page visual inspection: passed
- Semantic visual review: passed
- Source-theme residue gate: not applicable
- Gameplay loop QA: passed
- Mobile core loop QA: passed (landscape-first, virtual controls, portrait rotate prompt)
- Delivery environment QA: passed (published Work URL loads and plays)
- Publish readiness: ready

## Repairs
- Washed-out arena (oversized light cones, pale floor) → darker sky/fog, thinner beams, deeper floor colours.
- Kamehameha beam blew out to a white disc when seen end-on → thinner tinted core, offset start.
- Outline thickness absolute on small parts (fists looked like black rings) → proportional outline.
- Hit-flash aura too opaque → lowered.
- Slot numbers hidden under portraits → z-index.
- Damage-dealt stat counted overkill → clamped.

## Known limitations (notes)
- Satoru Gojo and Ryomen Sukuna card covers failed to render and new image generation is blocked (credits), so they use gradient initial panels.
- The 3D fighter bodies are lightweight code-built toon rigs (stand-ins), per the prototype-first brief.
