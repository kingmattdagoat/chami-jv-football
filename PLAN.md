# CHAMI JV FOOTBALL — Build Plan

## Done (game logic modules in `src/game/`)
1. **Theme & shell** — crimson/gold dark theme, pixel fonts, card rarity CSS, pack-opening animations (`src/styles.css`), site title.
2. **Roster data** — real Chaminade JV roster + 5 Mythic coaches + fictional walk-ons (`data/roster.ts`); NYCHSFL opponents with fictional ratings (`data/teams.ts`).
3. **Cards & rarity** — rank-based tiers (6/8/8/8/10/rest), position attributes, training levels (`cards.ts`).
4. **Packs** — five packs with basis-point odds tables summing to 100%, guaranteed-slot logic (`packs.ts`).
5. **Save system** — versioned localStorage store with atomic `commit()` (`store.ts`, `types.ts`, `newSave.ts`).
6. **Lineup** — slots, eligibility, de-duplication, auto-fill, coach boosts, team ratings (`lineup.ts`).
7. **Football engine** — rules (downs, TDs, PAT/2pt, FGs, punts, safeties, turnovers, halftime, OT), real-time player-controlled offense, rating-driven defensive sim with animation, pixel canvas renderer, WebAudio SFX (`engine/`, `audio.ts`).
8. **Economy** — coins, transaction log, once-only reward keys, shop buy/claim/sell/upgrade, achievements, daily challenges, season schedule/playoffs/awards, game settlement (`economy.ts`, `shop.ts`, `achievements.ts`, `challenges.ts`, `season.ts`, `rewards.ts`).

## Remaining
9. **UI screens** (routes in `src/routes/`): main menu/dashboard with top bar; Play Game (canvas host + play-call, defense-call, kick meter, scoreboard, log, final screen); Season/Schedule; My Team; Collection (filters, inspect, compare, lock/favorite, sell); Shop/Packs (odds display, confirm, reveal, Skip/Open Another/Done); Statistics/Achievements; Settings (length, difficulty, mute, reset).
10. **Input** — keyboard, mouse drag-to-throw, touch steering on the game canvas.
11. **Tests** — vitest for pack odds/guarantees, purchase deduction, settle-once rewards, lineup de-dup, save restore.
12. **QA** — desktop + iPad pass, Netlify deploy check.
