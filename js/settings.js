// Player preferences. Only the keys in SETTINGS_SCHEMA are ever stored, so
// match-scoped changes (upgrades, lesson assists) can never leak into saves.
import { DEFAULT_RULES } from './rules.js';

const STORAGE_KEY = 'swarm-doctrine-settings-v3';
const LEGACY_KEY = 'swarm-doctrine-config-v2';

const rule = (key, label, min, max, step) => ({ key, label, type: 'range', min, max, step, rule: true, default: DEFAULT_RULES[key], group: 'physics' });

export const SETTINGS_SCHEMA = [
    { key: 'boidCount', label: 'Ship count', type: 'range', min: 60, max: 320, step: 10, default: 160, group: 'match', note: 'Next match' },
    { key: 'difficulty', label: 'Difficulty', type: 'select', options: [['easy', 'Easy'], ['medium', 'Normal'], ['hard', 'Hard']], default: 'medium', group: 'match', note: 'Next match' },
    { ...rule('conversionThreshold', 'Recruit size', 2, 6, 1), group: 'match' },
    { key: 'sound', label: 'Sound effects', type: 'toggle', default: true, group: 'audio' },
    { key: 'music', label: 'Music', type: 'toggle', default: true, group: 'audio' },
    { key: 'haptics', label: 'Vibration', type: 'toggle', default: true, group: 'comfort' },
    { key: 'reducedMotion', label: 'Reduce motion', type: 'toggle', default: null, group: 'comfort' },
    rule('separationWeight', 'Separation', 0, 5, 0.1),
    rule('alignmentWeight', 'Alignment', 0, 3, 0.1),
    rule('cohesionWeight', 'Cohesion', 0, 3, 0.1),
    rule('maxSpeed', 'Max speed', 1, 8, 0.1),
    rule('perceptionRadius', 'Perception', 20, 100, 5),
];

export const SETTINGS_GROUPS = { match: 'Match', audio: 'Audio', comfort: 'Comfort', physics: 'Physics' };

const LEGACY_NAMES = { sound: 'soundEnabled', music: 'musicEnabled' };

function valid(field, value) {
    if (field.type === 'toggle') return typeof value === 'boolean' || (field.default === null && value === null);
    if (field.type === 'select') return field.options.some(([id]) => id === value);
    return Number.isFinite(value) && value >= field.min && value <= field.max;
}

function defaults() {
    return Object.fromEntries(SETTINGS_SCHEMA.map(field => [field.key, field.default]));
}

function load() {
    const result = defaults();
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const legacy = !stored && localStorage.getItem(LEGACY_KEY);
        const saved = JSON.parse(stored || legacy || 'null');
        if (saved && typeof saved === 'object') {
            for (const field of SETTINGS_SCHEMA) {
                const value = saved[field.key] ?? saved[LEGACY_NAMES[field.key]];
                if (valid(field, value)) result[field.key] = value;
            }
        }
    } catch { /* Settings are optional; defaults keep the game playable. */ }
    return result;
}

export const settings = load();

function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* Storage can be unavailable in private modes. */ }
}

export function setSetting(key, value) {
    const field = SETTINGS_SCHEMA.find(item => item.key === key);
    if (!field || !valid(field, value)) return false;
    settings[key] = value;
    saveSettings();
    return true;
}

export function resetSettings() {
    Object.assign(settings, defaults());
    saveSettings();
}

/** Rule overrides chosen by the player, applied to every new match. */
export function ruleOverrides() {
    return Object.fromEntries(SETTINGS_SCHEMA.filter(field => field.rule).map(field => [field.key, settings[field.key]]));
}

export function prefersReducedMotion() {
    if (typeof settings.reducedMotion === 'boolean') return settings.reducedMotion;
    return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
