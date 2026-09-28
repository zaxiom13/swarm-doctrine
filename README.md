# Swarm Doctrine

A browser game about moving together, surrounding rivals and turning them into allies. It is written in TypeScript and Svelte 5, built with Vite, runs on desktop and phones, installs as an app, and works offline after the first visit.

## Run

```sh
npm install
npm start            # builds into dist/, then serves it with node server.ts
npm run dev          # Vite dev server with hot reload (run npm start alongside for /api)
```

Open http://127.0.0.1:4173. Set `OPPONENT_PORT` if that port is busy. On a phone, use your browser's "Add to Home Screen" to install it full-screen.

```sh
npm test             # every test (vitest), no browser needed
npm run check        # svelte-check type check
```

## Play

- **Rally**: hold and drag anywhere in the arena; release beside a smaller group to recruit it.
- **Freeze**: Space or right-click (Q, E, 1 and 2 also work). On touch, tap **Freeze**, then tap the arena. It stops half the rivals in range; frozen ships cannot recruit or defend.
- **Pause**: Escape, P, the Pause button or your phone's back gesture. **R** restarts.

The exact numbers (ranges, durations, cooldowns) appear in **How to play**, generated from the rules, so they are always current.

**Field guide** (on the home screen) walks through every mechanic one step at a time with annotated pictures: fleets, the screen, Rally, recruiting, Freeze and its timing, terrain, gray ships, duels and survival. Touch devices get the phone guide (portrait pictures, taps and the on-screen buttons); mouse devices get the computer guide (mouse and keyboard). Players can switch below the guide. The pictures in `guide/phone/` and `guide/desktop/` are rendered from the real simulation and renderer by `npm run guide` (needs Playwright with Chromium), so rerun it after a balance or look change. A 31-second vertical promo video (1080×1920 MP4, sized for WhatsApp and Stories) is rendered by `npm run promo` from `scripts/promo/`: real simulation footage, SVG titles and a synthesized soundtrack. It needs Playwright with Chromium and an ffmpeg with libx264 (set `FFMPEG=` or install `ffmpeg-static`).

The interactive lessons are hidden for now; their code is still in `src/lib/tutorial.ts` and `src/lib/lessons.ts`.

| Mode | What happens |
|---|---|
| Conquest | One fixed map, three rival fleets, upgrades at 50% and 75% share. Restart keeps the map. |
| Levels | A new seeded map each sector, harder up to tier 10. Progress saves each sector; **Continue** resumes. |
| Zen | Terrain shifts every 40 seconds. No game over. |
| Survival | Waves from the edges, an upgrade every two waves. |
| Duel | You against one rival fleet, with gray ships either side can recruit. |

### Online duels

**Online duel** (under Duel) puts you in one shared lobby per region (Europe, Americas, Asia-Pacific, Africa & Middle East). Everyone in your region's lobby appears in a list; tap **Challenge**, they accept, and the duel starts. There are no codes to share.

