# CHAMI JV FOOTBALL

A retro pixel-art arcade football game starring the Chaminade High School (Mineola, NY) JV Flyers, with a collectible player-card economy and season/dynasty mode.

**Tech:** TanStack Start (React 19, Vite 8), TypeScript, HTML5 Canvas, Tailwind CSS 4, localStorage saves, deployed on Netlify.

## Run locally
```bash
pnpm install
npm run dev        # http://localhost:3000
npm test
```

## Update the roster
Edit the `ROSTER_SOURCE` lines in `src/game/data/roster.ts` (`POS | HEIGHT | # | NAME | GRADE | TOWN | OVERALL`, `?` = unavailable). Rarity tiers recompute from the overall ranking automatically.

## Deploy
Push to the connected repo; Netlify runs `vite build` and publishes `dist/client` (see `netlify.toml`).

## Roadmap
The game engine, roster, packs, economy, seasons and save system are written as modules in `src/game/`. The playable screens (menu, game view, collection, shop, team, stats, settings) come next — see `PLAN.md`.
