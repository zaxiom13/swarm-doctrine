/**
 * Jev opponent: request building, response parsing and a game-clock driven
 * controller. The browser only talks to the local proxy (server.mjs); the
 * OpenRouter key never reaches the page.
 *
 * Cost notes (measured, see scripts/jev-cost.mjs): Jev bills input tokens only.
 * Requests use 10px integer coordinates and list each action id once, and the
 * controller asks on game events plus a heartbeat instead of every second.
 */
import { ActionError, decisionCandidates, validateAction } from './actions.js';
import { DEFAULT_RULES, rulesSentence } from '../rules.js';

export const DEFAULT_MODEL_ID = 'typesafe/jev-1.13';
export const UNIT = 10;
export const DEFAULT_HEARTBEAT_SECONDS = 2;

const MAX_UNITS_PER_SIDE = 220;
const MAX_NEUTRALS = 40;
const MAX_TERRAIN = 48;
const RULE_KEYS = ['conversionThreshold', 'conversionTicks', 'rallyCoolOff', 'freezeLockout', 'freezeFraction'];

export { ActionError, validateAction };

function finite(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new ActionError(`${name} must be finite`);
    return number;
}

function inArena(point, name, width, height) {
    const x = finite(point?.x, `${name}.x`), y = finite(point?.y, `${name}.y`);
    if (x < 0 || x > width || y < 0 || y > height) throw new ActionError(`${name} is outside the arena`);
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

function units(list, name, width, height, max) {
    if (!Array.isArray(list)) throw new ActionError(`${name} must be an array`);
    if (list.length > max) throw new ActionError(`${name} has too many units`);
    return list.map((unit, i) => ({ ...inArena(unit, `${name}[${i}]`, width, height), ...(unit.frozen ? { frozen: true } : {}) }));
}

/** Validates an untrusted snapshot from the browser and bounds its size. */
export function compactSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new ActionError('snapshot must be an object');
    const width = finite(snapshot.arena?.width, 'arena.width'), height = finite(snapshot.arena?.height, 'arena.height');
    if (width <= 0 || height <= 0 || width > 10000 || height > 10000) throw new ActionError('arena size is invalid');
    const state = {
        arena: { width, height },
        allies: units(snapshot.allies, 'allies', width, height, MAX_UNITS_PER_SIDE),
        rivals: units(snapshot.rivals, 'rivals', width, height, MAX_UNITS_PER_SIDE),
        neutrals: units(snapshot.neutrals ?? [], 'neutrals', width, height, Infinity).slice(0, MAX_NEUTRALS),
    };
    const terrain = snapshot.terrain ?? [];
    if (!Array.isArray(terrain) || terrain.length > MAX_TERRAIN) throw new ActionError('terrain is invalid');
    state.terrain = terrain.map((field, i) => {
        const radius = Math.max(0, finite(field.radius ?? 0, `terrain[${i}].radius`));
        const reach = Math.max(radius, finite(field.reach ?? radius, `terrain[${i}].reach`));
        if (reach > Math.max(width, height)) throw new ActionError('terrain radius is too large');
        return { ...inArena(field, `terrain[${i}]`, width, height), radius, reach, type: typeof field.type === 'string' ? field.type.slice(0, 24) : 'obstacle' };
    });
    if (snapshot.rally && typeof snapshot.rally === 'object') {
        state.rally = {
            active: Boolean(snapshot.rally.active),
            cooldown: Math.max(0, finite(snapshot.rally.cooldown ?? 0, 'rally.cooldown')),
            remaining: Math.max(0, finite(snapshot.rally.remaining ?? 0, 'rally.remaining')),
            ...(snapshot.rally.target ? { target: inArena(snapshot.rally.target, 'rally.target', width, height) } : {}),
        };
    }
    state.freeze = { cooldown: Math.max(0, finite(snapshot.freeze?.cooldown ?? 0, 'freeze.cooldown')) };
    if (snapshot.abilities && typeof snapshot.abilities === 'object') {
        state.abilities = Object.fromEntries(Object.entries(snapshot.abilities).filter(([, v]) => Number.isFinite(v) && v >= 0).slice(0, 12));
    }
    if (snapshot.rules && typeof snapshot.rules === 'object') {
        state.rules = Object.fromEntries(RULE_KEYS.filter(key => Number.isFinite(snapshot.rules[key])).map(key => [key, snapshot.rules[key]]));
    }
    return state;
}

