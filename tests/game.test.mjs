// End-to-end checks of the playable game through a minimal DOM stub: every
// lesson, every mode, duel lifecycle, touch input and the HUD.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('every browser module parses as an ES module', () => {
    for (const dir of ['../js/', '../js/ai/']) {
        for (const file of fs.readdirSync(new URL(dir, import.meta.url)).filter(f => f.endsWith('.js'))) {
            const run = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(dir + file, import.meta.url))], { encoding: 'utf8' });
            assert.equal(run.status, 0, `${file}: ${run.stderr}`);
        }
    }
});

let seed = 314159;
Math.random = () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
const elements = new Map();
function element(id = '') {
    const classes = new Set(), listeners = {}, attributes = {};
    const el = {
        id, children: [], style: { setProperty() {} }, dataset: {}, textContent: '', value: '', disabled: false, hidden: false,
        classList: { add: (...xs) => xs.forEach(x => classes.add(x)), remove: (...xs) => xs.forEach(x => classes.delete(x)), contains: x => classes.has(x), toggle: (x, force) => { const on = force ?? !classes.has(x); on ? classes.add(x) : classes.delete(x); return on; } },
        addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
        click: () => (listeners.click || []).forEach(fn => fn({ target: el })),
        emit: (type, event = {}) => (listeners[type] || []).forEach(fn => fn({ target: el, preventDefault() {}, type, ...event })),
        setAttribute: (k, v) => { attributes[k] = String(v); }, getAttribute: k => attributes[k] ?? null, removeAttribute: k => { delete attributes[k]; },
        appendChild: x => { el.children.push(x); return x; }, replaceChildren: (...xs) => { el.children = xs; },
        querySelector: selector => get(id + selector), querySelectorAll: () => [], focus() {}, closest: () => null, contains: () => false,
        getContext: () => new Proxy({}, { get: (_, key) => String(key).startsWith('create') ? () => ({ addColorStop() {} }) : () => {} }),
        getBoundingClientRect: () => ({ left: 0, top: 0, width: el.width || 1280, height: el.height || 720 }),
    };
    return el;
}
const get = id => { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); };
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.document = { getElementById: get, querySelector: get, querySelectorAll: () => [], addEventListener() {}, createElement: () => element(), createTextNode: text => ({ text }), documentElement: element(), body: element(), hidden: false };
globalThis.window = globalThis;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.addEventListener = () => {};
globalThis.requestAnimationFrame = () => {};
globalThis.matchMedia = () => ({ matches: false });

const { Game } = await import('../js/game.js');
const { TutorialMode } = await import('../js/tutorial.js');
const { LESSONS } = await import('../js/lessons.js');
const { UPGRADES } = await import('../js/catalog.js');
const { levelRules, buildWorld, validCheckpoint } = await import('../js/worlds.js');
const game = new Game();
game.audio = new Proxy({}, { get: () => () => {} });
const tutorial = new TutorialMode(game);
const advance = seconds => { for (let t = 0; t < seconds * 60 && game.gameState === 'playing'; t++) game.update(1 / 60); };
const index = id => LESSONS.findIndex(lesson => lesson.id === id);
const begin = i => { tutorial.start(i); get('btn-intro-start').click(); if (LESSONS[i].abilities.includes('freeze')) game.gameTime = 15; };
const aim = (x, y) => { game.input.pointer.x = x; game.input.pointer.y = y; };

test('all sixteen lessons set up, gate Freeze and never auto-complete', () => {
    assert.equal(LESSONS.length, 16);
    assert.deepEqual(LESSONS.slice(0, 2).map(l => l.id), ['gather', 'tap-rally'], 'tap steering follows the first movement lesson');
    assert.equal(LESSONS.at(-1).id, 'finale');
    LESSONS.forEach((lesson, i) => {
        tutorial.start(i);
        assert.equal(game.gameState, 'lesson-intro');
        assert.equal(game.boids.length, lesson.playerCount + (lesson.neutrals || 0) + lesson.enemies.reduce((s, e) => s + e.count, 0));
        assert.equal(get('slot-freeze').disabled, !lesson.abilities.includes('freeze'));
        assert.equal(game.player.freezeCooldown, 0);
        get('btn-intro-start').click();
        game.update(1 / 60);
        assert.equal(game.gameState, 'playing', `${lesson.id} must not auto-complete`);
    });
});

