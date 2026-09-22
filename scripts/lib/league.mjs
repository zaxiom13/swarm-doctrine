// Named controllers, randomized rule sets and the training opponent rotation,
// shared by the trainer, the balance evaluator and Jev distillation.
import fs from 'node:fs';
import { chooseEasyBotAction, chooseHardBotAction, HARD_BOT_STYLES } from '../../js/ai/hard-bot.js';
import { chooseSearchAction } from '../../js/ai/search-bot.js';
import { chooseAction, validateModel } from '../../js/ai/local-policy.js';
import { createRules } from '../../js/rules.js';
import { randomFrom } from '../../js/worlds.js';

export function loadModel(file) {
    return validateModel(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export function archiveModels(dir = new URL('../../models/league/', import.meta.url)) {
    try { return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => ({ name: f.replace(/\.json$/, ''), model: loadModel(new URL(f, dir)) })); }
    catch { return []; }
}

/**
 * A controller is (snapshot, second, arena, team) → action. Names: easy, hard,
 * hard-<style>, tactician, local, or model:<path>.
 */
export function controller(name, { model } = {}) {
    if (name === 'easy') return (snapshot, second) => chooseEasyBotAction(snapshot, second);
    if (name === 'hard') return (snapshot, second, arena) => chooseHardBotAction(snapshot, second, arena.world.seed % 3);
    const style = HARD_BOT_STYLES.indexOf(name.replace(/^hard-/, ''));
    if (name.startsWith('hard-') && style >= 0) return (snapshot, second) => chooseHardBotAction(snapshot, second, style);
    if (name === 'tactician') return (snapshot, second, arena, team) => chooseSearchAction(arena.sim, team, { horizon: 2 }).action;
    if (name === 'local') return snapshot => chooseAction(snapshot, model || loadModel(new URL('../../models/offline-policy.json', import.meta.url)));
    if (name.startsWith('model:')) { const m = loadModel(name.slice(6)); return snapshot => chooseAction(snapshot, m); }
    if (model) return snapshot => chooseAction(snapshot, model);
    throw new Error(`Unknown controller: ${name}`);
}

/**
 * A seeded variation of the rules, so policies learn to read ability sizes
 * instead of memorising one balance. Terrain density varies with `tier`.
 */
export function randomRules(seed) {
    const random = randomFrom(seed ^ 0x5bd1e995);
    const scale = (min, max) => min + random() * (max - min);
    const base = createRules();
    return {
        rules: createRules({
            freezeRadius: Math.round(base.freezeRadius * scale(0.7, 1.35)),
            freezeDuration: Math.round(base.freezeDuration * scale(0.6, 1.4) * 2) / 2,
            freezeCooldown: Math.round(base.freezeCooldown * scale(0.7, 1.5) * 2) / 2,
            maxSpeed: Math.round(base.maxSpeed * scale(0.85, 1.2) * 10) / 10,
            conversionRadius: Math.round(base.conversionRadius * scale(0.85, 1.2)),
        }),
        tier: 1 + Math.floor(random() * 5),
    };
}

/** The opponent for a training seed: easy, three hard styles, archived champions and self-play. */
export function leagueOpponent(seed, { self, archive = [] } = {}) {
    const slot = seed % 6;
    if (slot === 0) return { name: 'easy', play: controller('easy') };
    if (slot <= 3) return { name: `hard-${HARD_BOT_STYLES[slot - 1]}`, play: controller(`hard-${HARD_BOT_STYLES[slot - 1]}`) };
    if (slot === 4 && archive.length) { const pick = archive[Math.floor(seed / 6) % archive.length]; return { name: `league:${pick.name}`, play: controller('model', { model: pick.model }) }; }
    if (self) return { name: 'self', play: controller('model', { model: self }) };
    return { name: 'hard', play: controller('hard') };
}
