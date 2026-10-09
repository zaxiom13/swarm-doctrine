import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createDuelArena, stepDuelArena } from '../src/lib/arena.ts';
import { Simulation } from '../src/lib/simulation.ts';
import { encodeSnapshot, applySnapshot, drift, validInput, packEvent } from '../src/lib/net/sync.ts';

function playedArena() {
    const arena = createDuelArena({ seed: 7 });
    const { sim } = arena;
    sim.commander('dragon').rally(500, 300);
    for (let i = 0; i < 240; i++) stepDuelArena(arena);
    sim.commander('salamander').freeze(sim.width * 0.5, sim.height * 0.5);
    for (let i = 0; i < 30; i++) stepDuelArena(arena);
    return sim;
}

test('a snapshot rebuilds the same ships, teams and commanders on the guest', () => {
    const host = playedArena();
    const guest = new Simulation({ width: host.width, height: host.height });
    guest.setTeams(['dragon', 'salamander']);
    assert.ok(applySnapshot(guest, encodeSnapshot(host)));
    assert.equal(guest.boids.length, host.boids.length);
    host.boids.forEach((b, i) => {
        const g = guest.boids[i];
        assert.equal(g.id, b.id);
        assert.equal(g.team, b.team);
        assert.equal(g.frozen, b.frozen);
        assert.ok(Math.abs(g.pos.x - b.pos.x) <= 0.05 && Math.abs(g.pos.y - b.pos.y) <= 0.05);
        assert.equal(g.conversionSource?.id ?? null, b.conversionSource?.id ?? null);
    });
    for (const team of ['dragon', 'salamander', 'neutral']) assert.equal(guest.counts[team], host.count(team));
    assert.equal(guest.commander('dragon').rallying, host.commander('dragon').rallying);
    assert.ok(Math.abs(guest.commander('salamander').freezeCooldown - host.commander('salamander').freezeCooldown) < 0.01);
    assert.ok(Math.abs(guest.time - host.time) < 0.001);
});

test('ships keep their identity across snapshots and vanished ships are removed', () => {
    const host = playedArena();
    const guest = new Simulation({ width: host.width, height: host.height });
    guest.setTeams(['dragon', 'salamander']);
    applySnapshot(guest, encodeSnapshot(host));
    const kept = guest.boids[5];
    host.boids.splice(0, 3);
    applySnapshot(guest, encodeSnapshot(host));
    assert.equal(guest.boids.length, host.boids.length);
    assert.equal(guest.boids[2], kept);
    drift(guest, 1 / 60);
    assert.ok(guest.boids.every(b => Number.isFinite(b.pos.x) && Number.isFinite(b.pos.y)));
});

test('a reused guest ship clears a conversion flash when the host clears it', () => {
    const host = new Simulation();
    const guest = new Simulation();
    host.setTeams(['dragon', 'salamander']);
    guest.setTeams(['dragon', 'salamander']);
    const ship = host.addBoid(120, 80, 'dragon');
    ship.justConverted = true;
    applySnapshot(guest, encodeSnapshot(host));
    const reused = guest.boids[0];
    assert.equal(reused.justConverted, true);

    ship.justConverted = false;
    applySnapshot(guest, encodeSnapshot(host));
    assert.equal(guest.boids[0], reused);
    assert.equal(reused.justConverted, false);
});

test('malformed snapshots and guest input are rejected', () => {
    const sim = new Simulation();
    assert.equal(applySnapshot(sim, new ArrayBuffer(4)), false);
    assert.equal(validInput({ type: 'teleport', x: 1, y: 1 }, sim), null);
    assert.equal(validInput({ type: 'rally', x: 'a', y: 1 }, sim), null);
    assert.deepEqual(validInput({ type: 'freeze', x: -50, y: 99999 }, sim), { type: 'freeze', x: 0, y: sim.height });
    assert.deepEqual(validInput({ type: 'release', x: 1 }, sim), { type: 'release' });
    assert.equal(packEvent({ type: 'secret' }), null);
});

test('a snapshot delivered as a Uint8Array view (as Trystero does) still applies', () => {
    const host = playedArena();
    const bytes = new Uint8Array(encodeSnapshot(host));
    // Put the bytes at an offset inside a bigger buffer, like a received network frame.
    const frame = new Uint8Array(bytes.length + 16);
    frame.set(bytes, 16);
    const guest = new Simulation({ width: host.width, height: host.height });
    guest.setTeams(['dragon', 'salamander']);
    assert.ok(applySnapshot(guest, frame.subarray(16)));
    assert.equal(guest.boids.length, host.boids.length);
    assert.equal(applySnapshot(guest, 'not binary'), false);
});