test('player Freeze: half the group, 270px boundary, pause-safe timers, recharge, free misses', () => {
    begin(index('wide-freeze'));
    game.boids = [];
    const ally = game.addBoid(640, 350, 'dragon');
    const near = game.addBoid(910, 350, 'salamander');
    const spared = game.addBoid(840, 350, 'salamander');
    const second = game.addBoid(820, 350, 'salamander');
    const outside = game.addBoid(911, 350, 'salamander');
    aim(640, 350);
    game.setRally(true);
    game.castFreeze();
    assert.deepEqual([near.frozen, spared.frozen, second.frozen, outside.frozen, ally.frozen], [true, false, true, false, false]);
    assert.equal(near.freezeRemaining, 10);
    assert.equal(game.player.freezeCooldown, 10);
    assert.equal(game.player.rallying, false);
    game.pause(); game.update(5);
    assert.equal(near.freezeRemaining, 10);
    game.resume();
    tutorial.update = () => {};
    advance(1);
    assert.ok(Math.abs(near.freezeRemaining - 9) < 0.01);
    const frozenAt = { ...near.pos };
    advance(2);
    assert.deepEqual({ x: near.pos.x, y: near.pos.y }, { x: frozenAt.x, y: frozenAt.y }, 'frozen ships do not drift');
    advance(7.1);
    assert.equal(game.player.freezeCooldown, 0);
    assert.equal(near.frozen, false);
    delete tutorial.update;
    game.boids = [ally];
    game.castFreeze();
    assert.equal(game.player.freezeCooldown, 0, 'empty casts keep the charge');
});

test('every fresh mode shares the 15-second Freeze lockout', () => {
    game.quitToMenu();
    Object.assign(game, { practice: false, gameMode: 'conquest', playerTeam: 'dragon' });
    game.startGame();
    const enemy = game.boids.find(b => b.team !== 'dragon');
    aim(enemy.pos.x, enemy.pos.y);
    game.castFreeze();
    assert.equal(game.player.freezeWait, 15);
    assert.equal(game.boids.some(b => b.team !== 'dragon' && b.frozen), false);
    game.gameTime = 14.99; game.input.pressFreeze();
    assert.equal(game.input.freezeAiming, false);
    game.gameTime = 15; game.castFreeze();
    assert.equal(game.player.freezeCooldown, 10);
    assert.ok(game.boids.some(b => b.team !== 'dragon' && b.frozen));
});

test('touch: two-step Freeze aim, no accidental Rally, multi-touch isolation, cancelled gestures', () => {
    begin(index('freeze'));
    game.input.isTouch = true;
    get('slot-freeze').click();
    assert.equal(game.input.freezeAiming, true);
    const canvas = get('game-canvas');
    canvas.emit('pointerdown', { pointerType: 'touch', pointerId: 1, button: 0, clientX: 870, clientY: 317 });
    assert.equal(game.input.freezeAiming, false);
    assert.equal(game.player.rallying, false);
    assert.equal(game.player.freezeCooldown, 10);
    canvas.emit('pointerdown', { pointerType: 'touch', pointerId: 2, button: 0, clientX: 300, clientY: 300 });
    assert.equal(game.player.rallying, true);
    canvas.emit('pointerdown', { pointerType: 'touch', pointerId: 3, button: 0, clientX: 900, clientY: 500 });
    assert.equal(game.input.pointer.x, 300, 'a second finger must not steal the Rally target');
    canvas.emit('pointercancel', { pointerId: 2 });
    assert.equal(game.player.rallying, false);
    assert.equal(game.input.pointerId, null);
    game.input.isTouch = false;
});

