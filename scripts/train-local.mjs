// CPU-only training for the offline rival. Runs the real simulation headlessly.
//
//   node scripts/train-local.mjs [--seconds 90] [--opponent easy|mix|league] [--randomize]
//                                [--directory training/run] [--from checkpoint.json] [--init model.json]
//                                [--export models/offline-policy.json] [--test-seed 810001] [--verify-checkpoint]
//
// --init warm-starts a new run from a model file (v1 or v2); --export sets where
// the best model is written (the game loads models/offline-policy.json).
//
// Hybrid optimiser: paired evolutionary search around the current weights, then
// one Adam policy-gradient step per generation. --randomize trains across
// varied rule sets and terrain so the policy reads ability sizes instead of
// memorising one balance. Every episode is checkpointed atomically.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createDuelArena, advanceSecond, act, duelWinner } from '../js/arena.js';
import { createRules, rulesHash } from '../js/rules.js';
import { randomFrom } from '../js/worlds.js';
import { POLICY_VERSION, INPUTS, PARAMETERS, LEGACY_PARAMETERS, ACTION_IDS, policy, chooseAction, validateModel, migrateLegacyVector } from '../js/ai/local-policy.js';
import { averagedDirection, perturb } from './es-update.mjs';
import { controller, leagueOpponent, randomRules, archiveModels } from './lib/league.mjs';

const args = process.argv.slice(2);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const root = option('--directory', null) ? pathToFileURL(path.resolve(option('--directory')) + path.sep) : new URL('../training/', import.meta.url);
const checkpointDir = new URL('checkpoints/', root);
fs.mkdirSync(checkpointDir, { recursive: true });
const seconds = Number(option('--seconds', 90));
if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600) throw new Error('--seconds must be 0..3600');
const opponent = option('--opponent', 'easy');
if (!['easy', 'mix', 'league'].includes(opponent)) throw new Error('--opponent must be easy, mix or league');
const randomize = args.includes('--randomize');
const EPISODE_SECONDS = 60;
const config = { algorithm: 'hybrid-ES-REINFORCE-v5', learningRate: 0.008, gamma: 0.98, opponent, randomize, episodeSeconds: EPISODE_SECONDS, decisionHz: 1, esPairs: 8, esSigma: 0.2, esRate: 0.08 };
const archive = opponent === 'league' ? archiveModels() : [];

// Resume -------------------------------------------------------------------

const freshRandom = randomFrom(173);
const fresh = () => ({ version: POLICY_VERSION, weights: Array.from({ length: PARAMETERS }, () => (freshRandom() - 0.5) * 0.02) });
const upgradeVector = values => values.length === LEGACY_PARAMETERS ? migrateLegacyVector(values) : values;
const files = fs.readdirSync(checkpointDir).filter(f => f.endsWith('.json')).sort().reverse();
const requested = option('--from', null);
let state;
for (const file of requested ? [path.resolve(requested)] : files.map(f => new URL(f, checkpointDir))) {
    try {
        const envelope = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (sha(JSON.stringify(envelope.state)) !== envelope.sha256) throw new Error('checksum');
        state = envelope.state;
        state.model = validateModel(state.model);
        state.bestModel = validateModel(state.bestModel);
        state.m = upgradeVector(state.m);
        state.v = upgradeVector(state.v);
        break;
    } catch (error) {
        console.warn(`Skipped invalid checkpoint: ${path.basename(String(file))}`);
        state = null;
        if (requested) throw error;
    }
}
if (files.length && !state) throw new Error('No valid checkpoint; refusing to silently reset progress');
const initial = option('--init', null) ? validateModel(JSON.parse(fs.readFileSync(path.resolve(option('--init')), 'utf8'))) : null;
state ||= { model: initial ? { version: POLICY_VERSION, weights: [...initial.weights] } : fresh(), bestModel: null, episodes: 0, adamStep: 0, m: Array(PARAMETERS).fill(0), v: Array(PARAMETERS).fill(0), baseline: 0, bestScore: -1e9, history: [] };
state.bestModel ||= structuredClone(state.model);

