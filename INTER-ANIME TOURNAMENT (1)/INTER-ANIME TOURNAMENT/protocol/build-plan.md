# Build plan

## Stack
Static HTML/CSS/ES modules + vendored three.js r160 (js/vendor). No build step. Published from the work dir.

## Architecture
- js/engine/roster.js — 17 slots; per-fighter stats, special definition, model palette.
- js/engine/sim.js — rendering-independent combat simulation (shared by every fighter, player and AI):
  state machine (idle/move/block/blockstun/attack/special/dodge/hitstun/down/getup/ko/win), 3-hit light chain,
  heavy, block (damage x0.15-0.35), dodge i-frames, jump, per-swing hit sets (no per-frame repeat damage),
  knockback/launch/knockdown, projectiles, arena boundary clamp, 99s timer + sudden death, KO resolution.
- js/engine/ai.js — CPU controller producing the same intent object as the player (approach, spacing, light/heavy,
  block/dodge reactions, situational specials, stops at KO). Three difficulty levels.
- simulateBout(): headless CPU-vs-CPU bout with the same engine for the non-player tournament matches.
- js/render/* — cel-shaded toon rigs from shared geometry (one skeleton, one animation set for all 16),
  arena geometry, VFX, chase camera.
- js/main.js — title, select (17 slots, Confirm/Random/Back, difficulty, mirror toggle), versus, arcade ladder (7 stages,
  Gogeta final), tournament bracket (QF/SF/F + champion), VS splash, HUD, pause, result screens.

## Assets
- Reuse: 14 fighter card covers + Tournament Arena cover already generated for this world's cards (Neta generation).
- Gojo and Sukuna covers failed to render; new generation is blocked (credits). They use temporary gradient
  initial panels, as the creator allowed.
- New image generation for an arena backdrop/floor texture was attempted and blocked (credits). The arena is built
  as 3D geometry instead.
- 3D fighter bodies are lightweight code-built toon rigs (stand-in models), per the creator's prototype-first scope.

## Mobile
Landscape-first + virtual controls (stick + 6 action buttons); portrait shows a rotate prompt during matches.

## Validation
Headless round-robin of all 240 pairings (qa/tests/sim-roundrobin.mjs), special-move dummy test, browser
interaction QA with headless Chrome (desktop + mobile landscape), game-visual-qa contact sheet + screenshots.