test('Conquest maps stay fixed and restart keeps the seed', () => {
    game.showTeamSelect('conquest'); game.selectTeam('dragon');
    const terrain = () => game.sim.terrain.map(f => f.toJSON());
    const original = terrain(), originalSeed = game.world.seed;
    advance(3);
    assert.deepEqual(terrain(), original);
    game.startGame();
    assert.equal(game.world.seed, originalSeed);
    assert.deepEqual(terrain(), original);
});

test('Levels: bounded difficulty, seeded maps, advancement, retry and resume', () => {
    assert.deepEqual(levelRules(10), levelRules(10000));
    assert.deepEqual(buildWorld(42, 5), buildWorld(42, 5));
    for (const width of [320, 390, 768, 1280]) {
        const world = buildWorld(2, 10, width, 720);
        assert.ok(world.terrain.length <= 7);
        for (const t of world.terrain) assert.ok(t.x >= 0 && t.x <= width && t.y >= 0 && t.y <= 720 && Number.isFinite(t.radius));
    }
    game.showTeamSelect('levels'); game.selectTeam('phoenix');
    assert.equal(game.gameState, 'sector-intro');
    const sectorOne = game.world.seed;
    get('btn-intro-start').click(); game.update(1 / 60);
    assert.equal(game.gameState, 'playing', 'no immediate upgrade popup');
    game.victory();
    get('btn-result-primary').click();
    assert.equal(game.level, 2);
    assert.notEqual(game.world.seed, sectorOne);
    const sectorTwo = game.world.seed;
    game.restart();
    assert.equal(game.world.seed, sectorTwo);
    game.quitToMenu();
    assert.equal(game.resumeExpedition(), true);
    assert.deepEqual([game.level, game.world.seed, game.playerTeam], [2, sectorTwo, 'phoenix']);
    assert.equal(validCheckpoint({ level: -3, seed: 1, team: 'dragon' }), false);
});

test('Zen shifts terrain and replenishes; resizing scales the existing world', () => {
    game.showTeamSelect('zen'); game.selectTeam('dragon');
    const zenSeed = game.world.seed;
    game.zenShiftTimer = 0.001;
    game.update(1 / 60);
    assert.equal(game.zenShifts, 1);
    assert.notEqual(game.world.seed, zenSeed);
    game.boids = [];
    game.replenishZen();
    assert.ok(game.boids.some(b => b.team === 'dragon') && game.boids.some(b => b.team !== 'dragon'));
    const before = game.sim.terrain.map(f => ({ x: f.x / 1280, y: f.y / 720 }));
    globalThis.innerWidth = 390; globalThis.innerHeight = 844;
    game.resizeWorld();
    assert.equal(game.canvas.width, 390);
    assert.equal(game.input.pointerId, null);
    game.sim.terrain.forEach((f, i) => { assert.ok(Math.abs(f.x / game.renderer.width - before[i].x) < 1e-10); assert.ok(Math.abs(f.y / game.renderer.height - before[i].y) < 1e-10); });
    globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
    game.resizeWorld();
});

test('control lessons are winnable through real simulation and progress persists', () => {
    for (const id of ['gather', 'surround', 'wide-freeze', 'freeze', 'freeze-rhythm', 'recruits']) {
        const i = index(id);
        begin(i);
        for (let attempt = 0; attempt < 12 && game.gameState === 'playing'; attempt++) {
            const lesson = LESSONS[i], target = lesson.target, enemy = game.boids.find(b => b.team !== game.playerTeam);
            aim(target ? target.x * game.renderer.width : enemy?.pos.x ?? 870, target ? target.y * game.renderer.height : enemy?.pos.y ?? 317);
            game.setRally(true); advance(3);
            game.setRally(false); advance(0.5);
            if (lesson.abilities.includes('freeze')) game.castFreeze();
            advance(5);
        }
        assert.equal(game.gameState, 'victory', `${id} must be winnable: ${JSON.stringify(tutorial.progress)}`);
    }
    assert.ok(JSON.parse(store.get('swarm-lessons-v2')).includes('recruits'));
    tutorial.next();
    assert.equal(tutorial.index, index('recruits') + 1);
    assert.equal(tutorial.progress.recruited, 0);
    tutorial.showLessons();
    assert.equal(get('lesson-grid').children.length, LESSONS.length);
});

