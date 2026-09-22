import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_MODEL_ID, JevController, actionFromDecisionResponse, buildBatchedRequest, buildDecisionRequest, compactSnapshot, configureOpponent, shouldAsk, validateAction } from '../js/ai/jev.js';
import { decisionCandidates } from '../js/ai/actions.js';
import { createDuelArena } from '../js/arena.js';
import { createOpponentServer } from '../server.mjs';

const snapshot = {
    arena: { width: 1000, height: 600 },
    allies: [{ x: 100, y: 200 }],
    rivals: [{ x: 700, y: 400 }, { x: 720, y: 380, frozen: true }],
    neutrals: [{ x: 500, y: 300 }],
    terrain: [{ x: 400, y: 300, radius: 20, reach: 20, type: 'asteroid' }],
    rally: { active: false, cooldown: 0, remaining: 0 },
    freeze: { cooldown: 0 },
};

test('compactSnapshot keeps real coordinates and rejects out-of-arena ships', () => {
    const result = compactSnapshot(snapshot);
    assert.deepEqual(result.rivals, [{ x: 700, y: 400 }, { x: 720, y: 380, frozen: true }]);
    assert.equal(result.terrain[0].reach, 20);
    assert.throws(() => compactSnapshot({ ...snapshot, rivals: [{ x: -1, y: 1 }] }), /outside the arena/);
});

test('requests are compact: 10px units, frozen flags, each action id listed once', () => {
    const request = buildDecisionRequest(snapshot);
    assert.equal(request.model, DEFAULT_MODEL_ID);
    assert.equal(request.state.rivals, '70,40 72,38,f');
    assert.equal(request.state.allies, '10,20');
    const { criteria } = request.questions.action;
    assert.equal(Object.keys(criteria).length, 34);
    assert.ok(Object.values(criteria).every(value => value === ''), 'ids are not repeated as descriptions');
    assert.equal(buildDecisionRequest({ ...snapshot, allies: [], rivals: [], neutrals: [] }).state.allies, '');
});

test('the rules in the prompt come from the snapshot, never from stale text', () => {
    const request = buildDecisionRequest({ ...snapshot, abilities: { freezeRadius: 350, freezeDuration: 7, freezeCooldown: 12 } });
    const text = request.questions.action.instructions;
    assert.match(text, /within 35 units for 7s/);
    assert.match(text, /recharges in 12s/);
    assert.equal(/prefer|only freeze|exploit|avoid/i.test(text), false, 'no tactical coaching');
    const real = createDuelArena({ seed: 3 }).sim.snapshotFor('salamander');
    assert.match(buildDecisionRequest(real).questions.action.instructions, /within 27 units for 10s/);
});

test('batched requests share the arena once and ask one question per fleet', () => {
    const duel = createDuelArena({ seed: 4 });
    const fleets = { A: duel.sim.snapshotFor('dragon'), B: duel.sim.snapshotFor('salamander') };
    const batched = buildBatchedRequest(fleets);
    assert.deepEqual(Object.keys(batched.questions), ['A', 'B']);
    const separate = JSON.stringify(buildDecisionRequest(fleets.A)).length + JSON.stringify(buildDecisionRequest(fleets.B)).length;
    assert.ok(JSON.stringify(batched).length < separate * 0.85, 'shared state is sent once');
    const key = [...decisionCandidates(compactSnapshot(fleets.B)).candidates.keys()].find(id => id.startsWith('rally_'));
    assert.equal(actionFromDecisionResponse({ answers: { B: { choice: key } } }, fleets.B, 'B').type, 'rally');
});

