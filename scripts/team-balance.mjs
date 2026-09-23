// Headless free-for-all: four factions with their perks, many seeds.
// Usage: node scripts/team-balance.mjs [seeds] [seconds] [idle|bot]
import { Simulation } from '../js/simulation.js';
import { createRules } from '../js/rules.js';
import { randomFrom } from '../js/worlds.js';
import { TEAMS, TEAM_IDS, baseModifiers } from '../js/catalog.js';
import { spawnFleet } from '../js/arena.js';
import { chooseHardBotAction } from '../js/ai/hard-bot.js';

const seeds = Number(process.argv[2] || 40), seconds = Number(process.argv[3] || 90), mode = process.argv[4] || 'bot';
const tally = Object.fromEntries(TEAM_IDS.map(t => [t, { wins: 0, ships: 0 }]));

for (let seed = 1; seed <= seeds; seed++) {
    const sim = new Simulation({ width: 1280, height: 720, rules: createRules(), random: randomFrom(seed * 7919) });
    // Rotate spawn corners so no faction always gets the same one.
    const order = TEAM_IDS.map((_, i) => TEAM_IDS[(i + seed) % TEAM_IDS.length]);
    sim.setTeams(order);
    for (const team of [...TEAM_IDS, 'neutral']) {
        const f = TEAMS[team];
        sim.setModifiers(team, f ? { ...baseModifiers(), speed: f.speed, resist: f.resist, pressure: f.pressure } : baseModifiers());
    }
    order.forEach((team, i) => spawnFleet(sim, team, 40, i));
    for (let t = 0; t < seconds * 60; t++) {
        if (mode === 'bot' && t % 60 === 0) {
            for (const [i, team] of order.entries()) if (sim.count(team)) sim.commander(team).apply(chooseHardBotAction(sim.snapshotFor(team), t / 60, (seed + i) % 3));
        }
        sim.step();
    }
    let best = null;
    for (const team of TEAM_IDS) {
        const n = sim.count(team);
        tally[team].ships += n;
        if (!best || n > sim.count(best)) best = team;
    }
    tally[best].wins++;
}

for (const [team, { wins, ships }] of Object.entries(tally)) {
    console.log(`${team.padEnd(11)} wins ${String(wins).padStart(3)}/${seeds}  avg ships ${(ships / seeds).toFixed(1)}`);
}