/** The rules as this fleet experiences them, including its own upgrades. */
export function effectiveRules(state) {
    const a = state.abilities || {};
    return { ...DEFAULT_RULES, ...state.rules,
        freezeRadius: a.freezeRadius ?? DEFAULT_RULES.freezeRadius, freezeDuration: a.freezeDuration ?? DEFAULT_RULES.freezeDuration,
        freezeCooldown: a.freezeCooldown ?? DEFAULT_RULES.freezeCooldown, conversionRadius: a.conversionRadius ?? DEFAULT_RULES.conversionRadius };
}

const u = value => Math.round(value / UNIT);
const ships = list => list.map(s => `${u(s.x)},${u(s.y)}${s.frozen ? ',f' : ''}`).join(' ');
const ACTION_HELP = 'rally_T_S: Rally to target T for S seconds. freeze_T: Freeze at target T. wait: keep the current order. release: stop Rally.';
const STATE_KEY = `Coordinates in ${UNIT}px units from the top-left. Ships are "x,y", or "x,y,f" when frozen.`;

function fleetState(state, targets) {
    return {
        allies: ships(state.allies),
        targets: targets.map(t => [u(t.x), u(t.y)]),
        rally: state.rally?.active ? [Math.round(state.rally.remaining * 10) / 10, u(state.rally.target?.x ?? 0), u(state.rally.target?.y ?? 0)] : 0,
        freezeIn: Math.ceil(state.freeze.cooldown),
    };
}

const criteria = candidates => Object.fromEntries([...candidates.keys()].map(id => [id, '']));

export function buildDecisionRequest(snapshot, model = DEFAULT_MODEL_ID) {
    if (typeof model !== 'string' || !model.trim()) throw new ActionError('a resolved Jev model id is required', 'missing_model');
    const state = compactSnapshot(snapshot);
    const { candidates, targets } = decisionCandidates(state);
    return {
        model: model.trim(),
        state: {
            key: STATE_KEY,
            arena: [u(state.arena.width), u(state.arena.height)],
            ...fleetState(state, targets),
            rivals: ships(state.rivals),
            neutrals: ships(state.neutrals),
            terrain: state.terrain.map(t => [t.type, u(t.x), u(t.y), u(t.reach)]),
        },
        questions: {
            action: {
                type: 'choice',
                instructions: `You command the allies. Recruit every rival. ${rulesSentence(effectiveRules(state), { unit: UNIT })} Choose one action id. ${ACTION_HELP}`,
                criteria: criteria(candidates),
            },
        },
    };
}

/**
 * Several AI fleets sharing one arena in one call. Ships, terrain and rules are
 * sent once; each question only names its fleet. `fleets` maps a fleet name to
 * that fleet's own snapshot of the same arena.
 */
export function buildBatchedRequest(fleets, model = DEFAULT_MODEL_ID) {
    const names = Object.keys(fleets);
    if (!names.length) throw new ActionError('at least one fleet is required');
    const views = names.map(name => {
        const state = compactSnapshot(fleets[name]);
        return { name, state, ...decisionCandidates(state) };
    });
    const first = views[0].state;
    return {
        model,
        state: {
            key: STATE_KEY,
            rules: `Each question commands one fleet; every other fleet is its rival. Recruit every rival. ${rulesSentence(effectiveRules(first), { unit: UNIT })} ${ACTION_HELP}`,
            arena: [u(first.arena.width), u(first.arena.height)],
            fleets: Object.fromEntries(views.map(v => [v.name, fleetState(v.state, v.targets)])),
            neutrals: ships(first.neutrals),
            terrain: first.terrain.map(t => [t.type, u(t.x), u(t.y), u(t.reach)]),
        },
        questions: Object.fromEntries(views.map(v => [v.name, { type: 'choice', instructions: `Best action id for fleet ${v.name}, using its targets.`, criteria: criteria(v.candidates) }])),
    };
}

/** Maps Jev's choice back to a validated game action, keeping its probabilities. */
export function actionFromDecisionResponse(payload, snapshot, question = 'action') {
    const state = compactSnapshot(snapshot);
    const { candidates } = decisionCandidates(state);
    const answer = payload?.answers?.[question];
    const choice = typeof answer === 'string' ? answer : answer?.choice;
    if (typeof choice !== 'string' || !candidates.has(choice)) throw new ActionError('Jev returned an unknown action choice', 'invalid_model_output');
    const action = validateAction(candidates.get(choice).action, state.arena);
    return Object.defineProperty(action, 'probabilities', { value: answer?.probabilities || null, enumerable: false });
}

