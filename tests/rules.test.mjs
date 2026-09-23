import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map([['swarm-doctrine-config-v2', JSON.stringify({ boidCount: 200, soundEnabled: false, peerPressureTime: 5, beaconRadius: 999, empRadius: 50, maxSpeed: 5 })]]);
globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
const { DEFAULT_RULES, createRules, rulesHash, describeRules, rulesSentence } = await import('../js/rules.js');
const { settings, setSetting, resetSettings, ruleOverrides } = await import('../js/settings.js');
const { TEAMS, teamPerks, UPGRADES, baseModifiers } = await import('../js/catalog.js');
const { Simulation } = await import('../js/simulation.js');

test('legacy saves migrate only real settings; match-scoped values never persist', () => {
    assert.equal(settings.boidCount, 200);
    assert.equal(settings.sound, false);
    assert.equal(settings.maxSpeed, 5, 'a physics slider is a real setting');
    assert.equal(ruleOverrides().freezeRadius, undefined, 'Freeze size is not a player setting');
    const rules = createRules(ruleOverrides());
    assert.equal(rules.conversionTicks, DEFAULT_RULES.conversionTicks, 'old upgrade-mutated recruit time is dropped');
    assert.equal(rules.rallyRadius, DEFAULT_RULES.rallyRadius);
    assert.equal(rules.freezeRadius, 270);
});

test('settings validate their ranges, save under one key and reset cleanly', () => {
    assert.equal(setSetting('boidCount', 5000), false);
    assert.equal(setSetting('difficulty', 'hard'), true);
    assert.equal(setSetting('unknown', 1), false);
    const saved = JSON.parse(store.get('swarm-doctrine-settings-v3'));
    assert.equal(saved.difficulty, 'hard');
    assert.deepEqual(Object.keys(saved).sort(), Object.keys(settings).sort());
    resetSettings();
    assert.equal(settings.boidCount, 160);
});

test('upgrades change one team for one match and never touch rules or settings', () => {
    const sim = new Simulation();
    sim.setModifiers('dragon', baseModifiers());
    const before = JSON.stringify(settings);
    for (const upgrade of UPGRADES) upgrade.apply(sim.modifiers('dragon'), sim, 'dragon');
    assert.equal(sim.commander('dragon').freezeRadius, 270 * 1.4);
    assert.equal(sim.commander('salamander').freezeRadius, 270, 'rivals are unaffected');
    assert.equal(sim.rules.freezeRadius, 270);
    assert.equal(JSON.stringify(settings), before);
    assert.equal(sim.boids.length, 25, 'reinforcements');
});

test('createRules ignores unknown and non-finite overrides', () => {
    const rules = createRules({ freezeRadius: 300, bogus: 1, maxSpeed: NaN });
    assert.equal(rules.freezeRadius, 300);
    assert.equal(rules.maxSpeed, DEFAULT_RULES.maxSpeed);
    assert.equal('bogus' in rules, false);
});

test('rules text and fingerprints follow the numbers', () => {
    assert.match(describeRules(DEFAULT_RULES).freeze, /half the rivals within 270px for 10s/);
    assert.match(describeRules(createRules({ freezeRadius: 350, freezeDuration: 7 }), { unit: 10 }).freeze, /35 units for 7s/);
    assert.match(rulesSentence(DEFAULT_RULES), /locked for the first 15s/);
    assert.equal(rulesHash(DEFAULT_RULES), rulesHash(createRules()));
    assert.notEqual(rulesHash(DEFAULT_RULES), rulesHash(createRules({ freezeCooldown: 12 })));
    assert.equal(rulesHash(DEFAULT_RULES), rulesHash(createRules({ shipSize: 12 })), 'cosmetic values do not change the fingerprint');
});

test('team perk text is generated from the multipliers the simulation uses', () => {
    assert.deepEqual(teamPerks(TEAMS.phoenix), ['Speed +5%', 'Recruit +35%']);
    assert.deepEqual(teamPerks(TEAMS.salamander), ['Speed −5%', 'Defense +20%']);
});
