// Duel arena setup and step, shared by the browser duel, headless training,
// evaluation and the lookahead bot, so every opponent trains on the real match.
import { Simulation, TICK } from './simulation.js';
import { buildWorld, randomFrom } from './worlds.js';
import { createRules } from './rules.js';
import { baseModifiers } from './catalog.js';

export const DUEL_TEAMS = ['dragon', 'salamander'];
export const SPAWN_POINTS = [{ x: 0.18, y: 0.18 }, { x: 0.82, y: 0.18 }, { x: 0.18, y: 0.82 }, { x: 0.82, y: 0.82 }];

/** Spawns a fleet around one of the four corner spawn points. */
export function spawnFleet(sim, team, count, index) {
    const point = SPAWN_POINTS[index % SPAWN_POINTS.length];
    for (let i = 0; i < count; i++) {
        sim.addBoid((point.x + (sim.random() - 0.5) * 0.1) * sim.width, (point.y + (sim.random() - 0.5) * 0.1) * sim.height, team);
    }
}

/** Duel maps use the gentlest terrain tier and the same seed-derived random stream everywhere. */
export const duelWorld = (seed, width, height) => buildWorld(seed, 1, width, height);
export const worldRandom = world => randomFrom(world.seed ^ 0xabcdef);

/** Fills an empty simulation with the duel map, both fleets and the opening gray ships. */
export function setupDuelArena(sim, world, { teams = DUEL_TEAMS, mirror = false } = {}) {
    sim.setTeams(teams);
    sim.setTerrain(world.terrain);
    for (const team of [...teams, 'neutral']) sim.setModifiers(team, baseModifiers());
    teams.forEach((team, index) => spawnFleet(sim, team, sim.rules.duelFleetSize, mirror ? 1 - index : index));
    sim.spawnNeutrals(sim.rules.duelNeutralsAtStart);
    return { sim, world, teams, neutralTimer: sim.rules.duelNeutralInterval };
}

export function createDuelArena({ seed = 1, width = 1280, height = 720, rules = createRules(), mirror = false, tier = 1 } = {}) {
    const world = buildWorld(seed, tier, width, height);
    return setupDuelArena(new Simulation({ width, height, rules, random: worldRandom(world) }), world, { mirror });
}

/** Gray-ship reinforcement waves on their own timer. */
export function stepNeutralWaves(arena, dt = TICK) {
    arena.neutralTimer -= dt;
    if (arena.neutralTimer <= 0) {
        arena.neutralTimer = arena.sim.rules.duelNeutralInterval;
        arena.sim.spawnNeutrals(arena.sim.rules.duelNeutralWave);
    }
}

export function stepDuelArena(arena, dt = TICK) {
    stepNeutralWaves(arena, dt);
    arena.sim.step(dt);
}

/** The surviving team once the other fleet is gone, otherwise null. */
export function duelWinner(arena) {
    const [a, b] = arena.teams.map(team => arena.sim.count(team));
    if (a && !b) return arena.teams[0];
    if (b && !a) return arena.teams[1];
    return null;
}

/**
 * Plays a headless duel between two controllers, each deciding once per
 * simulated second from its own snapshot. Returns the result and fleet margin.
 */
export function playDuel({ seed, controllers, seconds = 60, rules, tier, mirror = seed % 2 === 1, onSecond } = {}) {
    const arena = createDuelArena({ seed, rules, mirror, tier });
    const [a, b] = arena.teams;
    for (let second = 0; second < seconds; second++) {
        for (const team of arena.teams) {
            const action = controllers[team](arena.sim.snapshotFor(team), second, arena, team);
            if (action) arena.sim.commander(team).apply(action);
        }
        onSecond?.(arena, second);
        for (let tick = 0; tick < 60; tick++) stepDuelArena(arena);
        if (duelWinner(arena)) break;
    }
    const winner = duelWinner(arena);
    return { winner, seconds: Math.round(arena.sim.time), margin: (arena.sim.count(a) - arena.sim.count(b)) / arena.sim.rules.duelFleetSize, arena };
}
