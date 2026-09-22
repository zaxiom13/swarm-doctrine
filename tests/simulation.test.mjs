import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../js/simulation.js';
import { createRules } from '../js/rules.js';
import { randomFrom } from '../js/worlds.js';
import { createDuelArena, playDuel, stepDuelArena } from '../js/arena.js';
import { TerrainField } from '../js/terrain.js';

const world = (rules = createRules()) => {
    const sim = new Simulation({ rules, random: randomFrom(1) });
    sim.setTeams(['dragon', 'salamander']);
    sim.time = 15;
    return sim;
};

test('Freeze stops every other eligible rival, includes its boundary, spares allies and gray ships', () => {
    const sim = world(), me = sim.commander('dragon');
    const ally = sim.addBoid(640, 350, 'dragon');
    const edge = sim.addBoid(910, 350, 'salamander');
    const spared = sim.addBoid(840, 350, 'salamander');
    const second = sim.addBoid(820, 350, 'salamander');
    const outside = sim.addBoid(911, 350, 'salamander');
    const gray = sim.addBoid(640, 360, 'neutral');
    me.rally(640, 350);
    const result = me.freeze(640, 350);
    assert.deepEqual([edge.frozen, spared.frozen, second.frozen, outside.frozen, ally.frozen, gray.frozen], [true, false, true, false, false, false]);
    assert.equal(result.eligible.length, 3);
    assert.equal(edge.freezeRemaining, 10);
    assert.equal(me.freezeCooldown, 10);
    assert.equal(me.rallying, false, 'a successful Freeze releases Rally');
    assert.equal(me.coolOff, 0, 'and skips the recruit cool-off');
});

test('Freeze misses keep the charge and the opening lockout applies to every team', () => {
    const sim = world();
    sim.addBoid(100, 100, 'salamander');
    sim.time = 14.99;
    assert.equal(sim.commander('dragon').freeze(100, 100), null);
    assert.ok(sim.commander('dragon').freezeWait > 0);
    sim.time = 15;
    assert.equal(sim.commander('dragon').freeze(900, 600), null, 'empty cast');
    assert.equal(sim.commander('dragon').freezeCooldown, 0);
    assert.equal(sim.drainEvents().at(-1).type, 'freeze-miss');
});

test('one team’s Freeze cooldown never blocks another team (regression)', () => {
    const sim = world();
    sim.addBoid(100, 100, 'salamander');
    sim.addBoid(700, 400, 'dragon');
    assert.ok(sim.commander('dragon').freeze(100, 100));
    assert.equal(sim.commander('dragon').freezeCooldown, 10);
    assert.ok(sim.commander('salamander').freeze(700, 400), 'the rival can still cast');
});

test('rule changes flow through: a wider Freeze radius reaches farther', () => {
    const sim = world(createRules({ freezeRadius: 350 }));
    const target = sim.addBoid(330, 0, 'salamander');
    sim.commander('dragon').freeze(0, 0);
    assert.equal(target.frozen, true);
    assert.equal(sim.snapshotFor('dragon').abilities.freezeRadius, 350);
});

test('frozen ships neither recruit nor defend; frozen victims convert 15% slower', () => {
    const sim = world();
    const exposed = sim.addBoid(500, 300, 'salamander');
    const attackers = Array.from({ length: 3 }, (_, i) => sim.addBoid(496 + i * 4, 300, 'dragon'));
    const defenders = Array.from({ length: 6 }, (_, i) => sim.addBoid(496 + i * 2, 304, 'salamander'));
    defenders.forEach(d => d.stun(10));
    const neighbors = [exposed, ...attackers, ...defenders];
    const ticks = frozen => {
        Object.assign(exposed, { conversionPressure: 0, conversionCooldown: 0, frozen });
        for (let n = 1; n < 200; n++) if (sim.recruitmentStep(exposed, neighbors)) return n;
        return Infinity;
    };
    const expected = increment => { let total = 0, n = 0; while (total < sim.rules.conversionTicks) { total += increment; n++; } return n; };
    assert.equal(ticks(false), expected(1));
    assert.equal(ticks(true), expected(1 / sim.rules.frozenConversionSlowdown));
    attackers.forEach(a => a.stun(10));
    assert.equal(ticks(false), Infinity, 'frozen attackers exert no pressure');
});

