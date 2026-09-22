// Lookahead rival ("Tactician"). For each shortlisted move it copies the real
// simulation, plays a few seconds forward against a scripted reply, and keeps
// the move with the best outcome. Because it uses the actual rules engine it
// adapts to any balance or terrain change without retuning.
import { Simulation } from '../simulation.js';
import { randomFrom } from '../worlds.js';
import { decisionCandidates } from './actions.js';
import { chooseHardBotAction, safeRallyPoint } from './hard-bot.js';

const SHORTLIST = ['wait', 'release', 'rally_0_3', 'rally_1_3', 'rally_2_3', 'rally_3_3', 'freeze_0', 'freeze_1'];

export function shortlist(snapshot) {
    const { candidates } = decisionCandidates(snapshot);
    const own = snapshot.allies.length ? snapshot.allies.reduce((p, u) => ({ x: p.x + u.x / snapshot.allies.length, y: p.y + u.y / snapshot.allies.length }), { x: 0, y: 0 }) : null;
    const moves = [];
    for (const id of SHORTLIST) {
        const entry = candidates.get(id);
        if (!entry) continue;
        const action = { ...entry.action };
        if (action.type === 'rally' && own) Object.assign(action, safeRallyPoint(own, action, snapshot.terrain));
        moves.push({ id, action });
    }
    const scripted = chooseHardBotAction(snapshot, 0, 0);
    moves.push({ id: 'scripted', action: scripted });
    return moves;
}

/** Fleet margin plus a smaller credit for rival ships left frozen. */
function score(sim, team) {
    let own = 0, rivals = 0, frozen = 0;
    for (const boid of sim.boids) {
        if (boid.team === team) own++;
        else if (boid.team !== 'neutral') { rivals++; if (boid.frozen) frozen++; }
    }
    return own - rivals + frozen * 0.25;
}

/** Two replies the rival might make: hold its current orders, or attack like the hard bot. */
const REPLIES = [() => ({ type: 'wait' }), (snapshot, second) => chooseHardBotAction(snapshot, second, 0)];

/**
 * Picks an action for `team` from a serialized simulation. `horizon` is in
 * simulated seconds. Each move is scored against every reply and keeps its
 * worst case, so the bot does not bet on the rival making a particular move.
 * The same random stream is reused everywhere so differences come from the
 * moves, not from luck.
 */
export function chooseSearchAction(state, team, { horizon = 3, seed = 7 } = {}) {
    const data = state instanceof Simulation ? state.toJSON() : state;
    const root = Simulation.fromJSON(data, randomFrom(seed));
    const snapshot = root.snapshotFor(team);
    if (!snapshot.allies.length || !snapshot.rivals.length) return { action: { type: 'wait' }, evaluated: 0 };
    const rivalTeams = [...new Set(root.boids.map(b => b.team))].filter(t => t !== team && t !== 'neutral');
    const moves = shortlist(snapshot);
    let best = null;
    for (const move of moves) {
        let worst = Infinity;
        for (const reply of REPLIES) {
            const sim = Simulation.fromJSON(data, randomFrom(seed));
            sim.commander(team).apply(move.action);
            for (let second = 0; second < horizon; second++) {
                for (const rival of rivalTeams) sim.commander(rival).apply(reply(sim.snapshotFor(rival), second));
                for (let tick = 0; tick < 60; tick++) sim.step();
            }
            worst = Math.min(worst, score(sim, team));
            if (best && worst <= best.value) break;
        }
        if (!best || worst > best.value) best = { ...move, value: worst };
    }
    return { action: best.action, id: best.id, value: best.value, evaluated: moves.length };
}