if (args.includes('--verify-checkpoint')) {
    if (!files.length && !requested) throw new Error('No saved checkpoint to verify');
    if (state.m.length !== PARAMETERS || state.v.length !== PARAMETERS || ![...state.m, ...state.v].every(Number.isFinite)) throw new Error('Invalid optimizer state');
    console.log(JSON.stringify({ verified: true, episodes: state.episodes, adamStep: state.adamStep, weightsHash: sha(JSON.stringify(state.model.weights)) }));
    process.exit(0);
}

const changedCurriculum = state.config && (state.config.opponent !== config.opponent || Boolean(state.config.randomize) !== randomize);
if (state.config && (state.config.algorithm !== config.algorithm || changedCurriculum)) {
    (state.migrations ||= []).push({ from: state.config, to: config, episode: state.episodes });
    console.log('Preserving weights and optimizer across a configuration change.');
}
if (changedCurriculum) {
    // Scores from a different curriculum are not comparable; keep weights, reset the bar.
    state.model = structuredClone(state.bestModel);
    state.bestScore = -1e9;
    if (state.population) { (state.archivedPopulations ||= []).push(state.population); delete state.population; }
}
state.config = config;
state.generation ||= 0;
state.explorationCursor ||= 0;

// One trainer per directory.
const lock = new URL('trainer.lock', root);
if (fs.existsSync(lock)) {
    const pid = Number(fs.readFileSync(lock, 'utf8'));
    try { process.kill(pid, 0); throw new Error('A trainer already owns this directory'); } catch (error) { if (error.code !== 'ESRCH') throw error; fs.unlinkSync(lock); }
}
fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
process.on('exit', () => { try { fs.unlinkSync(lock); } catch { /* already gone */ } });
let interrupted = false;
process.on('SIGINT', () => { interrupted = true; });
process.on('SIGTERM', () => { interrupted = true; });

function atomic(file, text) {
    const temp = new URL(`.${crypto.randomUUID()}.tmp`, root);
    const fd = fs.openSync(temp, 'wx');
    try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
}
function save() {
    const sha256 = sha(JSON.stringify(state));
    const name = `${String(state.episodes).padStart(8, '0')}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.json`;
    atomic(new URL(name, checkpointDir), JSON.stringify({ sha256, state }));
    atomic(new URL('latest.json', root), JSON.stringify({ checkpoint: `checkpoints/${name}`, sha256 }));
}

// Episodes -----------------------------------------------------------------

function opponentFor(seed, kind) {
    if (kind === 'easy') return controller('easy');
    if (kind === 'mix') return seed % 4 === 0 ? controller('easy') : controller('hard');
    if (kind === 'hard') return controller('hard');
    return leagueOpponent(seed, { self: state.bestModel, archive }).play;
}

/** Plays one duel. The policy controls the second team; reward is the change in fleet margin plus ±2 at the end. */
function episode(model, seed, { training = false, kind = opponent, rules: fixedRules = null } = {}) {
    const variant = fixedRules ? { rules: fixedRules, tier: 1 } : randomize ? randomRules(seed) : { rules: createRules(), tier: 1 };
    const arena = createDuelArena({ seed, rules: variant.rules, tier: variant.tier, mirror: seed % 2 === 1 });
    const [rival, learner] = arena.teams;
    const play = opponentFor(seed, kind);
    const random = randomFrom(seed ^ 0x123456), trajectory = [];
    let previous = 0, score = 0;
    for (let second = 0; second < EPISODE_SECONDS && !duelWinner(arena); second++) {
        act(arena, rival, play, second);
        const p = policy(arena.sim.snapshotFor(learner), model);
        let index = p.probabilities.indexOf(Math.max(...p.probabilities));
        if (training) {
            let sample = random();
            index = p.probabilities.length - 1;
            for (let i = 0; i < p.probabilities.length; i++) { sample -= p.probabilities[i]; if (sample <= 0) { index = i; break; } }
        }
        arena.sim.commander(learner).apply(p.candidates.get(ACTION_IDS[index]).action);
        advanceSecond(arena);
        const margin = (arena.sim.count(learner) - arena.sim.count(rival)) / arena.sim.rules.duelFleetSize;
        const winner = duelWinner(arena);
        const reward = margin - previous + (winner === learner ? 2 : winner === rival ? -2 : 0);
        previous = margin;
        score += reward;
        trajectory.push({ ...p, index, reward });
    }
    const winner = duelWinner(arena);
    return { trajectory, result: { win: winner === learner ? 1 : 0, loss: winner === rival ? 1 : 0, score, seconds: arena.sim.time } };
}