test('navigation lessons are completed by steering alone', () => {
    for (const id of ['asteroids', 'nebula', 'black-hole']) {
        begin(index(id));
        game.setRally(true);
        for (let tick = 0; tick < 60 * 75 && game.gameState === 'playing'; tick++) {
            const lesson = LESSONS[index(id)], target = lesson.route?.[tutorial.progress.waypoints] || lesson.target;
            if (target) aim(target.x * game.renderer.width, target.y * game.renderer.height);
            game.update(1 / 60);
        }
        assert.equal(game.gameState, 'victory', `${id}: ${JSON.stringify(tutorial.progress)}`);
    }
});

test('mode lessons: two sectors, one reinforcement wave, evolving terrain', () => {
    begin(index('levels'));
    const first = game.world.seed;
    game.boids = game.boids.filter(b => b.team === game.playerTeam);
    tutorial.update();
    assert.equal(tutorial.progress.sectors, 1);
    assert.notEqual(game.world.seed, first);
    assert.ok(game.boids.some(b => b.team !== game.playerTeam));
    game.boids = game.boids.filter(b => b.team === game.playerTeam);
    tutorial.update();
    assert.equal(game.gameState, 'playing', 'a short completion beat first');
    advance(2);
    assert.equal(game.gameState, 'victory');
    begin(index('survival'));
    tutorial.progress.recruited = 8;
    tutorial.update();
    assert.equal(tutorial.progress.waves, 2);
    const size = game.boids.length;
    tutorial.update();
    assert.equal(game.boids.length, size, 'the second wave spawns once');
    begin(index('zen'));
    const seedBefore = game.world.seed;
    game.playerActed = true;
    game.zenShiftTimer = 0.001;
    game.update(1 / 60);
    assert.notEqual(game.world.seed, seedBefore);
    assert.equal(game.zenShifts, 1);
});

test('upgrades last one match and every mode renders', () => {
    game.showTeamSelect('conquest'); game.selectTeam('dragon');
    const radius = game.player.freezeRadius, ships = game.boids.length;
    UPGRADES.find(u => u.id === 'wider-freeze').apply(game.sim.modifiers('dragon'), game.sim, 'dragon');
    UPGRADES.find(u => u.id === 'reinforcements').apply(game.sim.modifiers('dragon'), game.sim, 'dragon');
    assert.ok(game.player.freezeRadius > radius);
    assert.equal(game.boids.length, ships + 25);
    tutorial.start(0);
    assert.equal(game.player.freezeRadius, radius);
    get('btn-intro-start').click();
    game.renderer.render(game, 0.016);
    game.showTeamSelect('levels'); game.selectTeam('dragon'); game.renderer.render(game, 0.016);
    game.showTeamSelect('survival'); game.selectTeam('dragon'); game.renderer.render(game, 0.016);
    advance(5);
    assert.equal(game.survival.wave, 1, 'the first survival wave arrives');
});

