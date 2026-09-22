import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ACTION_IDS, candidateTargets, decisionCandidates, densestPoint, validateAction } from '../js/ai/actions.js';
import { chooseHardBotAction, chooseEasyBotAction, safeRallyPoint } from '../js/ai/hard-bot.js';
import { chooseSearchAction } from '../js/ai/search-bot.js';
import { features, policy, chooseAction, validateModel, INPUTS, PARAMETERS, POLICY_VERSION, RULE_INPUTS } from '../js/ai/local-policy.js';
import { createRival } from '../js/ai/rivals.js';
import { createDuelArena, stepDuelArena, playDuel } from '../js/arena.js';
import { createRules } from '../js/rules.js';

const arena = { width: 1280, height: 720 };
const group = (cx, cy, n, spread = 20) => Array.from({ length: n }, (_, i) => ({ x: cx + (i % 5) * spread / 5, y: cy + Math.floor(i / 5) * spread / 5 }));
const snapshot = (extra = {}) => ({ arena, allies: group(200, 360, 20), rivals: group(1000, 360, 20), neutrals: [], terrain: [], rally: { active: false }, freeze: { cooldown: 0 },
    abilities: { freezeRadius: 270, conversionRadius: 65 }, ...extra });

test('the vocabulary has 34 stable ids and masks Freeze while it recharges', () => {
    assert.equal(ACTION_IDS.length, 34);
    assert.equal(decisionCandidates(snapshot()).candidates.size, 34);
    const recharging = decisionCandidates(snapshot({ freeze: { cooldown: 3 } }));
    assert.equal([...recharging.candidates.keys()].some(id => id.startsWith('freeze_')), false);
    assert.throws(() => validateAction({ type: 'rally', x: 1, y: 2, holdSeconds: 50 }, arena), /allowed range/);
    assert.throws(() => validateAction({ type: 'freeze', x: -1, y: 2 }, arena), /outside/);
});

test('the rival focus lands on a real group, not the empty gap between two groups', () => {
    const split = [...group(300, 200, 12), ...group(900, 500, 8)];
    const focus = densestPoint(split, 150);
    assert.ok(Math.hypot(focus.x - 304, focus.y - 204) < 30, JSON.stringify(focus));
    const [rival] = candidateTargets(snapshot({ rivals: split }));
    assert.ok(Math.hypot(rival.x - 600, rival.y - 350) > 200, 'not the centroid of both groups');
});

test('hard bot freezes the densest group within its actual Freeze radius and only when it covers three ships', () => {
    const action = chooseHardBotAction(snapshot(), 0);
    assert.equal(action.type, 'freeze');
    assert.ok(Math.abs(action.x - 1000) < 30);
    const sparse = chooseHardBotAction(snapshot({ rivals: [{ x: 1000, y: 100 }, { x: 100, y: 700 }] }), 1);
    assert.notEqual(sparse.type, 'freeze');
});

test('hard bot engage distance scales with the conversion radius', () => {
    const close = snapshot({ freeze: { cooldown: 5 }, allies: group(760, 360, 20), rivals: group(1000, 360, 20) });
    assert.equal(chooseHardBotAction(close, 0).type, 'rally', 'default rules: 240px is beyond 2.3 × 65px');
    const bigger = { ...close, abilities: { ...close.abilities, conversionRadius: 120 } };
    assert.notEqual(chooseHardBotAction(bigger, 0).type, 'rally', 'with a 120px radius the same gap is already close enough');
    assert.equal(chooseEasyBotAction(close, 8).type, 'rally');
    assert.equal(chooseEasyBotAction(close, 9).type, 'wait');
});

test('rally points avoid black holes, both as destinations and on the way', () => {
    const hole = { type: 'blackHole', x: 640, y: 360, radius: 30, reach: 84 };
    const moved = safeRallyPoint({ x: 100, y: 100 }, { x: 650, y: 360 }, [hole]);
    assert.ok(Math.hypot(moved.x - 640, moved.y - 360) >= 84 + 30 - 1e-9);
    const detour = safeRallyPoint({ x: 300, y: 360 }, { x: 1000, y: 360 }, [hole]);
    assert.ok(Math.abs(detour.y - 360) > 84, `path is diverted around the hole: ${JSON.stringify(detour)}`);
    const clear = safeRallyPoint({ x: 300, y: 100 }, { x: 1000, y: 100 }, [hole]);
    assert.deepEqual(clear, { x: 1000, y: 100 });
});