test('a rallying team cannot recruit, gray ships never recruit, and tied fleets cancel over gray ships', () => {
    const sim = world();
    const gray = sim.addBoid(300, 300, 'neutral');
    const red = Array.from({ length: 4 }, () => sim.addBoid(300, 300, 'salamander'));
    const blue = Array.from({ length: 4 }, () => sim.addBoid(300, 300, 'dragon'));
    const run = neighbors => { gray.conversionPressure = 0; for (let i = 0; i < 100; i++) { const t = sim.recruitmentStep(gray, neighbors); if (t) return t; } return null; };
    assert.equal(run([gray, ...red, ...blue]), null, 'tie');
    assert.equal(run([gray, ...red]), 'salamander');
    sim.commander('salamander').rally(0, 0);
    assert.equal(run([gray, ...red]), null, 'disarmed while rallying');
    const ally = sim.addBoid(300, 300, 'dragon');
    const grays = Array.from({ length: 8 }, () => sim.addBoid(300, 300, 'neutral'));
    for (let i = 0; i < 100; i++) assert.equal(sim.recruitmentStep(ally, [ally, ...grays]), null);
    assert.equal(ally.conversionPressure, 0);
});

test('team modifiers change recruiting speed (faction perks are real)', () => {
    const sim = world();
    sim.setModifiers('dragon', { pressure: 2 });
    const exposed = sim.addBoid(500, 300, 'salamander');
    const attackers = Array.from({ length: 3 }, () => sim.addBoid(500, 300, 'dragon'));
    let n = 0;
    while (!sim.recruitmentStep(exposed, [exposed, ...attackers])) n++;
    assert.equal(n + 1, sim.rules.conversionTicks / 2);
});

test('rally holds expire, then a cool-off blocks recruiting briefly', () => {
    const sim = world(), me = sim.commander('dragon');
    me.rally(10, 10, 1);
    for (let i = 0; i < 61; i++) sim.step();
    assert.equal(me.rallying, false);
    assert.ok(me.coolOff > 0 && me.disarmed);
    for (let i = 0; i < 30; i++) sim.step();
    assert.equal(me.disarmed, false);
});

test('serialized simulations continue identically', () => {
    const arena = createDuelArena({ seed: 12 });
    for (let i = 0; i < 300; i++) stepDuelArena(arena);
    arena.sim.commander('dragon').rally(400, 300, 1.5);
    const a = Simulation.fromJSON(arena.sim.toJSON(), randomFrom(9));
    const b = Simulation.fromJSON(JSON.parse(JSON.stringify(arena.sim.toJSON())), randomFrom(9));
    for (let i = 0; i < 120; i++) { a.step(); b.step(); }
    assert.deepEqual(a.boids.map(x => [x.team, x.pos.x, x.pos.y]), b.boids.map(x => [x.team, x.pos.x, x.pos.y]));
    assert.equal(a.commander('dragon').rallying, false, 'the hold expired in both copies');
});

test('duel arenas are deterministic, bounded and spawn gray ships clear of terrain', () => {
    const one = createDuelArena({ seed: 44 }), two = createDuelArena({ seed: 44 });
    assert.deepEqual(one.sim.toJSON(), two.sim.toJSON());
    assert.equal(one.sim.boids.filter(b => b.team === 'neutral').length, 24);
    for (let i = 0; i < 40; i++) one.sim.spawnNeutrals(12);
    assert.ok(one.sim.boids.filter(b => b.team === 'neutral').length <= one.sim.rules.duelNeutralCap);
    assert.ok(one.sim.boids.length <= one.sim.rules.duelShipCap);
    const result = playDuel({ seed: 3, seconds: 5, controllers: { dragon: () => ({ type: 'wait' }), salamander: () => ({ type: 'wait' }) } });
    assert.equal(result.seconds, 5);
});

test('terrain: black-hole cores destroy, nebulae slow, asteroids scatter, and resizing scales the map', () => {
    const sim = world();
    const hole = new TerrainField({ type: 'blackHole', x: 300, y: 300, radius: 100 });
    const doomed = sim.addBoid(300, 300, 'dragon');
    assert.equal(hole.affect(doomed), true);
    const pulled = sim.addBoid(300 + hole.core + 20, 300, 'dragon');
    hole.affect(pulled);
    assert.ok(pulled.acc.x < 0 && Number.isFinite(pulled.acc.x));
    const slow = sim.addBoid(310, 300, 'dragon');
    new TerrainField({ type: 'slowZone', x: 300, y: 300 }).affect(slow);
    assert.equal(slow.slowMultiplier, 0.4);
    new TerrainField({ type: 'asteroid', x: 300, y: 300 }).affect(slow);
    assert.ok(Math.hypot(slow.acc.x, slow.acc.y) > 0);
    assert.equal(new TerrainField({ type: 'asteroid', x: 0, y: 0, radius: 40 }).reach, 40, 'only black holes reach beyond their radius');
    sim.setTerrain([{ type: 'slowZone', x: 640, y: 360, radius: 72 }]);
    sim.resize(320, 720);
    assert.deepEqual([sim.terrain[0].x, sim.terrain[0].y, sim.terrain[0].radius], [160, 360, 32]);
});