- Players are introduced through a Firebase Realtime Database using [Trystero](https://github.com/dmotz/trystero); the match itself runs over a direct WebRTC connection between the two browsers.
- The challenger hosts: their browser runs the one real simulation, applies the other player's Rally and Freeze, and streams compact snapshots (about 20 a second). Leaving or disconnecting mid-match hands the win to the other player.
- The card only appears once `FIREBASE_DATABASE_URL` in `src/lib/net/config.ts` is set. Add `?db=https://<your-db-url>` to the address to try a database before committing it, or `?net=local` to play two tabs against each other with no network at all.
- There is no TURN relay, so two players behind very strict networks may not connect.

#### Setting up the free Firebase database

1. At [console.firebase.google.com](https://console.firebase.google.com), create a project. Leave it on the **Spark (free)** plan and never add a billing account: with no billing account, going over the free limits only stops matchmaking and can never cost anything.
2. **Build → Realtime Database → Create database**, pick a location near your players, start in **locked mode**.
3. On the database's **Rules** tab, paste `database.rules.json` from this repo and **Publish**. It only allows matchmaking data under `__trystero__`.
4. Copy the database URL shown at the top of the **Data** tab into `FIREBASE_DATABASE_URL` in `src/lib/net/config.ts`.

Online play uses the `@trystero-p2p/firebase` npm package, bundled by Vite.

### Duel rivals

| Rival | How it decides | Needs |
|---|---|---|
| Hard bot | Scripted. Every distance scales with the current rules, it Freezes the densest group within its actual range and routes Rally around black holes. | Nothing |
| Tactician | Tries each shortlisted move in a copy of the real simulation, a few seconds ahead, against both a passive and an aggressive reply, and keeps the move with the best worst case. Runs in a Web Worker. | Nothing |
| Local rival | A small trained policy (`models/offline-policy.json`). Sees ships, terrain and the rule values. | Nothing |
| Jev | OpenRouter's Decisions model, through the local proxy. | A key (see below) |

## How the code fits together

```
src/lib/rules.ts          every gameplay number, plain-language rule text, rules fingerprint
src/lib/settings.ts       player preferences (only these keys are ever saved)
src/lib/catalog.ts        teams, liveries, difficulty, modes, upgrades
src/lib/simulation.ts     the DOM-free world: ships, terrain, commanders, recruitment, snapshots
src/lib/commander.ts      Rally and Freeze for one team, used by the player and every AI
src/lib/boid.ts           one ship's steering and motion
src/lib/terrain.ts        black holes, nebulae, asteroids
src/lib/arena.ts          duel setup shared by play, training, evaluation and the Tactician
src/lib/worlds.ts         seeded maps and Levels difficulty
src/lib/game.ts           app controller: match lifecycle, fixed-step loop, events to effects
src/lib/modes.ts          per-mode setup, waves, milestones, Zen shifts, checkpoints
src/lib/duel.ts           duel lifecycle and the once-per-second rival clock
src/lib/tutorial.ts       lesson runner (hidden for now);  src/lib/lessons.ts  lesson data
src/lib/guide.ts          field-guide chapters; scripts/make-guide.ts + scripts/guide/ render public/guide/*.webp
src/lib/renderer.ts  canvas drawing;  src/lib/input.ts  pointer, touch, keys
src/lib/ui.svelte.ts reactive UI state the engine drives (menus, HUD, dialogs)
src/components/      Svelte 5 screens and overlays;  src/App.svelte mounts them
src/main.ts          entry point;  src/connect.ts  Jev connect page
src/lib/ai/actions.ts     the shared 34-move vocabulary and target points
src/lib/ai/hard-bot.ts    src/lib/ai/search-bot.ts (+ search-worker.js)    src/lib/ai/local-policy.ts    src/lib/ai/jev.ts
src/lib/ai/rivals.ts      one interface over all four rivals
src/lib/net/*.ts          online lobby (lobby.js), match flow (online.js), snapshots (sync.js), Trystero/local transport
server.ts           static server and Jev proxy (key stays server-side)
```

The player and every AI drive the same `Commander`, and the game, the tests, training and the Tactician all step the same `Simulation`. There is one implementation of the rules.

## Changing the balance

1. Edit `src/lib/rules.ts` (for example `freezeRadius`, `freezeCooldown`, `conversionRadius`). Lessons, How to play, the Jev prompt, bot distances and the policy inputs all follow automatically.
2. Run `npm run evaluate` to see a round-robin between the easy bot, the hard bot and the local rival. The first run with `--save-baseline` records a reference; later runs flag any rival whose strength moved by more than `--threshold` (default 0.25). You can try rules without editing the file: `node scripts/evaluate.ts --rule freezeRadius=350 --rule freezeCooldown=8`.
3. Retrain the local rival if needed (below). Every model stores a fingerprint of the rules it was trained on; if the rules change, the duel status says so.

## Training the local rival

```sh
node scripts/train-local.ts --seconds 1200 --opponent league --randomize \
    --directory training/my-run --init models/offline-policy.json --export build/candidate.json
```

- `--opponent league` rotates the easy bot, three hard-bot styles, archived champions in `models/league/` and self-play. `easy` and `mix` are also available.
- `--randomize` gives every training game its own Freeze size and timing, speed, conversion range and terrain density, so the policy learns to read the rule inputs instead of memorising one balance. The final report includes results on rule sets it never trained on.
- `--init` warm-starts from a model; `--export` chooses where the best model goes (the game loads `models/offline-policy.json`).
- Every episode writes an immutable, checksummed checkpoint under the run directory. Restarting the command resumes; corrupt files are skipped; a lock prevents two trainers sharing a directory. Older (v1) checkpoints and models are migrated automatically, with every new input starting at zero so behaviour is unchanged.

Training runs the real simulation at 60 ticks per simulated second with no browser, drawing or network access.

## Jev

Run the server, open `/connect.html` and paste an OpenRouter key. It is stored in the git-ignored `.env` file, never in the browser, and the server refuses to serve it. The server also caps spending per run (`JEV_BUDGET_USD`, default $2) and reports calls and spend at `/api/opponent/status`.

Jev charges $0.042 per million input tokens; output is free. Measured on the live API with `scripts/jev-cost.ts`:

| | Tokens per request | Calls per match minute | Cost per match minute |
|---|---|---|---|
| Before (1px coordinates, every second) | about 2,900 | 60 | about $0.0073 |
| Now (10px units, ids listed once, event cadence) | about 2,060 | about 43 | about $0.0035 |

The controller asks when Freeze becomes ready, when a Rally ends, when fleets shift, or every two seconds otherwise. `POST /api/opponent/decisions` answers several fleets in one call (measured 39% fewer tokens for two fleets), which is the path for multiplayer.

To make Jev free to train and play against, copy it:

```sh
node scripts/distill-jev.ts --collect 1000 --teacher jev --live    # capped by --budget (default $0.05)
node scripts/distill-jev.ts --train                                # writes public/models/league/jev-clone.json
```

Labels keep Jev's full probability spread over every legal move. The copy then joins the training league at no cost. `--teacher local` exercises the whole pipeline for free.

## Tools

| Command | Purpose |
|---|---|
| `npm run evaluate` | Balance round-robin, with baseline comparison |
| `npm run train` | Train the local rival |
| `npm run jev:cost` | Offline Jev cost model; add `--live --calls 3` or `--live --match` to measure (stops at $0.10) |
| `node scripts/distill-jev.ts` | Collect Jev labels and train an offline copy |
| `npm run icons` | Regenerate the PNG app icons from the shapes in `scripts/make-icons.ts` |

Reports go to `build/`; training runs go to `training/`. Both are git-ignored.
