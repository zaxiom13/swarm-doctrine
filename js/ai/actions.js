// The shared action vocabulary for every non-human controller: eight named
// target points, Rally for 1/3/5 seconds or Freeze at each, Release, or Wait.
const TARGET_NAMES = ['rival focus', 'gray focus', 'flank', 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
const HOLD_SECONDS = [1, 3, 5];
export const ACTION_IDS = ['wait', 'release',
    ...TARGET_NAMES.flatMap((_, i) => HOLD_SECONDS.map(s => `rally_${i}_${s}`)),
    ...TARGET_NAMES.map((_, i) => `freeze_${i}`)];

const MIN_HOLD = 0.25, MAX_HOLD = 10;

export class ActionError extends Error {
    constructor(message, code = 'invalid_input') {
        super(message);
        this.name = 'ActionError';
        this.code = code;
    }
}

const round = v => Math.round(v * 10) / 10;
const clampTo = (v, max) => Math.min(max, Math.max(0, v));

export function centroid(units, fallback) {
    if (!units.length) return fallback;
    let x = 0, y = 0;
    for (const u of units) { x += u.x; y += u.y; }
    return { x: x / units.length, y: y / units.length };
}

/**
 * The point that covers the most ships within `radius`, refined to the centroid
 * of the ships it covers. Unlike a plain centroid it never lands in the empty
 * gap between two split groups. Frozen ships are skipped because they cannot
 * be frozen again or defend.
 */
export function densestPoint(units, radius, fallback) {
    const active = units.filter(u => !u.frozen);
    const pool = active.length ? active : units;
    if (!pool.length) return fallback;
    const radiusSq = radius * radius;
    let best = pool[0], bestCount = -1;
    const stride = Math.max(1, Math.floor(pool.length / 60));
    for (let i = 0; i < pool.length; i += stride) {
        const c = pool[i];
        let count = 0;
        for (const u of pool) if ((u.x - c.x) ** 2 + (u.y - c.y) ** 2 <= radiusSq) count++;
        if (count > bestCount) { bestCount = count; best = c; }
    }
    return centroid(pool.filter(u => (u.x - best.x) ** 2 + (u.y - best.y) ** 2 <= radiusSq), best);
}

/** Eight target points derived from the snapshot and the controller's own ability sizes. */
export function candidateTargets(snapshot) {
    const { width, height } = snapshot.arena;
    const center = { x: width / 2, y: height / 2 };
    const freezeRadius = snapshot.abilities?.freezeRadius ?? 270;
    const rival = densestPoint(snapshot.rivals, freezeRadius * 0.6, center);
    const gray = densestPoint(snapshot.neutrals || [], freezeRadius * 0.4, center);
    const raw = [rival, gray, { x: width - rival.x, y: height - rival.y }, center,
        { x: width * 0.15, y: height * 0.15 }, { x: width * 0.85, y: height * 0.15 },
        { x: width * 0.15, y: height * 0.85 }, { x: width * 0.85, y: height * 0.85 }];
    return raw.map(p => ({ x: round(clampTo(p.x, width)), y: round(clampTo(p.y, height)) }));
}

function actionKey(action) {
    if (action.type === 'wait' || action.type === 'release') return action.type;
    if (action.type === 'freeze') return `freeze_${action.targetIndex}`;
    return `rally_${action.targetIndex}_${action.holdSeconds}`;
}

/** Legal actions for this snapshot, keyed by action id. Freeze appears only when ready. */
export function decisionCandidates(snapshot) {
    const targets = candidateTargets(snapshot);
    const candidates = new Map();
    const add = action => candidates.set(actionKey(action), { action });
    add({ type: 'wait' });
    add({ type: 'release' });
    targets.forEach((t, targetIndex) => HOLD_SECONDS.forEach(holdSeconds => add({ type: 'rally', x: t.x, y: t.y, holdSeconds, targetIndex })));
    if (!(snapshot.freeze?.cooldown > 0)) targets.forEach((t, targetIndex) => add({ type: 'freeze', x: t.x, y: t.y, targetIndex }));
    return { candidates, targets };
}

function coordinate(point, name, width, height) {
    const x = Number(point?.x), y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new ActionError(`${name} must have finite coordinates`, 'invalid_action');
    if (x < 0 || x > width || y < 0 || y > height) throw new ActionError(`${name} is outside the arena`, 'invalid_action');
    return { x: round(x), y: round(y) };
}

/** Normalises an untrusted action to the four shapes the game accepts. */
export function validateAction(action, arena) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) throw new ActionError('action must be an object', 'invalid_action');
    const { width, height } = arena;
    if (action.type === 'wait' || action.type === 'release') return { type: action.type };
    if (action.type === 'freeze') return { type: 'freeze', ...coordinate(action, 'freeze', width, height) };
    if (action.type === 'rally') {
        const hold = Number(action.holdSeconds);
        if (!Number.isFinite(hold) || hold < MIN_HOLD || hold > MAX_HOLD) throw new ActionError('rally holdSeconds is outside the allowed range', 'invalid_action');
        return { type: 'rally', ...coordinate(action, 'rally', width, height), holdSeconds: round(hold) };
    }
    throw new ActionError('unknown action', 'invalid_action');
}
