// Jev cost model and measurement.
//
//   node scripts/jev-cost.mjs                    offline model: request size and calls per match (free)
//   node scripts/jev-cost.mjs --live --calls 4   metered: exact tokens for single and batched requests
//   node scripts/jev-cost.mjs --live --match     metered: one event-cadence match vs --vs hard|local
//
// Live runs stop at $0.10 of reported cost and never retry. Results go to build/.
import fs from 'node:fs';
import { loadEnvFile } from 'node:process';
import { createDuelArena, stepDuelArena, duelWinner } from '../js/arena.js';
import { buildDecisionRequest, buildBatchedRequest, actionFromDecisionResponse, shouldAsk, DEFAULT_MODEL_ID } from '../js/ai/jev.js';
import { controller } from './lib/league.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const live = args.includes('--live');
const BUDGET_USD = 0.10;
const PRICE_PER_TOKEN = 0.042 / 1e6;
const report = { model: DEFAULT_MODEL_ID, live, pricePerMillionTokens: 0.042 };
const out = new URL(`../build/jev-cost-${Date.now()}.json`, import.meta.url);
fs.mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
const save = () => fs.writeFileSync(out, JSON.stringify(report, null, 2));
const chars = value => JSON.stringify(value).length;

/** Headless duels with the local policy standing in for Jev, recording what Jev would be sent. */
function simulate(seeds) {
    const rows = [];
    for (const seed of seeds) {
        const arena = createDuelArena({ seed });
        const [human, jev] = arena.teams;
        const opponent = controller('hard'), standIn = controller('local');
        let last = null, everySecond = 0, eventCalls = 0;
        for (let second = 0; second < 180 && !duelWinner(arena); second++) {
            arena.sim.commander(human).apply(opponent(arena.sim.snapshotFor(human), second, arena, human));
            const snapshot = arena.sim.snapshotFor(jev);
            everySecond++;
            if (shouldAsk(snapshot, last, second)) {
                eventCalls++;
                last = { second, freeze: snapshot.freeze.cooldown, rally: snapshot.rally.active, allies: snapshot.allies.length, rivals: snapshot.rivals.length };
                const single = chars(buildDecisionRequest(snapshot));
                const both = chars(buildBatchedRequest({ A: snapshot, B: arena.sim.snapshotFor(human) }));
                rows.push({ single, pairSeparate: single + chars(buildDecisionRequest(arena.sim.snapshotFor(human))), pairBatched: both });
                arena.sim.commander(jev).apply(standIn(snapshot));
            }
            for (let tick = 0; tick < 60 && !duelWinner(arena); tick++) stepDuelArena(arena);
        }
        rows.push({ match: { seed, seconds: Math.round(arena.sim.time), everySecond, eventCalls } });
    }
    return rows;
}

