// Performance and rendering regressions with small canvas stubs, so they run in CI without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const noop = () => {};
const metrics = { gradients: 0, gridImages: 0, neutralStrokes: 0 };
function makeContext() {
    const context = { save: noop, restore: noop, beginPath: noop, closePath: noop, fill: noop, translate: noop, rotate: noop, moveTo: noop, lineTo: noop, arc: noop, clearRect: noop, fillRect: noop, setLineDash: noop,
        stroke() { if (context.strokeStyle === '#aab4c3') metrics.neutralStrokes++; },
        drawImage: () => { metrics.gridImages++; },
        createLinearGradient: () => { metrics.gradients++; return { addColorStop: noop }; },
        createRadialGradient: () => ({ addColorStop: noop }) };
    return context;
}
const makeCanvas = () => { const context = makeContext(); return { width: 0, height: 0, getContext: () => context }; };
globalThis.localStorage = { getItem: () => null, setItem: noop };
globalThis.window = { innerWidth: 390, innerHeight: 844 };
globalThis.matchMedia = () => ({ matches: false });
globalThis.document = { createElement: makeCanvas };

const { Boid } = await import('../js/boid.js');
const { Renderer } = await import('../js/renderer.js');
const quadtree = await import('../js/quadtree.js');
const { createRules } = await import('../js/rules.js');
const { NEUTRAL_LOOK, TEAMS } = await import('../js/catalog.js');
const rules = createRules();

const seeded = seed => () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
function fleet(sim, count) {
    const random = Math.random;
    Math.random = seeded(0x51ced00d + count);
    try {
        return Array.from({ length: count }, (_, i) => {
            const boid = sim.make(20 + (i * 73) % 1240, 20 + (i * 97) % 680, i % 4 === 0 ? 'salamander' : 'dragon');
            boid.vel.x = 1.8 + (i % 7) * 0.2;
            boid.vel.y = -1.4 + (i % 11) * 0.18;
            return boid;
        });
    } finally { Math.random = random; }
}
function ticks(sim, count, n) {
    const ships = fleet(sim, count);
    for (let t = 0; t < n; t++) {
        const tree = new sim.QuadTree(new sim.Rectangle(640, 360, 640, 360), 4);
        for (const boid of ships) tree.insert(boid);
        for (const boid of ships) { sim.flock(boid, tree.query(new sim.Circle(boid.pos.x, boid.pos.y, sim.radius))); sim.update(boid); }
    }
    for (const boid of ships) assert.ok([boid.pos.x, boid.pos.y, boid.vel.x, boid.vel.y].every(Number.isFinite), 'motion stays finite');
}
function benchmark(sim, count, n = 90) {
    ticks(sim, count, 12);
    const samples = [0, 1, 2].map(() => { const start = process.hrtime.bigint(); ticks(sim, count, n); return Number(process.hrtime.bigint() - start) / 1e6; });
    return samples.sort((a, b) => a - b)[1];
}
const current = { ...quadtree, radius: rules.perceptionRadius, make: (x, y, team) => new Boid(x, y, team, rules), flock: (b, n) => b.flock(n, rules, 1), update: b => b.update(1280, 720, rules, 1) };

test('quadtree circular queries prune nodes and match brute force', () => {
    const { QuadTree, Rectangle, Circle } = quadtree;
    const points = Array.from({ length: 500 }, (_, id) => ({ id, pos: { x: 11 + (id * 71) % 978, y: 13 + (id * 43) % 674 } }));
    const tree = new QuadTree(new Rectangle(500, 350, 500, 350), 4);
    for (const point of points) assert.equal(tree.insert(point), true);
    const probe = new Circle(100, 100, 12);
    let calls = 0;
    const contains = probe.contains.bind(probe);
    probe.contains = point => { calls++; return contains(point); };
    tree.query(probe);
    assert.ok(calls < points.length);
    for (let i = 0; i < 100; i++) {
        const x = 30 + (i * 83) % 940, y = 30 + (i * 47) % 640, r = 20 + (i * 19) % 180;
        assert.deepEqual(tree.query(new Circle(x, y, r)).map(p => p.id).sort((a, b) => a - b), points.filter(p => (p.pos.x - x) ** 2 + (p.pos.y - y) ** 2 <= r * r).map(p => p.id).sort((a, b) => a - b));
    }
});

test('steering reuses its force buffers and ships wrap into the spatial index', () => {
    const probe = new Boid(100, 100, 'dragon', rules), other = new Boid(105, 100, 'salamander', rules);
    assert.equal(probe.separate([probe, other], rules), probe._separationForce);
    assert.equal(probe.align([probe, other], rules), probe._alignmentForce);
    assert.equal(probe.cohere([probe, other], rules), probe._cohesionForce);
    assert.equal(probe.rallyTowards({ x: 200, y: 200 }, rules), probe._rallyForce);
    assert.equal(probe.fleePoint({ x: 0, y: 0 }, 1, 4, rules), probe._fleeForce);
    const edge = new Boid(1279.9, 100, 'dragon', rules);
    edge.vel.set(3, 0);
    edge.update(1280, 720, rules);
    assert.ok(edge.pos.x >= 0 && edge.pos.x < 1280);
});

test('dense compact rendering keeps gray ships visible, caches the grid and skips gradients', () => {
    metrics.gradients = metrics.gridImages = metrics.neutralStrokes = 0;
    const renderer = new Renderer(makeCanvas());
    renderer.resize();
    const ships = fleet(current, 160).map((boid, i) => { if (i % 2) boid.team = 'neutral'; return boid; });
    renderer.drawGrid();
    renderer.drawShips(ships, team => team === 'neutral' ? NEUTRAL_LOOK : TEAMS[team]);
    assert.equal(renderer.shipScale, 1.7);
    assert.equal(metrics.gridImages, 1);
    assert.equal(metrics.gradients, 0);
    assert.ok(metrics.neutralStrokes > 0);
});

test('simulation speed against the last commit', async () => {
    let baseline = null, sandbox = null;
    try {
        const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
        sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-perf-'));
        for (const file of ['boid.js', 'vector.js', 'config.js', 'quadtree.js']) fs.writeFileSync(path.join(sandbox, file), execFileSync('git', ['show', `HEAD:js/${file}`], { cwd: repo, encoding: 'utf8' }));
        const { Boid: OldBoid } = await import(pathToFileURL(path.join(sandbox, 'boid.js')).href);
        const oldTree = await import(pathToFileURL(path.join(sandbox, 'quadtree.js')).href);
        const { CONFIG } = await import(pathToFileURL(path.join(sandbox, 'config.js')).href);
        const difficulty = { enemyCohesion: 1 };
        baseline = { ...oldTree, radius: CONFIG.perceptionRadius, make: (x, y, team) => new OldBoid(x, y, team), flock: (b, n) => b.flock(n, difficulty, b.team !== 'dragon'), update: b => b.update(1280, 720, difficulty, 1) };
    } catch (error) {
        console.log(`PERF baseline unavailable: ${error.message}`);
    }
    for (const count of [160, 320]) {
        const now = benchmark(current, count);
        if (baseline) {
            const before = benchmark(baseline, count);
            console.log(`PERF ${count} ships × 90 ticks: ${now.toFixed(1)} ms (last commit ${before.toFixed(1)} ms, ${(before / now).toFixed(2)}×)`);
            assert.ok(now < before * 1.5, 'no large simulation slowdown');
        } else console.log(`PERF ${count} ships × 90 ticks: ${now.toFixed(1)} ms`);
    }
    if (sandbox) fs.rmSync(sandbox, { recursive: true, force: true });
});
