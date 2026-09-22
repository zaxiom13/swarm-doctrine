// Scripted rival. Every distance scales with the current rules and ability
// sizes from the snapshot, and Rally routes around black holes, so balance and
// terrain changes do not break it.
import { centroid, densestPoint } from './actions.js';

export const HARD_BOT_STYLES = ['assault', 'recruiter', 'patient'];

/** Moves a point out of any black hole's pull and detours a path around one. */
export function safeRallyPoint(from, to, terrain = [], margin = 30) {
    const holes = terrain.filter(field => field.type === 'blackHole');
    let target = { ...to };
    for (const hole of holes) {
        const reach = (hole.reach ?? hole.radius * 2.8) + margin;
        const dx = target.x - hole.x, dy = target.y - hole.y, d = Math.hypot(dx, dy);
        if (d < reach) {
            const ux = d > 0 ? dx / d : 1, uy = d > 0 ? dy / d : 0;
            target = { x: hole.x + ux * reach, y: hole.y + uy * reach };
        }
    }
    for (const hole of holes) {
        const reach = (hole.reach ?? hole.radius * 2.8) + margin;
        const sx = target.x - from.x, sy = target.y - from.y, lengthSq = sx * sx + sy * sy;
        if (!lengthSq) continue;
        const t = Math.max(0, Math.min(1, ((hole.x - from.x) * sx + (hole.y - from.y) * sy) / lengthSq));
        const px = from.x + sx * t - hole.x, py = from.y + sy * t - hole.y, d = Math.hypot(px, py);
        if (d >= reach) continue;
        // Aim for the tangent side of the hole that the path already leans toward.
        const length = Math.sqrt(lengthSq);
        let nx = -sy / length, ny = sx / length;
        if (px * nx + py * ny < 0) { nx = -nx; ny = -ny; }
        return { x: hole.x + nx * (reach + margin), y: hole.y + ny * (reach + margin) };
    }
    return target;
}

export function chooseHardBotAction(snapshot, second, style = 0) {
    const { allies, rivals, neutrals = [], terrain = [], abilities = {} } = snapshot;
    if (!rivals.length || !allies.length) return { type: 'wait' };
    const freezeRadius = abilities.freezeRadius ?? 270;
    const conversionRadius = abilities.conversionRadius ?? 65;
    const own = centroid(allies);

    if (!(snapshot.freeze?.cooldown > 0)) {
        const focus = densestPoint(rivals, freezeRadius, centroid(rivals));
        const covered = rivals.filter(u => !u.frozen && (u.x - focus.x) ** 2 + (u.y - focus.y) ** 2 <= freezeRadius ** 2).length;
        if (covered >= 3) return { type: 'freeze', x: focus.x, y: focus.y };
    }

    const recruiter = style === 1 && neutrals.length >= 8 && allies.length < rivals.length;
    const goal = recruiter ? densestPoint(neutrals, freezeRadius * 0.4, centroid(neutrals)) : densestPoint(rivals, freezeRadius * 0.6, centroid(rivals));
    const patient = style === 2;
    const engage = conversionRadius * (patient ? 3.2 : 2.3);
    const period = patient ? 4 : 3;
    if (Math.hypot(goal.x - own.x, goal.y - own.y) > engage && second % period === 0) {
        return { type: 'rally', ...safeRallyPoint(own, goal, terrain), holdSeconds: 1 };
    }
    return { type: snapshot.rally?.active ? 'release' : 'wait' };
}

/** The easy training bot: a two-second Rally at the rivals every eight seconds, never Freeze. */
export function chooseEasyBotAction(snapshot, second) {
    if (!snapshot.rivals.length || second % 8 !== 0) return { type: 'wait' };
    return { type: 'rally', ...centroid(snapshot.rivals), holdSeconds: 2 };
}