function evaluate(model, seeds, options) {
    const rows = seeds.map(seed => episode(model, seed, options).result);
    return { wins: rows.reduce((n, r) => n + r.win, 0), losses: rows.reduce((n, r) => n + r.loss, 0), draws: rows.filter(r => !r.win && !r.loss).length, matches: rows.length, score: rows.reduce((n, r) => n + r.score, 0) / rows.length };
}

const validationSeeds = opponent === 'easy' ? [90001, 90002, 90003, 90004] : [92001, 92002, 92003, 92004, 92005, 92008];
const startModel = structuredClone(state.model);
const started = performance.now();
console.log(JSON.stringify({ phase: 'baseline', resumed: state.episodes, parameters: PARAMETERS, config }));
const baseline = evaluate(startModel, validationSeeds);
console.log(JSON.stringify({ phase: 'baseline-result', ...baseline }));
if (state.bestScore === -1e9) { state.bestScore = baseline.score; save(); }

function promote(model, evaluation) {
    if (evaluation.score > state.bestScore) { state.bestScore = evaluation.score; state.bestModel = structuredClone(model); }
}

while ((performance.now() - started) / 1000 < seconds && !interrupted) {
    // A population survives interruption: base, noise and completed scores are saved.
    state.population ||= { base: structuredClone(state.model), pairs: [], seed: 51000 + state.generation, champion: null };
    const population = state.population;
    while (population.pairs.length < config.esPairs && !interrupted) {
        const index = population.pairs.length;
        const random = randomFrom(88000 + state.generation * config.esPairs + index);
        const noise = Array.from({ length: PARAMETERS }, () => 0.1 * Math.sqrt(-2 * Math.log(Math.max(1e-12, random()))) * Math.cos(2 * Math.PI * random()));
        // Probe action families evenly (not in proportion to their unequal sizes), on a
        // bias, Freeze-cooldown or Rally-status input, plus small Gaussian noise.
        const families = ['wait', 'release', 'freeze', 'rally'].map(type => ACTION_IDS.map((id, i) => ({ id, i })).filter(a => a.id.split('_')[0] === type));
        const order = [];
        for (let k = 0; k < 24; k++) for (const family of families) if (family[k]) order.push(family[k].i);
        const feature = 5 * 24 + [3, 4, 0][state.generation % 3];
        noise[order[state.explorationCursor % order.length] * INPUTS + feature] = 30;
        const pair = population.pending || { noise };
        if (!population.pending) state.explorationCursor++;
        population.pending = pair;
        for (const sign of ['plus', 'minus']) {
            if (pair[sign] !== undefined) continue;
            const candidate = perturb(population.base, pair.noise, sign === 'plus' ? config.esSigma : -config.esSigma);
            const { result } = episode(candidate, population.seed);
            pair[sign] = result.score;
            if (!population.champion || result.score > population.champion.score) population.champion = { model: candidate, score: result.score };
            state.episodes++;
            state.history.push({ episode: state.episodes, kind: 'ES', generation: state.generation, ...result });
            save();
            await new Promise(resolve => setImmediate(resolve));
        }
        population.pairs.push(pair);
        delete population.pending;
        save();
        if ((performance.now() - started) / 1000 >= seconds) break;
    }
    if (population.pairs.length < config.esPairs || interrupted) break;
    state.model = perturb(population.base, averagedDirection(population.pairs, config.esSigma), config.esRate);
    const averaged = evaluate(state.model, validationSeeds);
    const champion = evaluate(population.champion.model, validationSeeds);
    if (champion.score > averaged.score) state.model = population.champion.model;
    promote(state.model, champion.score > averaged.score ? champion : averaged);
    state.generation++;
    delete state.population;
    save();
    console.log(JSON.stringify({ phase: 'ES', generation: state.generation, episodes: state.episodes, averaged, champion, bestScore: state.bestScore }));

    // One policy-gradient refinement per generation.
    const { trajectory, result } = episode(state.model, 1000 + state.episodes, { training: true });
    const gradient = new Float64Array(PARAMETERS);
    let returns = 0;
    for (let t = trajectory.length - 1; t >= 0; t--) {
        const step = trajectory[t];
        returns = step.reward + config.gamma * returns;
        const advantage = Math.max(-5, Math.min(5, returns - state.baseline));
        for (let a = 0; a < ACTION_IDS.length; a++) {
            const scale = ((a === step.index ? 1 : 0) - step.probabilities[a]) * advantage / trajectory.length;
            if (scale) for (let j = 0; j < INPUTS; j++) gradient[a * INPUTS + j] += scale * step.x[j];
        }
    }
    state.baseline = 0.95 * state.baseline + 0.05 * returns;
    state.adamStep++;
    for (let j = 0; j < PARAMETERS; j++) {
        const g = gradient[j];
        state.m[j] = 0.9 * state.m[j] + 0.1 * g;
        state.v[j] = 0.999 * state.v[j] + 0.001 * g * g;
        state.model.weights[j] += config.learningRate * (state.m[j] / (1 - 0.9 ** state.adamStep)) / (Math.sqrt(state.v[j] / (1 - 0.999 ** state.adamStep)) + 1e-8);
    }
    state.episodes++;
    state.history.push({ episode: state.episodes, ...result });
    save();
    await new Promise(resolve => setImmediate(resolve));
    if (state.episodes % 10 === 0) {
        const evaluation = evaluate(state.model, validationSeeds);
        promote(state.model, evaluation);
        save();
        console.log(JSON.stringify({ phase: 'validation', episodes: state.episodes, ...evaluation, bestScore: state.bestScore }));
    }
}
promote(state.model, evaluate(state.model, validationSeeds));
save();

