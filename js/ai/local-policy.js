// Small linear policy that runs offline in the browser. Version 2 sees terrain
// and the current rule values, so it can be trained across many rule sets.
// Version 1 models load unchanged: their weights are copied and every new
// input starts at zero, which reproduces the old decisions exactly.
import { ACTION_IDS, decisionCandidates } from './actions.js';

export const POLICY_VERSION = 'swarm-linear-v2';
const LEGACY_VERSION = 'swarm-linear-v1';
const COLS = 6, ROWS = 4, CELLS = COLS * ROWS;
const LEGACY_INPUTS = 5 * CELLS + 8;
const TERRAIN_OFFSET = LEGACY_INPUTS;
const RULE_OFFSET = TERRAIN_OFFSET + 2 * CELLS;
export const RULE_INPUTS = ['freezeRadius', 'freezeDuration', 'freezeCooldown', 'conversionRadius', 'maxSpeed', 'rallyRadius', 'neutrals'];
export const INPUTS = RULE_OFFSET + RULE_INPUTS.length;
export const PARAMETERS = INPUTS * ACTION_IDS.length;
export { ACTION_IDS };

const cellOf = (x, y, width, height) => Math.min(COLS - 1, Math.max(0, Math.floor(x / width * COLS))) + COLS * Math.min(ROWS - 1, Math.max(0, Math.floor(y / height * ROWS)));

export function features(snapshot) {
    const f = new Float64Array(INPUTS);
    const { width, height } = snapshot.arena;
    const channels = [[0, snapshot.allies], [1, snapshot.rivals], [2, snapshot.neutrals || []]];
    for (const [channel, units] of channels) {
        for (const unit of units) {
            const cell = cellOf(unit.x, unit.y, width, height);
            f[channel * CELLS + cell] += 1 / 40;
            if (unit.frozen && channel < 2) f[(3 + channel) * CELLS + cell] += 1 / 40;
        }
    }
    const base = 5 * CELLS;
    f[base] = 1;
    f[base + 1] = snapshot.allies.length / 80;
    f[base + 2] = snapshot.rivals.length / 80;
    f[base + 3] = (snapshot.freeze?.cooldown || 0) / 10;
    f[base + 4] = snapshot.rally?.active ? 1 : 0;
    f[base + 5] = (snapshot.rally?.remaining || 0) / 10;
    f[base + 6] = (snapshot.rally?.target?.x || 0) / width;
    f[base + 7] = (snapshot.rally?.target?.y || 0) / height;

    // Terrain coverage per cell from a 3×3 sample grid: lethal pull, then slowing/scattering.
    for (const field of snapshot.terrain || []) {
        const channel = field.type === 'blackHole' ? 0 : 1;
        const reach = field.reach ?? field.radius;
        for (let cell = 0; cell < CELLS; cell++) {
            const cx = cell % COLS, cy = Math.floor(cell / COLS);
            let hits = 0;
            for (let sx = 0; sx < 3; sx++) for (let sy = 0; sy < 3; sy++) {
                const px = (cx + (sx + 0.5) / 3) * width / COLS, py = (cy + (sy + 0.5) / 3) * height / ROWS;
                if ((px - field.x) ** 2 + (py - field.y) ** 2 <= reach * reach) hits++;
            }
            f[TERRAIN_OFFSET + channel * CELLS + cell] = Math.min(1, f[TERRAIN_OFFSET + channel * CELLS + cell] + hits / 9);
        }
    }

    const a = snapshot.abilities || {};
    const rules = [(a.freezeRadius ?? 270) / 400, (a.freezeDuration ?? 10) / 15, (a.freezeCooldown ?? 10) / 15,
        (a.conversionRadius ?? 65) / 100, (a.maxSpeed ?? 4.2) / 6, (a.rallyRadius ?? 180) / 250, (snapshot.neutrals?.length || 0) / 40];
    rules.forEach((value, i) => { f[RULE_OFFSET + i] = value; });
    return f;
}

/** Accepts v1 or v2 models and returns a v2 model; throws on anything else. */
export function validateModel(model) {
    if (model?.version === LEGACY_VERSION && model.weights?.length === LEGACY_INPUTS * ACTION_IDS.length) model = migrateLegacyModel(model);
    if (model?.version !== POLICY_VERSION || model.weights?.length !== PARAMETERS || !model.weights.every(Number.isFinite)) throw new Error('Incompatible offline policy');
    return model;
}

export const LEGACY_PARAMETERS = LEGACY_INPUTS * ACTION_IDS.length;

/** Re-lays a v1 per-parameter vector (weights or optimizer moments) into v2, zero-filling new inputs. */
export function migrateLegacyVector(values) {
    const out = new Array(PARAMETERS).fill(0);
    for (let action = 0; action < ACTION_IDS.length; action++) {
        for (let j = 0; j < LEGACY_INPUTS; j++) out[action * INPUTS + j] = values[action * LEGACY_INPUTS + j];
    }
    return out;
}

export function migrateLegacyModel(model) {
    return { ...model, version: POLICY_VERSION, migratedFrom: LEGACY_VERSION, weights: migrateLegacyVector(model.weights) };
}

export function policy(snapshot, model) {
    const x = features(snapshot), { candidates } = decisionCandidates(snapshot);
    const logits = ACTION_IDS.map((id, action) => {
        if (!candidates.has(id)) return -Infinity;
        let value = 0;
        for (let j = 0; j < INPUTS; j++) value += model.weights[action * INPUTS + j] * x[j];
        return value;
    });
    const max = Math.max(...logits), exp = logits.map(v => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return { x, probabilities: exp.map(p => p / sum), candidates };
}

export function chooseAction(snapshot, model) {
    const { probabilities, candidates } = policy(snapshot, model);
    return candidates.get(ACTION_IDS[probabilities.indexOf(Math.max(...probabilities))]).action;
}
