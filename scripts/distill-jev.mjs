// Distil Jev into a free offline copy. Each labelled state is paid for once;
// the copy can then be trained against or played indefinitely at no cost.
//
//   node scripts/distill-jev.mjs --collect 200 --teacher jev --live   label states with Jev (metered, capped)
//   node scripts/distill-jev.mjs --collect 200 --teacher local        label with the local policy (free; tests the pipeline)
//   node scripts/distill-jev.mjs --train [--epochs 40]                fit models/league/jev-clone.json
//
// Labels keep Jev's full probability spread over all legal actions, which
// teaches far more per paid call than its single top choice.
import fs from 'node:fs';
import { createDuelArena, advanceSecond, act, duelWinner } from '../js/arena.js';
import { rulesHash, createRules } from '../js/rules.js';
import { randomFrom } from '../js/worlds.js';
import { buildDecisionRequest } from '../js/ai/jev.js';
import { ACTION_IDS, INPUTS, PARAMETERS, POLICY_VERSION, features, policy } from '../js/ai/local-policy.js';
import { decisionCandidates } from '../js/ai/actions.js';
import { controller, loadModel } from './lib/league.mjs';
import { decisionsClient } from './lib/openrouter.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const dataset = new URL(option('--data', '../build/jev-labels.jsonl'), import.meta.url);
const BUDGET_USD = Number(option('--budget', 0.05));

/** Game states from varied matches, sampled every few seconds from the rival side. */
function* states(count) {
    const players = ['hard-assault', 'hard-recruiter', 'hard-patient', 'local', 'easy'];
    for (let seed = 610001; count > 0; seed++) {
        const arena = createDuelArena({ seed, mirror: seed % 2 === 1 });
        const [a, b] = arena.teams, playA = controller(players[seed % players.length]), playB = controller(players[(seed + 2) % players.length]);
        for (let second = 0; second < 90 && !duelWinner(arena) && count > 0; second++) {
            act(arena, a, playA, second);
            const snapshot = arena.sim.snapshotFor(b);
            act(arena, b, playB, second);
            if (second % 3 === 1) { count--; yield snapshot; }
            advanceSecond(arena);
        }
    }
}

async function collect(count, teacher) {
    let labelled = 0;
    const local = teacher === 'local' ? loadModel(new URL('../models/offline-policy.json', import.meta.url)) : null;
    if (teacher === 'jev' && !args.includes('--live')) throw new Error('Labelling with Jev is metered; pass --live');
    const client = local ? null : decisionsClient({ budgetUsd: BUDGET_USD, title: 'distillation' });
    fs.mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
    const stream = fs.createWriteStream(dataset, { flags: 'a' });
    for (const snapshot of states(count)) {
        let probabilities;
        if (local) {
            const p = policy(snapshot, local);
            probabilities = Object.fromEntries(ACTION_IDS.map((id, i) => [id, p.probabilities[i]]).filter(([, v]) => v > 0));
        } else {
            if (client.exhausted) { console.log(`Budget of $${BUDGET_USD} reached.`); break; }
            probabilities = (await client.decide(buildDecisionRequest(snapshot))).payload.answers?.action?.probabilities;
            if (!probabilities) continue;
        }
        stream.write(JSON.stringify({ snapshot, probabilities, teacher }) + '\n');
        labelled++;
    }
    await new Promise(resolve => stream.end(resolve));
    console.log(JSON.stringify({ labelled, teacher, spentUsd: +(client?.spent ?? 0).toFixed(5), dataset: dataset.pathname }));
}

/** Cross-entropy to the teacher's probabilities over legal actions, with Adam. */
function train(epochs) {
    const rows = fs.readFileSync(dataset, 'utf8').trim().split('\n').map(line => JSON.parse(line)).map(row => {
        const { candidates } = decisionCandidates(row.snapshot);
        const mask = ACTION_IDS.map(id => candidates.has(id));
        const target = ACTION_IDS.map((id, i) => mask[i] ? Number(row.probabilities[id]) || 0 : 0);
        const total = target.reduce((a, b) => a + b, 0);
        return { x: features(row.snapshot), mask, target: target.map(v => total ? v / total : 0) };
    }).filter(row => row.target.some(v => v > 0));
    const random = randomFrom(4242);
    rows.sort(() => random() - 0.5);
    const split = Math.max(1, Math.floor(rows.length * 0.8));
    const [trainRows, testRows] = [rows.slice(0, split), rows.slice(split)];
    const w = new Float64Array(PARAMETERS), m = new Float64Array(PARAMETERS), v = new Float64Array(PARAMETERS);
    const predict = row => {
        const logits = ACTION_IDS.map((_, a) => { if (!row.mask[a]) return -Infinity; let s = 0; for (let j = 0; j < INPUTS; j++) s += w[a * INPUTS + j] * row.x[j]; return s; });
        const max = Math.max(...logits), exp = logits.map(l => Math.exp(l - max)), sum = exp.reduce((a, b) => a + b, 0);
        return exp.map(e => e / sum);
    };
    const agreement = set => set.filter(row => { const p = predict(row); return p.indexOf(Math.max(...p)) === row.target.indexOf(Math.max(...row.target)); }).length / Math.max(1, set.length);
    let step = 0;
    for (let epoch = 0; epoch < epochs; epoch++) {
        let loss = 0;
        for (const row of trainRows) {
            const p = predict(row), g = new Float64Array(PARAMETERS);
            for (let a = 0; a < ACTION_IDS.length; a++) {
                if (!row.mask[a]) continue;
                loss -= row.target[a] * Math.log(Math.max(1e-9, p[a]));
                const d = p[a] - row.target[a];
                if (d) for (let j = 0; j < INPUTS; j++) g[a * INPUTS + j] += d * row.x[j];
            }
            step++;
            for (let j = 0; j < PARAMETERS; j++) {
                m[j] = 0.9 * m[j] + 0.1 * g[j];
                v[j] = 0.999 * v[j] + 0.001 * g[j] * g[j];
                w[j] -= 0.01 * (m[j] / (1 - 0.9 ** step)) / (Math.sqrt(v[j] / (1 - 0.999 ** step)) + 1e-8);
            }
        }
        if (epoch % 10 === 9 || epoch === epochs - 1) console.log(JSON.stringify({ epoch: epoch + 1, loss: +(loss / trainRows.length).toFixed(4), trainAgreement: +agreement(trainRows).toFixed(3), testAgreement: +agreement(testRows).toFixed(3) }));
    }
    const model = { version: POLICY_VERSION, weights: [...w], rulesHash: rulesHash(createRules()), distilledFrom: [...new Set(fs.readFileSync(dataset, 'utf8').trim().split('\n').map(l => JSON.parse(l).teacher))], samples: rows.length };
    const file = new URL(option('--out', '../models/league/jev-clone.json'), import.meta.url);
    fs.mkdirSync(new URL('.', file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(model));
    console.log(JSON.stringify({ saved: file.pathname, samples: rows.length, testAgreement: +agreement(testRows).toFixed(3) }));
}

if (args.includes('--collect')) await collect(Number(option('--collect', 200)), option('--teacher', 'local'));
if (args.includes('--train')) train(Number(option('--epochs', 40)));
if (!args.includes('--collect') && !args.includes('--train')) console.log('Pass --collect N and/or --train. See the header of this file.');
