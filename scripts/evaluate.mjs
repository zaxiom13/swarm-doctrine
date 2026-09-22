// Balance round-robin. Run it after changing rules to see which opponents
// became stronger or weaker, and whether a change broke balance or a bot.
//
//   node scripts/evaluate.mjs [--players easy,hard,local] [--seeds 6] [--seed-start 700001]
//                             [--rule freezeRadius=350] [--save-baseline] [--threshold 0.25]
//
// Each pair plays both sides on every seed. Results are compared to
// build/balance-baseline.json when it exists; swings above --threshold are flagged.
import fs from 'node:fs';
import { playDuel } from '../js/arena.js';
import { createRules, rulesHash } from '../js/rules.js';
import { controller } from './lib/league.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const players = option('--players', 'easy,hard,local').split(',');
const seeds = Array.from({ length: Number(option('--seeds', 6)) }, (_, i) => Number(option('--seed-start', 700001)) + i);
const threshold = Number(option('--threshold', 0.25));
const overrides = Object.fromEntries(args.flatMap((arg, i) => arg === '--rule' ? [args[i + 1].split('=')] : []).map(([key, value]) => [key, Number(value)]));
const rules = createRules(overrides);
const baselineFile = new URL('../build/balance-baseline.json', import.meta.url);

const table = {};
const started = performance.now();
for (const a of players) {
    for (const b of players) {
        if (a === b) continue;
        let wins = 0, losses = 0, margin = 0;
        for (const seed of seeds) {
            const result = playDuel({ seed, rules, controllers: { dragon: controller(a), salamander: controller(b) } });
            wins += result.winner === 'dragon';
            losses += result.winner === 'salamander';
            margin += result.margin;
        }
        table[`${a} vs ${b}`] = { winRate: +(wins / seeds.length).toFixed(3), lossRate: +(losses / seeds.length).toFixed(3), margin: +(margin / seeds.length).toFixed(3) };
        console.log(`${a.padEnd(10)} vs ${b.padEnd(10)} win ${wins}/${seeds.length}  loss ${losses}/${seeds.length}  margin ${(margin / seeds.length).toFixed(2)}`);
    }
}

// Overall strength: average win rate across every game a player took part in.
const strength = Object.fromEntries(players.map(p => {
    const rows = Object.entries(table).flatMap(([key, row]) => {
        const [a, b] = key.split(' vs ');
        return a === p ? [row.winRate] : b === p ? [row.lossRate] : [];
    });
    return [p, +(rows.reduce((s, v) => s + v, 0) / rows.length).toFixed(3)];
}));
const report = { rules: overrides, rulesHash: rulesHash(rules), seeds, players, table, strength, seconds: +((performance.now() - started) / 1000).toFixed(1) };

let flags = [];
if (fs.existsSync(baselineFile)) {
    const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    flags = Object.entries(strength).filter(([p, v]) => p in baseline.strength && Math.abs(v - baseline.strength[p]) > threshold)
        .map(([p, v]) => `${p}: ${baseline.strength[p]} → ${v}`);
    report.baselineRulesHash = baseline.rulesHash;
    report.flags = flags;
}
fs.mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`../build/balance-${Date.now()}.json`, import.meta.url), JSON.stringify(report, null, 2));
if (args.includes('--save-baseline')) fs.writeFileSync(baselineFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ strength, flags }, null, 2));
if (flags.length) { console.log(`Balance moved by more than ${threshold} for: ${flags.join('; ')}`); process.exitCode = 2; }
