// Every number that changes how the game plays. Players, bots, the local
// policy, Jev prompts, lessons and the HUD all read from one rules object, so a
// balance change is made here once and every consumer sees it.
export const DEFAULT_RULES = Object.freeze({
    // Flocking (per simulation tick at 60 Hz)
    maxSpeed: 4.2,
    maxForce: 0.18,
    perceptionRadius: 55,
    separationRadius: 24,
    separationWeight: 1.6,
    alignmentWeight: 1.1,
    cohesionWeight: 1.2,
    shipSize: 9,

    // Recruitment
    conversionRadius: 65,
    conversionThreshold: 3,
    conversionTicks: 36,
    conversionCooldownTicks: 45,
    frozenConversionSlowdown: 1.15,
    rallyVulnerability: 0.75,

    // Rally
    rallyRadius: 180,
    rallyAttractForce: 1.5,
    rallyRepelForce: 0.8,
    rallyCoolOff: 0.45,
    releaseSettle: 1.5,
    releaseSpreadRadius: 140,

    // Freeze
    freezeRadius: 270,
    freezeDuration: 10,
    freezeCooldown: 10,
    freezeLockout: 15,
    freezeFraction: 0.5,

    // Duel arena
    duelFleetSize: 80,
    duelNeutralsAtStart: 24,
    duelNeutralWave: 12,
    duelNeutralInterval: 12,
    duelNeutralCap: 40,
    duelShipCap: 220,
});

/** The rule values players may change in Settings. */
export const ADJUSTABLE_RULES = ['conversionThreshold', 'separationWeight', 'alignmentWeight', 'cohesionWeight', 'maxSpeed', 'perceptionRadius'];

/** A fresh, mutable rules object for one match. Upgrades mutate only this copy. */
export function createRules(overrides = {}) {
    const rules = { ...DEFAULT_RULES };
    for (const [key, value] of Object.entries(overrides)) {
        if (key in DEFAULT_RULES && Number.isFinite(value)) rules[key] = value;
    }
    return rules;
}

/** Rule values that change strategy. Anything else (colours, sizes) is excluded. */
export const STRATEGIC_RULES = ['maxSpeed', 'conversionRadius', 'conversionThreshold', 'conversionTicks', 'rallyRadius', 'rallyCoolOff',
    'freezeRadius', 'freezeDuration', 'freezeCooldown', 'freezeLockout', 'freezeFraction', 'duelFleetSize', 'duelNeutralWave', 'duelNeutralInterval', 'duelNeutralCap'];

/** Stable fingerprint of the strategic rules, stored with trained models. */
export function rulesHash(rules) {
    const text = STRATEGIC_RULES.map(key => `${key}=${Number(rules[key]).toFixed(3)}`).join(';');
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
    return hash.toString(16).padStart(8, '0');
}

const seconds = value => `${Math.round(value * 100) / 100}s`;

/** Plain-language rules, generated from the numbers so text can never drift. */
export function describeRules(rules, { unit = 1 } = {}) {
    const distance = px => unit === 1 ? `${Math.round(px)}px` : `${Math.round(px / unit * 10) / 10} units`;
    const fraction = rules.freezeFraction === 0.5 ? 'half' : `${Math.round(rules.freezeFraction * 100)}%`;
    return {
        rally: `Rally moves your ships. They cannot recruit while rallying or for ${seconds(rules.rallyCoolOff)} after release.`,
        recruit: `Recruiting needs ${rules.conversionThreshold}+ active ships within ${distance(rules.conversionRadius)} that outnumber the defenders for about ${seconds(rules.conversionTicks / 60)}.`,
        freeze: `Freeze stops ${fraction} the rivals within ${distance(rules.freezeRadius)} for ${seconds(rules.freezeDuration)}. Frozen ships cannot recruit or defend.`,
        freezeTiming: `Freeze recharges in ${seconds(rules.freezeCooldown)}, is locked for the first ${seconds(rules.freezeLockout)} and releases Rally.`,
        neutrals: 'Gray ships belong to nobody and cannot recruit; either fleet can recruit them.',
        terrain: 'Black-hole cores destroy ships, asteroids scatter them, nebulae slow them.',
    };
}

export function rulesSentence(rules, options) {
    return Object.values(describeRules(rules, options)).join(' ');
}
