# Swarm Doctrine

A browser game about moving together, surrounding rivals, and turning them into allies. No build or installation is required.

## Run locally

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173. Use an HTTP server rather than opening index.html directly, because the game uses JavaScript modules.

## Two controls

- **Rally:** hold and drag in the arena. Release to surround and convert. The Rally button also toggles steering at your last arena position.
- **Freeze:** Space or right-click; E, Q, 1 and 2 are aliases. Rivals within a 360-pixel radius stop for 10 seconds. Recharge is 10 seconds. The radius includes its boundary. Empty casts keep the charge; allies are unaffected. Successful Freeze releases Rally to open a conversion window. Recruited ships thaw immediately.
- Escape / P pauses; R restarts. Freeze and cooldowns use simulation time, so pause does not consume them.

On phones and tablets, drag with one finger to Rally. Tap Freeze to aim, then tap the arena to cast; tap the button again to cancel. Large controls, portrait and landscape layouts, pointer cancellation, safe-area spacing and orientation scaling are included. Orientation changes reposition the existing world; they do not generate another map.

Shockwave, Overdrive and random powerup drops are no longer part of play. Passive evolution choices remain, capped at two copies per upgrade per run. Freeze upgrades can extend its base reach and duration.

## Modes

| Mode | Terrain | Objective |
|---|---|---|
| Competition | Same positions, sizes and lifetimes for the whole match | Unite four fleets. Restart keeps the map seed. |
| Levels | New seeded map after each victory; fixed during each sector | Continue an expedition. Retry keeps the sector; progress saves at the start of each sector on this device. |
| Zen | Terrain shifts every 40 seconds with a five-second warning | Play without game over. Rival groups replenish and a lost swarm returns. |
| Survival | Fixed arena | Face incoming waves and choose passive upgrades between waves. |

Levels increases terrain count, rival fleet count, rival numbers, movement speed, cohesion and conversion resistance. Difficulty caps at tier 10: seven terrain fields, three rival fleets, 34 ships per rival, speed 1.2, cohesion 1.25 and resistance 1.2. Players begin each sector with 40 ships. Later sectors keep generating new maps at the cap. A new expedition starts at sector one; Continue expedition restores the latest checkpoint. Storage failures do not prevent play.

Black holes pull ships and destroy them at the core. Asteroids scatter ships. Nebulae slow ships without damage. Freeze affects rivals, never terrain. Fixed-map black holes do not expire or grow with fleet count.

Each regular map also has a **stranded cluster**: bring five ships nearby for two seconds to rescue six allies and earn 600 points. The ring shows progress. It can be claimed only once per map. Level results show rescues and terrain losses.

## Fourteen replayable lessons

1. Move as one: steer into a marked area.
2. Numbers become strength: surround and convert.
3. A whole moment of stillness: wide-area Freeze and targeting.
4. Turn stillness into momentum: convert frozen rivals.
5. Spend the pause wisely: recharge and repeated Freeze.
6. Thread the rocks: navigate asteroid fields.
7. Through the blue: cross a slowing nebula.
8. Respect the dark: steer around a black hole.
9. Nobody left behind: rescue stranded ships.
10. Learn the arena: use a fixed competition map.
11. A changing garden: experience a Zen terrain shift.
12. Beyond this horizon: clear two practice sectors.
13. Ready for the next wave: handle reinforcements.
14. Your own kind of orbit: a combined terrain and rival challenge.

All lessons are selectable and replayable, with briefings, goals and saved completion. Early exercises prevent enemy conversion of your ships but hazards can still destroy them. Timing lessons replace targets when necessary. Training progress from the earlier movement, surrounding and freeze lessons migrates to the new lesson library.

## Verification

```sh
node --experimental-vm-modules tests/lessons.test.mjs
```

The dependency-free suite parses all game modules, checks all 14 lesson setups, tests Freeze targeting and timers, touch aiming and cancellation, terrain stability, hazard behavior, map determinism, difficulty caps, campaign retry/resume/advancement, Zen changes, rescues and orientation scaling. It completes the control, rescue and hazard navigation exercises through actual simulation and checks the mode lesson transitions. Rendering receives smoke checks with a stubbed canvas. These checks do not replace visual review or testing on a physical phone.

`experience.css` contains the visual refresh, `worlds.js` defines seeded map data and capped progression, `modes.js` manages the world and expedition lifecycle, and `lessons.js` defines learning objectives. The older stylesheet remains the visual base.
