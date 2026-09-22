// Seeded worlds are data: retries replay the map, while new sectors get a new seed.
import { TEAM_IDS } from './catalog.js';

export const DIFFICULTY_CAP = 10;
export function randomFrom(seed) {
    let value = seed >>> 0;
    return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
export function levelRules(level = 1) {
    const tier = Math.min(DIFFICULTY_CAP, Math.max(1, Math.floor(level)));
    return { tier, hazards: Math.min(7, 1 + Math.floor(tier * 0.65)), rivals: Math.min(3, 1 + Math.floor((tier - 1) / 3)),
        enemyCount: Math.min(34, 16 + tier * 2), playerCount: 40,
        enemySpeed: Math.min(1.2, 0.78 + tier * 0.042), enemyCohesion: Math.min(1.25, 0.8 + tier * 0.045),
        conversionResist: Math.min(1.2, 0.75 + tier * 0.045) };
}
const NAMES = ['Jade Passage', 'Quiet Rift', 'Ember Garden', 'Glasswater', 'Violet Reach', 'The Long Way Home'];
export function buildWorld(seed, level = 4, width = 1280, height = 720) {
    const random = randomFrom(seed);
    const rules = levelRules(level);
    const scale = Math.min(width, height);
    // The horizontal middle lane is always open. Corners are reserved for fleet spawns.
    const slots = [[.32,.29],[.68,.71],[.68,.29],[.32,.71],[.5,.22],[.5,.78],[.82,.5]];
    // Seeded shuffle without moving hazards into the reserved spawn areas.
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [slots[i],slots[j]] = [slots[j],slots[i]]; }
    const types = level < 3 ? ['slowZone', 'asteroid'] : ['slowZone', 'asteroid', 'blackHole'];
    const terrain = slots.slice(0, rules.hazards).map(([x,y],i) => {
        const type = types[Math.floor(random() * types.length)];
        const radius = scale * (type === 'blackHole' ? .026 + random() * .012 : .062 + random() * .018);
        return { type, x: x * width, y: y * height, radius, id: `terrain-${i}` };
    });
    return { seed: seed >>> 0, name: NAMES[Math.floor(random() * NAMES.length)], terrain
        };
}
export function validCheckpoint(value) {
    return value && Number.isSafeInteger(value.level) && value.level >= 1 && value.level <= 100000 &&
        Number.isInteger(value.seed) && value.seed >= 0 && value.seed <= 0xffffffff &&
        TEAM_IDS.includes(value.team);
}