test('duels: shared rules, bounded gray ships, symmetric Freeze and pause handling', async () => {
    await game.startDuelMode('duel-hard');
    assert.equal(game.gameMode, 'duel');
    assert.deepEqual(game.sim.teams, ['dragon', 'salamander']);
    assert.equal(game.boids.filter(b => b.team === 'neutral').length, 24);
    assert.equal(game.sim.modifiers('salamander').speed, 1);
    const duelSeed = game.world.seed;
    for (let i = 0; i < 30; i++) game.updateDuel(12);
    assert.ok(game.boids.length <= 220);
    assert.ok(game.boids.filter(b => b.team === 'neutral').length <= 40);
    assert.equal(game.world.seed, duelSeed);

    game.gameTime = 15;
    const rival = game.sim.commander(game.opponentTeam);
    rival.freezeCooldown = 0;
    game.player.freezeCooldown = 10;
    const [ally, spared] = game.boids.filter(b => b.team === game.playerTeam);
    const gray = game.boids.find(b => b.team === 'neutral');
    for (const b of [ally, spared, gray]) b.pos.set(300, 300);
    game.boids.filter(b => b.team === game.playerTeam && b !== ally && b !== spared).forEach(b => b.pos.set(1200, 700));
    rival.apply({ type: 'freeze', x: 300, y: 300 });
    assert.equal(ally.freezeRemaining, 10, 'the rival Freeze works while the player recharges');
    assert.equal(spared.freezeRemaining, 0);
    assert.equal(gray.freezeRemaining, 0);
    assert.equal(rival.freezeCooldown, 10);

    rival.apply({ type: 'rally', x: 400, y: 400, holdSeconds: 1 });
    rival.apply({ type: 'wait' });
    assert.equal(rival.rallying, true);
    for (let i = 0; i < 66; i++) game.sim.step();
    assert.equal(rival.rallying, false);
    assert.ok(rival.coolOff > 0);

    game.pause();
    const cooldown = rival.freezeCooldown;
    game.update(10);
    assert.equal(rival.freezeCooldown, cooldown, 'paused time does not pass');
    game.resume();
    assert.equal(game.gameState, 'playing');
    game.quitToMenu();
});

test('tap Rally keeps its target after lifting a finger, on touch and mouse', () => {
    for (const pointerType of ['touch', 'mouse']) {
        game.showTeamSelect('conquest'); game.selectTeam('dragon');
        game.input.toggleRally();
        const canvas = get('game-canvas');
        canvas.emit('pointerdown', { pointerType, pointerId: 41, button: 0, clientX: 400, clientY: 300 });
        canvas.emit('pointerup', { pointerId: 41 });
        assert.equal(game.player.rallying, true);
        canvas.emit('pointermove', { pointerId: 41, clientX: 700, clientY: 500 });
        assert.equal(game.input.pointer.x, 400, 'a latched Rally moves only on taps');
        game.input.toggleRally();
        assert.equal(game.player.rallying, false);
        game.input.toggleRally();
        game.pause();
        assert.equal(game.input.rallyLatched, false);
    }
});

test('Jev entry starts a two-fleet duel and the HUD excludes gray ships from shares', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async url => ({ ok: true, json: async () => String(url).includes('status') ? { configured: true } : { action: { type: 'wait' }, usage: { cost: 0.0001 } } });
    try {
        game.practice = true;
        await game.startDuelMode('duel-jev');
        assert.equal(game.gameMode, 'duel');
        assert.equal(game.practice, false);
        assert.equal(game.gameState, 'playing');
        assert.ok(game.boids.every(b => ['dragon', 'salamander', 'neutral'].includes(b.team)));
        game.update(1 / 60);
        assert.deepEqual(Object.keys(game.sim.counts).sort(), ['dragon', 'neutral', 'salamander']);
        game.sim.counts = { dragon: 80, salamander: 80, neutral: 40 };
        game.ui.refresh();
        assert.equal(get('share-value').textContent, '50%');
        assert.match(get('match-status').textContent, /unclaimed/);
        await new Promise(resolve => setImmediate(resolve));
        game.quitToMenu();
    } finally { globalThis.fetch = realFetch; }
});

test('tap steering and duel basics lessons can be completed', () => {
    begin(index('tap-rally'));
    aim(game.renderer.width * 0.68, game.renderer.height * 0.44);
    game.input.toggleRally(); advance(6);
    game.input.toggleRally(); advance(2);
    assert.equal(game.gameState, 'victory', 'tap steering lesson');
    begin(index('duel-basics'));
    for (let attempt = 0; attempt < 25 && game.gameState === 'playing'; attempt++) {
        const target = game.boids.find(b => b.team === 'neutral' && tutorial.progress.neutralRecruits < 6) || game.boids.find(b => b.team !== 'dragon' && b.team !== 'neutral');
        if (!target) { advance(2); break; }
        aim(target.pos.x, target.pos.y);
        game.setRally(true); advance(2);
        game.setRally(false); game.castFreeze(); advance(4);
    }
    assert.equal(game.gameState, 'victory', `duel lesson: ${JSON.stringify(tutorial.progress)}`);
});
