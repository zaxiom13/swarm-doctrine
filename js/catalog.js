// Static game content: teams, liveries, difficulty, modes and upgrades.

export const TEAMS = {
    dragon: { id: 'dragon', name: 'Dragon', symbol: '◇', color: '#00f7ff', rgb: '0, 247, 255', speed: 1.12, resist: 1.0, pressure: 1.1 },
    salamander: { id: 'salamander', name: 'Salamander', symbol: '⬡', color: '#ff3b3b', rgb: '255, 59, 59', speed: 0.95, resist: 1.2, pressure: 1.0 },
    phoenix: { id: 'phoenix', name: 'Phoenix', symbol: '✳', color: '#ff9900', rgb: '255, 153, 0', speed: 1.05, resist: 1.0, pressure: 1.35 },
    rat: { id: 'rat', name: 'Rat', symbol: '⌁', color: '#b844ff', rgb: '184, 68, 255', speed: 1.05, resist: 1.05, pressure: 1.05 },
};
export const TEAM_IDS = Object.keys(TEAMS);

/** Perk text derived from the numbers the simulation actually uses. */
export function teamPerks(team) {
    const perk = (label, value) => value === 1 ? null : `${label} ${value > 1 ? '+' : '−'}${Math.round(Math.abs(value - 1) * 100)}%`;
    return [perk('Speed', team.speed), perk('Defense', team.resist), perk('Recruit', team.pressure)].filter(Boolean);
}

export const NEUTRAL_LOOK = { color: '#aab4c3', rgb: '170, 180, 195' };

// Duel liveries replace faction colours so both sides read as "you" and "rival".
export const DUEL_LOOK = {
    you: { color: '#3ecbff', rgb: '62, 203, 255' },
    rival: { color: '#ff6a3d', rgb: '255, 106, 61' },
};

export const DIFFICULTY = {
    easy: { speed: 0.8, cohesion: 0.75, resist: 0.8 },
    medium: { speed: 1.0, cohesion: 1.0, resist: 1.0 },
    hard: { speed: 1.25, cohesion: 1.3, resist: 1.25 },
};

export const MODES = [
    { id: 'levels', group: 'Solo', name: 'Levels', icon: '🗺️', color: '#ffb13b', summary: 'A new map each sector, harder each time.' },
    { id: 'zen', group: 'Solo', name: 'Zen', icon: '🌿', color: '#4cf0a8', summary: 'Terrain shifts. No game over.' },
    { id: 'survival', group: 'Solo', name: 'Survival', icon: '🛡️', color: '#ff5d7a', summary: 'Hold out against waves. Pick upgrades.' },
    { id: 'duel', group: 'Duel', name: 'Duel', icon: '⚔️', color: '#6aa8ff', summary: 'One on one. Pick your rival.' },
];

export const DUEL_RIVALS = [
    { id: 'duel-hard', name: 'Hard bot', icon: '🤖', color: '#ff8a3d', summary: 'A fast scripted rival that reads the rules.' },
    { id: 'duel-tactician', name: 'Tactician', icon: '🧠', color: '#c77dff', summary: 'Looks ahead by simulating each move.' },
    { id: 'duel-local', name: 'Local rival', icon: '🎯', color: '#4cf0a8', summary: 'A trained policy. Runs offline.' },
    { id: 'duel-jev', name: 'Jev', icon: '⚡', color: '#ffd23f', summary: 'Online decision model. Needs a key.', localOnly: true },
];

/** Jev needs the local proxy (node server.mjs), so hosted builds hide it. */
export const IS_LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(globalThis.location?.hostname);
export const AVAILABLE_RIVALS = DUEL_RIVALS.filter(rival => IS_LOCAL || !rival.localOnly);

export const LEVEL_ENEMIES = [
    { id: 'ai', name: 'AI rivals', icon: '🔥', color: '#ff5d7a', summary: 'Rival fleets rally, recruit and freeze like you.' },
    { id: 'passive', name: 'Passive rivals', icon: '😴', color: '#6aa8ff', summary: 'Rival fleets drift and only fight back up close.' },
];

/**
 * Upgrades offered between Conquest milestones and Survival waves. Each applies
 * to one team's modifiers, so it lasts for the current match only.
 */
export const UPGRADES = [
    { id: 'faster-recruitment', name: 'Faster recruitment', icon: '🧬', category: 'Offense', description: 'Your recruiting is 35% faster, up to its speed limit.',
        apply: mods => { mods.pressure = Math.min(mods.pressure / 0.65, mods.pressure * 2.25); } },
    { id: 'stronger-rally', name: 'Stronger Rally', icon: '🛰️', category: 'Tactics', description: 'Rally pulls 40% harder and pushes rivals from 50% farther away.',
        apply: mods => { mods.rallyRadius *= 1.5; mods.rallyForce *= 1.4; } },
    { id: 'fleet-defense', name: 'Fleet defense', icon: '🛡️', category: 'Defense', description: 'Rivals need 50% more nearby ships to recruit yours.',
        apply: mods => { mods.resist *= 1.5; } },
    { id: 'chain-reaction', name: 'Chain reaction', icon: '⚡', category: 'Offense', description: 'Each recruit helps convert another nearby rival.',
        apply: mods => { mods.chain = true; } },
    { id: 'reinforcements', name: 'Reinforcements', icon: '🛸', category: 'Logistics', description: 'Add 25 ships beside your fleet.',
        apply: (mods, sim, team) => { sim.spawnNear(team, 25); } },
    { id: 'wider-freeze', name: 'Wider Freeze', icon: '🌐', category: 'Tactics', description: 'Freeze reaches 40% farther and lasts 1.5 seconds longer.',
        apply: mods => { mods.freezeRadius *= 1.4; mods.freezeDuration += 1.5; } },
];
export const UPGRADE_LIMIT = 2;

/** Default per-team modifiers; modes and upgrades adjust copies of this. */
export function baseModifiers() {
    return { speed: 1, cohesion: 1, resist: 1, pressure: 1, chain: false, rallyRadius: 1, rallyForce: 1, freezeRadius: 1, freezeDuration: 0 };
}