/** Asks only when something changed: Freeze ready, Rally ended, fleets shifted, or the heartbeat elapsed. */
export function shouldAsk(snapshot, last, second, heartbeat = DEFAULT_HEARTBEAT_SECONDS) {
    if (!last) return true;
    return (snapshot.freeze.cooldown <= 0 && last.freeze > 0)
        || (last.rally && !snapshot.rally.active)
        || Math.abs(snapshot.allies.length - last.allies) + Math.abs(snapshot.rivals.length - last.rivals) >= 3
        || second - last.second >= heartbeat;
}

export async function configureOpponent({ apiKey, model } = {}, options = {}) {
    if (apiKey !== undefined && typeof apiKey !== 'string') throw new ActionError('apiKey must be text');
    if (model !== undefined && (typeof model !== 'string' || !model.trim())) throw new ActionError('model must be text');
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const response = await fetchImpl(options.endpoint || '/api/opponent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(apiKey !== undefined ? { apiKey } : {}), ...(model !== undefined ? { model } : {}) }),
    });
    const payload = await response.json();
    if (!response.ok) throw new ActionError(payload?.message || 'Unable to configure opponent', payload?.code || 'config_error');
    return payload;
}

export async function getOpponentStatus(options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const response = await fetchImpl(options.endpoint || '/api/opponent/status');
    const payload = await response.json();
    return { ...payload, reachable: response.ok };
}

/**
 * Driven by the game clock: call tick() once per simulated second. It never
 * overlaps requests and drops answers that arrive after stop() or restart.
 */
export class JevController {
    constructor({ endpoint = '/api/opponent/decision', fetchImpl, heartbeat = DEFAULT_HEARTBEAT_SECONDS, onAction, onStatus } = {}) {
        this.endpoint = endpoint;
        this.fetchImpl = fetchImpl || globalThis.fetch?.bind(globalThis);
        this.heartbeat = heartbeat;
        this.onAction = onAction;
        this.onStatus = onStatus;
        this.running = false;
        this.inFlight = null;
        this.sequence = 0;
        this.last = null;
        this.calls = 0;
        this.spentUsd = 0;
    }

    start() {
        this.stop();
        this.running = true;
        this.last = null;
        this.onStatus?.({ state: 'connecting' });
    }

    stop() {
        this.running = false;
        this.sequence++;
        this.inFlight?.abort();
        this.inFlight = null;
    }

    tick(snapshot, second) {
        if (!this.running || this.inFlight || typeof this.fetchImpl !== 'function') return false;
        if (!shouldAsk(snapshot, this.last, second, this.heartbeat)) return false;
        this.last = { second, freeze: snapshot.freeze.cooldown, rally: snapshot.rally.active, allies: snapshot.allies.length, rivals: snapshot.rivals.length };
        this.request(snapshot);
        return true;
    }

    async request(snapshot) {
        const sequence = ++this.sequence;
        const controller = new AbortController();
        this.inFlight = controller;
        this.onStatus?.({ state: 'thinking' });
        try {
            const response = await this.fetchImpl(this.endpoint, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snapshot }), signal: controller.signal,
            });
            const payload = await response.json();
            if (!this.running || sequence !== this.sequence) return;
            if (!response.ok) {
                const offline = payload?.status === 'offline' || response.status === 424 || response.status === 503;
                this.onStatus?.({ state: offline ? 'offline' : 'error', code: payload?.code || 'proxy_error', message: payload?.message || 'Opponent proxy request failed' });
                return;
            }
            this.calls++;
            this.spentUsd += Number(payload.usage?.cost) || 0;
            const action = validateAction(payload.action, snapshot.arena);
            this.onAction?.(action);
            this.onStatus?.({ state: 'online', model: payload.model || null, calls: this.calls, spentUsd: this.spentUsd });
        } catch (error) {
            if (this.running && sequence === this.sequence && error?.name !== 'AbortError') {
                this.onStatus?.({ state: 'offline', code: 'proxy_unreachable', message: 'Opponent model is offline' });
            }
        } finally {
            if (sequence === this.sequence) this.inFlight = null;
        }
    }
}
