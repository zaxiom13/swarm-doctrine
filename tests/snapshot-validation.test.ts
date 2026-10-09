import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createDuelArena } from '../src/lib/arena.ts';
import { encodeSnapshot, applySnapshot } from '../src/lib/net/sync.ts';

const corruptions = {
    'NaN time': (v: DataView) => v.setFloat32(2, NaN, true),
    'infinite time': (v: DataView) => v.setFloat32(2, Infinity, true),
    'negative time': (v: DataView) => v.setFloat32(2, -1, true),
    'invalid last team': (v: DataView) => v.setUint8(v.byteLength - 5, 3),
    'duplicate last id': (v: DataView) => v.setUint16(v.byteLength - 13, v.getUint16(24, true), true),
    'negative last position': (v: DataView) => v.setInt16(v.byteLength - 11, -1, true),
};
for (const [name, corrupt] of Object.entries(corruptions)) {
    test(`rejects ${name} without changing the previous world`, () => {
        const host = createDuelArena({ seed: 9 }).sim;
        const guest = createDuelArena({ seed: 2 }).sim;
        host.time = 3;
        host.commander('dragon').rally(250, 100);
        const before = encodeSnapshot(guest);
        const ships = [...guest.boids];
        const buffer = encodeSnapshot(host);
        corrupt(new DataView(buffer));
        assert.equal(applySnapshot(guest, buffer), false);
        assert.deepEqual(new Uint8Array(encodeSnapshot(guest)), new Uint8Array(before));
        assert.deepEqual(guest.boids, ships);
        assert.ok(guest.boids.every((ship, i) => ship === ships[i]));
    });
}
test('rejects truncated and trailing data without mutation', () => {
    const sim = createDuelArena().sim, bytes = new Uint8Array(encodeSnapshot(sim));
    assert.equal(applySnapshot(sim, bytes.subarray(0, bytes.length - 1)), false);
    const oversized = new Uint8Array(bytes.length + 1); oversized.set(bytes);
    assert.equal(applySnapshot(sim, oversized), false);
});

test('rejects a frame over the configured duel ship cap', () => {
    const sim = createDuelArena().sim;
    const count = sim.rules.duelShipCap + 1;
    const buffer = new ArrayBuffer(24 + count * 13), view = new DataView(buffer);
    view.setUint8(0, 1); view.setUint16(6, count, true);
    assert.equal(applySnapshot(sim, buffer), false);
});