test('the Tactician returns a legal, deterministic action from the real simulation', () => {
    const duel = createDuelArena({ seed: 21 });
    for (let i = 0; i < 60 * 16; i++) stepDuelArena(duel);
    const one = chooseSearchAction(duel.sim, 'salamander', { horizon: 1 });
    const two = chooseSearchAction(duel.sim.toJSON(), 'salamander', { horizon: 1 });
    assert.deepEqual(one.action, two.action);
    assert.ok(one.evaluated >= 5);
    assert.doesNotThrow(() => validateAction(one.action, { width: 1280, height: 720 }));
});

test('policy v2 sees terrain and rule values; v1 models migrate with identical decisions', () => {
    const base = snapshot({ terrain: [{ type: 'blackHole', x: 640, y: 360, radius: 30, reach: 84 }] });
    const x = features(base);
    assert.equal(x.length, INPUTS);
    assert.ok(x.slice(128, 128 + 24).some(v => v > 0), 'black-hole coverage');
    const wider = features({ ...base, abilities: { ...base.abilities, freezeRadius: 400 } });
    assert.ok(wider[INPUTS - RULE_INPUTS.length] > x[INPUTS - RULE_INPUTS.length], 'Freeze radius is an input');

    let seed = 7;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32 - 0.5;
    const legacy = { version: 'swarm-linear-v1', weights: Array.from({ length: 128 * 34 }, random) };
    const migrated = validateModel(structuredClone(legacy));
    assert.equal(migrated.version, POLICY_VERSION);
    assert.equal(migrated.weights.length, PARAMETERS);
    const p = policy(base, migrated);
    const { candidates } = decisionCandidates(base);
    const legacyLogits = ACTION_IDS.map((id, a) => candidates.has(id) ? x.slice(0, 128).reduce((s, v, j) => s + v * legacy.weights[a * 128 + j], 0) : -Infinity);
    assert.equal(p.probabilities.indexOf(Math.max(...p.probabilities)), legacyLogits.indexOf(Math.max(...legacyLogits)));
    assert.throws(() => validateModel({ version: 'bad', weights: [] }));
});

test('the shipped model is v2 and stamped with the rules it was trained on', () => {
    const model = validateModel(JSON.parse(fs.readFileSync(new URL('../models/offline-policy.json', import.meta.url), 'utf8')));
    assert.match(model.rulesHash, /^[0-9a-f]{8}$/);
    const duel = createDuelArena({ seed: 5 });
    assert.doesNotThrow(() => validateAction(chooseAction(duel.sim.snapshotFor('salamander'), model), { width: 1280, height: 720 }));
});

test('rival controllers drive their own commander once per tick', () => {
    const duel = createDuelArena({ seed: 8 });
    duel.sim.time = 15;
    const reports = [];
    const rival = createRival('duel-hard', { style: 0 });
    rival.start(status => reports.push(status), duel.sim, 'salamander');
    rival.tick(duel.sim, 'salamander', 0);
    assert.equal(reports[0].state, 'online');
    assert.equal(duel.sim.commander('salamander').freezeCooldown, 10, 'hard bot opened with Freeze');
    assert.equal(duel.sim.commander('dragon').freezeCooldown, 0);
});

test('scripted bots still win against the easy bot under changed rules', () => {
    const rules = createRules({ freezeRadius: 380, conversionRadius: 80, maxSpeed: 4.8 });
    const wins = [11, 12, 13, 14].filter(seed => playDuel({ seed, rules, seconds: 90,
        controllers: { dragon: (s, second) => chooseHardBotAction(s, second, 0), salamander: (s, second) => chooseEasyBotAction(s, second) } }).winner === 'dragon').length;
    assert.ok(wins >= 3, `hard bot won ${wins}/4`);
});