test('only legal action ids are accepted and Jev probabilities are kept for distillation', () => {
    const action = actionFromDecisionResponse({ answers: { action: { choice: 'wait', probabilities: { wait: 0.7, release: 0.3 } } } }, snapshot);
    assert.deepEqual(action, { type: 'wait' });
    assert.equal(action.probabilities.wait, 0.7);
    assert.throws(() => actionFromDecisionResponse({ answers: { action: { choice: 'rally_999_99' } } }, snapshot), /unknown action/);
    assert.throws(() => validateAction({ type: 'rally', x: 1, y: 2, holdSeconds: 50 }, snapshot.arena), /allowed range/);
});

test('the controller asks on events and a heartbeat, not every second', () => {
    const base = { ...snapshot, allies: Array(20).fill({ x: 1, y: 1 }), rivals: Array(20).fill({ x: 2, y: 2 }) };
    const last = { second: 10, freeze: 0, rally: false, allies: 20, rivals: 20 };
    assert.equal(shouldAsk(base, null, 0), true);
    assert.equal(shouldAsk(base, last, 11), false);
    assert.equal(shouldAsk(base, last, 12), true, 'heartbeat');
    assert.equal(shouldAsk(base, { ...last, freeze: 3 }, 11), true, 'Freeze became ready');
    assert.equal(shouldAsk(base, { ...last, rally: true }, 11), true, 'Rally ended');
    assert.equal(shouldAsk({ ...base, allies: base.allies.slice(3) }, last, 11), true, 'fleets shifted');
});

test('the controller never overlaps requests, tracks spend, and drops answers after stop', async () => {
    let calls = 0, release;
    const applied = [], statuses = [];
    const controller = new JevController({
        fetchImpl: () => { calls++; return new Promise(resolve => { release = () => resolve(new Response(JSON.stringify({ action: { type: 'release' }, usage: { cost: 0.0001 } }))); }); },
        onAction: action => applied.push(action), onStatus: status => statuses.push(status),
    });
    controller.start();
    assert.equal(controller.tick(snapshot, 0), true);
    assert.equal(controller.tick(snapshot, 5), false, 'in flight');
    release();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(applied, [{ type: 'release' }]);
    assert.equal(controller.spentUsd, 0.0001);
    assert.equal(statuses.at(-1).state, 'online');
    controller.tick(snapshot, 10);
    controller.stop();
    release();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(applied.length, 1, 'stale answer ignored');
    assert.equal(calls, 2);
});

async function runningApp(options = {}) {
    const app = createOpponentServer({ port: 0, ...options });
    await app.listen();
    return { app, base: `http://127.0.0.1:${app.server.address().port}` };
}
const jevAnswer = answers => async () => new Response(JSON.stringify({ answers, model: DEFAULT_MODEL_ID, usage: { cost: 0.00005, input_tokens: 1200 } }), { status: 200 });

test('proxy stays offline without a key and rejects foreign origins', async () => {
    const { app, base } = await runningApp({ apiKey: '' });
    try {
        const offline = await fetch(`${base}/api/opponent/decision`, { method: 'POST', body: JSON.stringify({ snapshot }) });
        assert.equal(offline.status, 503);
        const forbidden = await fetch(`${base}/api/opponent/config`, { method: 'POST', headers: { Origin: 'https://evil.example' }, body: JSON.stringify({ apiKey: 'secret' }) });
        assert.equal(forbidden.status, 403);
        const status = await (await fetch(`${base}/api/opponent/status`)).json();
        assert.equal(status.configured, false);
        assert.equal(status.apiKey, undefined);
    } finally { await app.close(); }
});

test('proxy keeps the key server-side, calls the Decisions endpoint and meters usage', async () => {
    let seen;
    const { app, base } = await runningApp({ apiKey: 'sk-test-only', fetchImpl: async (url, options) => { seen = { url: String(url), options }; return jevAnswer({ action: { choice: 'release' } })(); } });
    try {
        const response = await fetch(`${base}/api/opponent/decision`, { method: 'POST', body: JSON.stringify({ snapshot }) });
        const body = await response.json();
        assert.deepEqual(body.action, { type: 'release' });
        assert.equal(body.usage.cost, 0.00005);
        assert.equal(seen.url, 'https://openrouter.ai/api/alpha/decisions');
        assert.equal(seen.options.headers.Authorization, 'Bearer sk-test-only');
        assert.equal(JSON.parse(seen.options.body).state.rivals, '70,40 72,38,f');
        const status = await (await fetch(`${base}/api/opponent/status`)).json();
        assert.equal(status.calls, 1);
        assert.equal(status.spentUsd, 0.00005);
    } finally { await app.close(); }
});

