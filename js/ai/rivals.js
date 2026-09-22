// Duel opponents behind one interface: start(), stop(), and tick(sim, team, second)
// once per simulated second. Synchronous rivals act at once; asynchronous ones
// (Tactician worker, Jev) act when their answer arrives, unless stopped first.
import { chooseHardBotAction } from './hard-bot.js';
import { chooseSearchAction } from './search-bot.js';
import { chooseAction, validateModel } from './local-policy.js';
import { JevController } from './jev.js';
import { rulesHash } from '../rules.js';

export const RIVAL_NAMES = { 'duel-hard': 'Hard bot', 'duel-tactician': 'Tactician', 'duel-local': 'Local rival', 'duel-jev': 'Jev' };

let modelPromise = null;
export function loadLocalModel(url = '/models/offline-policy.json') {
    modelPromise ||= fetch(url, { cache: 'no-cache' })
        .then(response => { if (!response.ok) throw new Error(`Local rival model unavailable (${response.status})`); return response.json(); })
        .then(validateModel)
        .catch(error => { modelPromise = null; throw error; });
    return modelPromise;
}

class ScriptedRival {
    constructor(style) { this.style = style; this.name = RIVAL_NAMES['duel-hard']; }
    start(report) { report({ state: 'online', label: 'Hard bot ready' }); }
    stop() {}
    tick(sim, team, second) { sim.commander(team).apply(chooseHardBotAction(sim.snapshotFor(team), second, this.style)); }
}

class LocalRival {
    constructor(model) { this.model = model; this.name = RIVAL_NAMES['duel-local']; }
    start(report, sim) {
        const stale = this.model.rulesHash && this.model.rulesHash !== rulesHash(sim.rules);
        report({ state: 'online', label: stale ? 'Local rival · trained on different rules' : 'Local rival ready' });
    }
    stop() {}
    tick(sim, team) { sim.commander(team).apply(chooseAction(sim.snapshotFor(team), this.model)); }
}

/** Lookahead search in a Web Worker when available, otherwise on this thread. */
class TacticianRival {
    constructor() { this.name = RIVAL_NAMES['duel-tactician']; this.worker = null; this.pending = null; this.sequence = 0; this.horizon = 2; }
    start(report) {
        this.running = true;
        if (typeof Worker !== 'undefined' && !this.worker) {
            try { this.worker = new Worker(new URL('./search-worker.js', import.meta.url), { type: 'module' }); } catch { this.worker = null; }
        }
        report({ state: 'online', label: 'Tactician ready' });
    }
    stop() { this.running = false; this.sequence++; this.pending = null; }
    tick(sim, team) {
        if (!this.worker) { sim.commander(team).apply(chooseSearchAction(sim, team, { horizon: 2 }).action); return; }
        if (this.pending) return;
        const id = ++this.sequence;
        this.pending = id;
        this.worker.onmessage = ({ data }) => {
            if (data.id !== this.sequence || !this.running) return;
            this.pending = null;
            // Keep answers inside the one-second decision rhythm on slower devices.
            if (data.ms > 800 && this.horizon > 1) this.horizon--;
            else if (data.ms < 300 && this.horizon < 3) this.horizon++;
            if (data.action) sim.commander(team).apply(data.action);
        };
        this.worker.postMessage({ id, state: sim.toJSON(), team, options: { horizon: this.horizon } });
    }
    dispose() { this.worker?.terminate(); this.worker = null; }
}

class JevRival {
    constructor() { this.name = RIVAL_NAMES['duel-jev']; this.controller = null; }
    start(report, sim, team) {
        this.controller ||= new JevController();
        this.controller.onAction = action => sim.commander(team).apply(action);
        this.controller.onStatus = status => report({ ...status, label: jevLabel(status) });
        this.controller.start();
    }
    stop() { this.controller?.stop(); }
    tick(sim, team, second) { this.controller.tick(sim.snapshotFor(team), second); }
}

function jevLabel(status) {
    if (status.state === 'online') return status.spentUsd ? `Jev connected · $${status.spentUsd.toFixed(4)}` : 'Jev connected';
    if (status.state === 'thinking') return 'Jev thinking…';
    if (status.state === 'connecting') return 'Connecting Jev…';
    return 'Jev disconnected';
}

export function createRival(kind, { model, style = 0 } = {}) {
    if (kind === 'duel-hard') return new ScriptedRival(style);
    if (kind === 'duel-local') return new LocalRival(model);
    if (kind === 'duel-tactician') return new TacticianRival();
    if (kind === 'duel-jev') return new JevRival();
    throw new Error(`Unknown rival: ${kind}`);
}