// Held-out maps never select weights. Robustness uses rule sets never trained on.
const heldout = Array.from({ length: 16 }, (_, i) => Number(option('--test-seed', 810001)) + i);
const testKind = opponent === 'easy' ? 'easy' : 'hard';
const before = evaluate(startModel, heldout, { kind: testKind }), after = evaluate(state.bestModel, heldout, { kind: testKind });
const robustness = heldout.slice(0, 8).map(seed => randomRules(seed + 7777).rules).map((rules, i) => episode(state.bestModel, heldout[i], { kind: testKind, rules }).result);
const rules = createRules();
const exported = { ...state.bestModel, trainedEpisodes: state.episodes, rulesHash: rulesHash(rules), trainedWith: { opponent, randomize } };
const exportFile = option('--export', null) ? pathToFileURL(path.resolve(option('--export'))) : new URL('../models/offline-policy.json', import.meta.url);
fs.writeFileSync(exportFile, JSON.stringify(exported));
const snapshot = createDuelArena({ seed: 999 }).sim.snapshotFor('salamander');
const benchStart = performance.now();
for (let i = 0; i < 1000; i++) chooseAction(snapshot, exported);
const summary = { episodes: state.episodes, generations: state.generation, algorithm: config.algorithm, opponent, randomize, testSeeds: heldout, seconds: (performance.now() - started) / 1000,
    before, after, robustness: { wins: robustness.reduce((n, r) => n + r.win, 0), losses: robustness.reduce((n, r) => n + r.loss, 0), matches: robustness.length },
    parameters: PARAMETERS, inferenceMs: (performance.now() - benchStart) / 1000, rulesHash: exported.rulesHash, apiCostUsd: 0 };
atomic(new URL(`report-${Date.now()}.json`, root), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ phase: 'complete', ...summary }, null, 2));