test('batched endpoint answers several fleets with one upstream call', async () => {
    let upstreamCalls = 0;
    const { app, base } = await runningApp({ apiKey: 'sk', fetchImpl: async () => { upstreamCalls++; return jevAnswer({ A: { choice: 'wait' }, B: { choice: 'release' } })(); } });
    try {
        const body = await (await fetch(`${base}/api/opponent/decisions`, { method: 'POST', body: JSON.stringify({ fleets: { A: snapshot, B: snapshot } }) })).json();
        assert.deepEqual(body.actions, { A: { type: 'wait' }, B: { type: 'release' } });
        assert.equal(upstreamCalls, 1);
        const invalid = await fetch(`${base}/api/opponent/decisions`, { method: 'POST', body: JSON.stringify({ fleets: {} }) });
        assert.equal(invalid.status, 400);
    } finally { await app.close(); }
});

test('the proxy stops at its spending cap', async () => {
    const { app, base } = await runningApp({ apiKey: 'sk', budgetUsd: 0.00005, fetchImpl: jevAnswer({ action: { choice: 'wait' } }) });
    try {
        assert.equal((await fetch(`${base}/api/opponent/decision`, { method: 'POST', body: JSON.stringify({ snapshot }) })).status, 200);
        const capped = await fetch(`${base}/api/opponent/decision`, { method: 'POST', body: JSON.stringify({ snapshot }) });
        assert.equal(capped.status, 402);
        assert.equal((await capped.json()).code, 'budget_exhausted');
    } finally { await app.close(); }
});

test('config accepts a pasted key without returning it and persists it to .env only', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'swarm-env-test-'));
    const envFile = path.join(dir, '.env');
    await fs.writeFile(envFile, 'OPPONENT_PORT=4174\nOPENROUTER_API_KEY=old-test-key\n');
    const { app, base } = await runningApp({ apiKey: '', envFile, rootDir: dir });
    try {
        const result = await configureOpponent({ apiKey: 'sk-test-persist-only' }, { endpoint: `${base}/api/opponent/config` });
        assert.equal(result.configured, true);
        assert.equal(result.apiKey, undefined);
        const saved = await fs.readFile(envFile, 'utf8');
        assert.ok(saved.includes('OPPONENT_PORT=4174') && saved.includes('sk-test-persist-only') && !saved.includes('old-test-key'));
        assert.equal((await fetch(`${base}/.env`)).status, 404);
        assert.equal((await (await fetch(`${base}/api/opponent/status`)).text()).includes('sk-test-persist-only'), false);
    } finally { await app.close(); await fs.rm(dir, { recursive: true, force: true }); }
});

test('static server serves the app but never source, tooling or traversal', async () => {
    const { app, base } = await runningApp({ apiKey: '' });
    try {
        for (const blocked of ['/../server.mjs', '/server.mjs', '/scripts/train-local.mjs', '/tests/jev.test.mjs', '/package.json', '/.env']) {
            assert.equal((await fetch(base + blocked)).status, 404, blocked);
        }
        for (const served of ['/index.html', '/app.css', '/js/game.js', '/manifest.webmanifest', '/models/offline-policy.json']) {
            const response = await fetch(base + served);
            assert.equal(response.status, 200, served);
        }
        assert.match((await fetch(`${base}/manifest.webmanifest`)).headers.get('content-type'), /manifest\+json/);
    } finally { await app.close(); }
});