if (!live) {
    const rows = simulate(Array.from({ length: Number(option('--seeds', 6)) }, (_, i) => 77001 + i));
    const requests = rows.filter(r => r.single), matches = rows.filter(r => r.match).map(r => r.match);
    const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
    // Measured on the live API for this format (digit-heavy text): about 0.78 billed tokens per character.
    const tokensPerChar = Number(option('--tokens-per-char', 0.78));
    const tokens = mean(requests.map(r => r.single)) * tokensPerChar;
    const perMinute = calls => calls * tokens * PRICE_PER_TOKEN;
    Object.assign(report, {
        tokensPerChar,
        charsPerRequest: Math.round(mean(requests.map(r => r.single))),
        estimatedTokensPerRequest: Math.round(tokens),
        batchedPairSaving: +(1 - mean(requests.map(r => r.pairBatched)) / mean(requests.map(r => r.pairSeparate))).toFixed(3),
        callsPerMinute: { everySecond: 60, eventCadence: +(60 * mean(matches.map(m => m.eventCalls)) / mean(matches.map(m => m.everySecond))).toFixed(1) },
        usdPerMatchMinute: { everySecond: +perMinute(60).toFixed(5) },
        matches,
    });
    report.usdPerMatchMinute.eventCadence = +perMinute(report.callsPerMinute.eventCadence).toFixed(5);
    report.usdPerHourFor1000Players = +(report.usdPerMatchMinute.eventCadence * 60 * 1000).toFixed(2);
    save();
    console.log(JSON.stringify(report, null, 2));
} else {
    loadEnvFile(new URL('../.env', import.meta.url));
    if (!process.env.OPENROUTER_API_KEY) throw new Error('Missing local OpenRouter key');
    let spent = 0;
    const decide = async request => {
        if (spent >= BUDGET_USD) throw new Error('budget stop');
        const response = await fetch('https://openrouter.ai/api/alpha/decisions', {
            method: 'POST', signal: AbortSignal.timeout(15000), body: JSON.stringify(request),
            headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-OpenRouter-Title': 'Swarm Doctrine cost measurement' },
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 200)}; no retry`);
        const cost = Number(payload.usage?.cost);
        if (!Number.isFinite(cost)) throw new Error('Missing metering; stopping');
        spent += cost;
        return { payload, cost, tokens: payload.usage.input_tokens ?? payload.usage.prompt_tokens };
    };
    try {
        if (args.includes('--calls')) {
            const arena = createDuelArena({ seed: 77001 });
            const samples = [];
            for (let second = 0; second < 26; second++) {
                if (second % 5 === 0) samples.push({ jev: arena.sim.snapshotFor('salamander'), other: arena.sim.snapshotFor('dragon') });
                for (let tick = 0; tick < 60; tick++) stepDuelArena(arena);
            }
            report.single = [];
            for (const { jev } of samples.slice(0, Number(option('--calls', 4)))) {
                const request = buildDecisionRequest(jev);
                const { payload, cost, tokens } = await decide(request);
                report.single.push({ chars: chars(request), tokens, cost, choice: actionFromDecisionResponse(payload, jev).type });
                console.log(JSON.stringify(report.single.at(-1)));
            }
            const { jev, other } = samples.at(-1);
            const batched = await decide(buildBatchedRequest({ A: jev, B: other }));
            const separate = [await decide(buildDecisionRequest(jev)), await decide(buildDecisionRequest(other))];
            report.batch = { batchedTokens: batched.tokens, separateTokens: separate[0].tokens + separate[1].tokens, saving: +(1 - batched.tokens / (separate[0].tokens + separate[1].tokens)).toFixed(3) };
            report.tokensPerChar = +(report.single.reduce((s, r) => s + r.tokens, 0) / report.single.reduce((s, r) => s + r.chars, 0)).toFixed(3);
            console.log(JSON.stringify(report.batch));
        }
        if (args.includes('--match')) {
            const vs = option('--vs', 'hard');
            const arena = createDuelArena({ seed: Number(option('--seed', 77003)) });
            const [human, jev] = arena.teams, opponent = controller(vs);
            let last = null;
            const match = report.match = { vs, calls: 0, tokens: 0, cost: 0 };
            for (let second = 0; second < 120 && !duelWinner(arena); second++) {
                arena.sim.commander(human).apply(opponent(arena.sim.snapshotFor(human), second, arena, human));
                const snapshot = arena.sim.snapshotFor(jev);
                if (shouldAsk(snapshot, last, second)) {
                    last = { second, freeze: snapshot.freeze.cooldown, rally: snapshot.rally.active, allies: snapshot.allies.length, rivals: snapshot.rivals.length };
                    const { payload, cost, tokens } = await decide(buildDecisionRequest(snapshot));
                    Object.assign(match, { calls: match.calls + 1, tokens: match.tokens + tokens, cost: match.cost + cost });
                    arena.sim.commander(jev).apply(actionFromDecisionResponse(payload, snapshot));
                }
                for (let tick = 0; tick < 60 && !duelWinner(arena); tick++) stepDuelArena(arena);
                save();
            }
            const winner = duelWinner(arena);
            Object.assign(match, { seconds: Math.round(arena.sim.time), result: winner === jev ? 'Jev won' : winner ? `${vs} won` : 'draw', usdPerMinute: +(match.cost / (arena.sim.time / 60)).toFixed(5) });
            console.log(JSON.stringify(match));
        }
    } catch (error) {
        report.error = error.message;
        process.exitCode = 1;
    } finally {
        report.reportedSpendUsd = spent;
        save();
        console.log(JSON.stringify({ reportedSpendUsd: spent, report: out.pathname }));
    }
}
