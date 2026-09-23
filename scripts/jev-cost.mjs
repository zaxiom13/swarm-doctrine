// Jev cost model and measurement.
//
//   node scripts/jev-cost.mjs                    offline model: request size and calls per match (free)
//   node scripts/jev-cost.mjs --live --calls 4   metered: exact tokens for single and batched requests
//   node scripts/jev-cost.mjs --live --match     metered: one event-cadence match vs --vs hard|local
//
// Live runs stop at $0.10 of reported cost and never retry. Results go to build/.
import fs from 'node:fs';
import { createDuelArena, advanceSecond, act, duelWinner } from '../js/arena.js';
import { buildDecisionRequest, buildBatchedRequest, actionFromDecisionResponse, shouldAsk, askState, DEFAULT_MODEL_ID } from '../js/ai/jev.js';
import { controller } from './lib/league.mjs';
import { decisionsClient } from './lib/openrouter.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const live = args.includes('--live');
const PRICE_PER_TOKEN = 0.042 / 1e6;
const report = { model: DEFAULT_MODEL_ID, live, pricePerMillionTokens: 0.042 };
const out = new URL(`../build/jev-cost-${Date.now()}.json`, import.meta.url);
fs.mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
const save = () => fs.writeFileSync(out, JSON.stringify(report, null, 2));
const chars = value => JSON.stringify(value).length;
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Plays a duel against `opponent` where Jev's side is asked on the event
 * cadence. `answer(snapshot)` returns Jev's action (live or a stand-in).
 */
async function playEventCadence(arena, opponent, answer, seconds) {
    const [human, jev] = arena.teams;
    let last = null, asked = 0, second = 0;
    for (; second < seconds && !duelWinner(arena); second++) {
        act(arena, human, opponent, second);
        const snapshot = arena.sim.snapshotFor(jev);
        if (shouldAsk(snapshot, last, second)) {
            last = askState(snapshot, second);
            asked++;
            arena.sim.commander(jev).apply(await answer(snapshot, arena.sim.snapshotFor(human)));
        }
        advanceSecond(arena);
    }
    return { seconds: second, asked };
}

if (!live) {
    const requests = [], matches = [];
    const standIn = controller('local');
    for (let i = 0; i < Number(option('--seeds', 6)); i++) {
        const arena = createDuelArena({ seed: 77001 + i });
        const { seconds, asked } = await playEventCadence(arena, controller('hard'), (snapshot, other) => {
            const single = chars(buildDecisionRequest(snapshot));
            requests.push({ single, pairSeparate: single + chars(buildDecisionRequest(other)), pairBatched: chars(buildBatchedRequest({ A: snapshot, B: other })) });
            return standIn(snapshot);
        }, 180);
        matches.push({ seed: 77001 + i, seconds, everySecond: seconds, eventCalls: asked });
    }
    // Measured on the live API for this format (digit-heavy text): about 0.78 billed tokens per character.
    const tokensPerChar = Number(option('--tokens-per-char', 0.78));
    const tokens = mean(requests.map(r => r.single)) * tokensPerChar;
    const perMinute = calls => +(calls * tokens * PRICE_PER_TOKEN).toFixed(5);
    const eventCadence = +(60 * mean(matches.map(m => m.eventCalls)) / mean(matches.map(m => m.everySecond))).toFixed(1);
    Object.assign(report, {
        tokensPerChar,
        charsPerRequest: Math.round(mean(requests.map(r => r.single))),
        estimatedTokensPerRequest: Math.round(tokens),
        batchedPairSaving: +(1 - mean(requests.map(r => r.pairBatched)) / mean(requests.map(r => r.pairSeparate))).toFixed(3),
        callsPerMinute: { everySecond: 60, eventCadence },
        usdPerMatchMinute: { everySecond: perMinute(60), eventCadence: perMinute(eventCadence) },
        usdPerHourFor1000Players: +(perMinute(eventCadence) * 60 * 1000).toFixed(2),
        matches,
    });
    save();
    console.log(JSON.stringify(report, null, 2));
} else {
    const client = decisionsClient({ budgetUsd: 0.10, title: 'cost measurement' });
    try {
        if (args.includes('--calls')) {
            const arena = createDuelArena({ seed: 77001 });
            const samples = [];
            for (let second = 0; second < 26; second++) {
                if (second % 5 === 0) samples.push({ jev: arena.sim.snapshotFor('salamander'), other: arena.sim.snapshotFor('dragon') });
                advanceSecond(arena);
            }
            report.single = [];
            for (const { jev } of samples.slice(0, Number(option('--calls', 4)))) {
                const request = buildDecisionRequest(jev);
                const { payload, cost, tokens } = await client.decide(request);
                report.single.push({ chars: chars(request), tokens, cost, choice: actionFromDecisionResponse(payload, jev).type });
                console.log(JSON.stringify(report.single.at(-1)));
            }
            const { jev, other } = samples.at(-1);
            const batched = await client.decide(buildBatchedRequest({ A: jev, B: other }));
            const separate = (await client.decide(buildDecisionRequest(jev))).tokens + (await client.decide(buildDecisionRequest(other))).tokens;
            report.batch = { batchedTokens: batched.tokens, separateTokens: separate, saving: +(1 - batched.tokens / separate).toFixed(3) };
            report.tokensPerChar = +(report.single.reduce((s, r) => s + r.tokens, 0) / report.single.reduce((s, r) => s + r.chars, 0)).toFixed(3);
            console.log(JSON.stringify(report.batch));
        }
        if (args.includes('--match')) {
            const vs = option('--vs', 'hard');
            const arena = createDuelArena({ seed: Number(option('--seed', 77003)) });
            const match = report.match = { vs, calls: 0, tokens: 0, cost: 0 };
            await playEventCadence(arena, controller(vs), async snapshot => {
                const { payload, cost, tokens } = await client.decide(buildDecisionRequest(snapshot));
                Object.assign(match, { calls: match.calls + 1, tokens: match.tokens + tokens, cost: match.cost + cost });
                save();
                return actionFromDecisionResponse(payload, snapshot);
            }, 120);
            const winner = duelWinner(arena);
            Object.assign(match, { seconds: Math.round(arena.sim.time), result: winner === arena.teams[1] ? 'Jev won' : winner ? `${vs} won` : 'draw', usdPerMinute: +(match.cost / (arena.sim.time / 60)).toFixed(5) });
            console.log(JSON.stringify(match));
        }
    } catch (error) {
        report.error = error.message;
        process.exitCode = 1;
    } finally {
        report.reportedSpendUsd = client.spent;
        save();
        console.log(JSON.stringify({ reportedSpendUsd: client.spent, report: out.pathname }));
    }
}
