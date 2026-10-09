// Compact binary snapshots of a duel: the host sends one about 20 times a
// second; the guest rebuilds its world from them and glides ships forward in
// between. 24 header bytes plus 13 bytes a ship (about 2.5 KB for 200 ships).
const TEAM_CODE = { neutral: 0, dragon: 1, salamander: 2 };
const TEAM_NAME = ['neutral', 'dragon', 'salamander'];
const COMMANDERS = ['dragon', 'salamander'];
const HEADER = 24, SHIP = 13, NONE = 0xffff;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function encodeSnapshot(sim) {
    const boids = sim.boids;
    const view = new DataView(new ArrayBuffer(HEADER + boids.length * SHIP));
    view.setUint8(0, 1);
    view.setFloat32(2, sim.time, true);
    view.setUint16(6, boids.length, true);
    COMMANDERS.forEach((team, i) => {
        const c = sim.commanders[team], at = 8 + i * 8;
        if (!c) return;
        view.setUint8(at, c.rallying ? 1 : 0);
        view.setInt16(at + 1, Math.round(clamp(c.target.x, -3000, 3000) * 10), true);
        view.setInt16(at + 3, Math.round(clamp(c.target.y, -3000, 3000) * 10), true);
        view.setUint8(at + 5, Math.round(clamp(c.coolOff, 0, 2.5) * 100));
        view.setUint16(at + 6, Math.round(clamp(c.freezeCooldown, 0, 600) * 100), true);
    });
    boids.forEach((b, i) => {
        const at = HEADER + i * SHIP;
        view.setUint16(at, b.id, true);
        view.setInt16(at + 2, Math.round(clamp(b.pos.x, 0, 3000) * 10), true);
        view.setInt16(at + 4, Math.round(clamp(b.pos.y, 0, 3000) * 10), true);
        view.setInt8(at + 6, Math.round(clamp(b.vel.x * 20, -127, 127)));
        view.setInt8(at + 7, Math.round(clamp(b.vel.y * 20, -127, 127)));
        view.setUint8(at + 8, (TEAM_CODE[b.team] ?? 0) | (b.frozen ? 4 : 0) | (b.justConverted ? 8 : 0));
        view.setUint8(at + 9, Math.round(clamp(b.conversionPressure * 4, 0, 255)));
        view.setUint16(at + 10, b.conversionSource ? b.conversionSource.id : NONE, true);
        view.setUint8(at + 12, Math.round(clamp(b.freezeRemaining * 10, 0, 255)));
    });
    return view.buffer;
}

/** Rebuilds the guest's world from a snapshot, reusing ships by id so trails stay smooth. */
export function applySnapshot(sim, buffer) {
    // Trystero can deliver binary as a Uint8Array view rather than the ArrayBuffer that was sent.
    const view = ArrayBuffer.isView(buffer) ? new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
        : buffer instanceof ArrayBuffer ? new DataView(buffer) : null;
    if (!view) return false;
    if (view.byteLength < HEADER || view.getUint8(0) !== 1) return false;
    const count = view.getUint16(6, true);
    if (count > sim.rules.duelShipCap || view.byteLength !== HEADER + count * SHIP) return false;
    const time = view.getFloat32(2, true);
    if (!Number.isFinite(time) || time < 0) return false;
    // Validate the whole frame before touching commanders or existing ship objects.
    const seen = new Set<number>();
    for (let i = 0; i < count; i++) {
        const at = HEADER + i * SHIP, id = view.getUint16(at, true);
        const flags = view.getUint8(at + 8);
        const x = view.getInt16(at + 2, true), y = view.getInt16(at + 4, true);
        if (seen.has(id) || (flags & 3) >= TEAM_NAME.length || (flags & ~15) ||
            x < 0 || y < 0 || x > 30000 || y > 30000) return false;
        seen.add(id);
    }
    sim.time = time;
    COMMANDERS.forEach((team, i) => {
        const c = sim.commander(team), at = 8 + i * 8;
        c.rallying = Boolean(view.getUint8(at) & 1);
        c.target.set(view.getInt16(at + 1, true) / 10, view.getInt16(at + 3, true) / 10);
        c.coolOff = view.getUint8(at + 5) / 100;
        c.freezeCooldown = view.getUint16(at + 6, true) / 100;
    });
    const byId = new Map<number, any>(sim.boids.map((b): [number, any] => [b.id, b]));
    const next = [], sources = [];
    for (let i = 0; i < count; i++) {
        const at = HEADER + i * SHIP, id = view.getUint16(at, true), flags = view.getUint8(at + 8);
        const x = view.getInt16(at + 2, true) / 10, y = view.getInt16(at + 4, true) / 10, team = TEAM_NAME[flags & 3];
        let b = byId.get(id);
        if (!b) { b = sim.addBoid(x, y, team); sim.boids.pop(); b.id = id; }
        // Big jumps (wrapping, respawns) drop the trail instead of drawing a streak.
        if ((b.pos.x - x) ** 2 + (b.pos.y - y) ** 2 > 900) b.clearTrail();
        b.pos.set(x, y);
        b.vel.set(view.getInt8(at + 6) / 20, view.getInt8(at + 7) / 20);
        b.team = team;
        b.frozen = Boolean(flags & 4);
        if (flags & 8) b.justConverted = true;
        b.conversionPressure = view.getUint8(at + 9) / 4;
        b.freezeRemaining = view.getUint8(at + 12) / 10;
        sources.push(view.getUint16(at + 10, true));
        next.push(b);
    }
    const ids = new Map(next.map(b => [b.id, b]));
    next.forEach((b, i) => { b.conversionSource = sources[i] === NONE ? null : ids.get(sources[i]) ?? null; });
    sim.boids = next;
    for (const team in sim.counts) sim.counts[team] = 0;
    for (const b of next) sim.counts[b.team] = (sim.counts[b.team] || 0) + 1;
    return true;
}

/** Glides ships along their last known velocity between snapshots. */
export function drift(sim, dt) {
    for (const b of sim.boids) {
        b.freezeRemaining = Math.max(0, b.freezeRemaining - dt);
        if (b.frozen) { b.pulsePhase += 0.05; continue; }
        b.acc.set(0, 0);
        b.update(sim.width, sim.height, sim.rules, sim.modifiers(b.team).speed, sim.random);
    }
    for (const c of Object.values(sim.commanders) as any[]) {
        c.freezeCooldown = Math.max(0, c.freezeCooldown - dt);
        if (!c.rallying) c.coolOff = Math.max(0, c.coolOff - dt);
    }
    sim.time += dt;
}

/** Events worth showing on the other screen, trimmed to what the effects need. */
export function packEvent(event) {
    const { type, team, from, to, x, y, radius, duration, victims, eligible, wasFrozen } = event;
    if (!['convert', 'destroyed', 'freeze', 'freeze-miss', 'rally'].includes(type)) return null;
    const round = v => (Number.isFinite(v) ? Math.round(v) : undefined);
    return { type, team, from, to, x: round(x), y: round(y), radius: round(radius), duration, victims, eligible, wasFrozen };
}

/** Accepts a guest's control message only if it is a well-formed Rally, release or Freeze. */
export function validInput(data, sim) {
    if (!data || !['rally', 'release', 'freeze'].includes(data.type)) return null;
    if (data.type === 'release') return { type: 'release' };
    const x = Number(data.x), y = Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { type: data.type, x: clamp(x, 0, sim.width), y: clamp(y, 0, sim.height) };
}
