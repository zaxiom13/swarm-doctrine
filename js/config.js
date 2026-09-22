// Game Configuration - Enhanced with Doctrines, Active Abilities, and Team Traits
const DEFAULT_CONFIG = {
    boidCount: 160,
    conversionThreshold: 3,
    difficulty: 'medium',
    soundEnabled: true,
    musicEnabled: true,

    // Boid behavior
    maxSpeed: 4.2,
    maxForce: 0.18,
    perceptionRadius: 55,
    separationRadius: 24,
    conversionRadius: 65,

    // Flocking weights
    separationWeight: 1.6,
    alignmentWeight: 1.1,
    cohesionWeight: 1.2,

    // Player Tactical Beacon
    beaconAttractForce: 1.5,
    beaconRepelEnemies: 0.8,
    beaconRadius: 180,

    // One deliberate area-control ability. The effect and recharge both last 10s.
    empRadius: 360,
    empDuration: 10,
    empCooldown: 10,

    // Conversion mechanics
    conversionCooldown: 45,
    peerPressureTime: 36, // Snappier peer pressure conversion

    // Visual
    boidSize: 9,
    trailLength: 6,
    particlesEnabled: true,
    screenShakeEnabled: true,
};

const STORAGE_KEY = 'swarm-doctrine-config-v2';

function loadConfig() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_CONFIG, ...parsed, empRadius: 360, empDuration: 10, empCooldown: 10 };
        }
    } catch (e) {
        console.warn('Failed to load config from localStorage:', e);
    }
    return { ...DEFAULT_CONFIG };
}

export function saveConfig() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(CONFIG));
    } catch (e) {
        console.warn('Failed to save config to localStorage:', e);
    }
}

export function resetConfig() {
    Object.assign(CONFIG, DEFAULT_CONFIG);
    saveConfig();
}

export function updateConfig(key, value) {
    if (key in CONFIG) {
        CONFIG[key] = value;
        saveConfig();
    }
}

export const CONFIG = loadConfig();

export const DIFFICULTY_MODS = {
    easy: { enemySpeed: 0.8, enemyCohesion: 0.75, conversionResist: 0.8, name: 'CADET' },
    medium: { enemySpeed: 1.0, enemyCohesion: 1.0, conversionResist: 1.0, name: 'COMMANDER' },
    hard: { enemySpeed: 1.25, enemyCohesion: 1.3, conversionResist: 1.25, name: 'HEGEMON' },
};

// 4 Iconic Armies with unique tactical lore and perks
export const TEAMS = {
    dragon: {
        id: 'dragon',
        name: 'DRAGON FLEET',
        motto: '"The enemy\'s gate is down."',
        perk: '+15% Speed & Aggressive Piercing Formation',
        color: '#00f7ff',
        colorRgb: '0, 247, 255',
        glow: 'rgba(0, 247, 255, 0.6)',
        icon: '🐉',
        speedMult: 1.15,
        resistMult: 1.0,
        pressureMult: 1.2
    },
    salamander: {
        id: 'salamander',
        name: 'SALAMANDER CORPS',
        motto: '"Strength through unbreakable formation."',
        perk: '+35% Defense & Conversion Resistance',
        color: '#ff3b3b',
        colorRgb: '255, 59, 59',
        glow: 'rgba(255, 59, 59, 0.6)',
        icon: '🦎',
        speedMult: 0.95,
        resistMult: 1.35,
        pressureMult: 1.0
    },
    phoenix: {
        id: 'phoenix',
        name: 'PHOENIX LEGION',
        motto: '"From the embers of defeat, we rise."',
        perk: 'Fast Assimilation & Rapid Rebirth Surge',
        color: '#ff9900',
        colorRgb: '255, 153, 0',
        glow: 'rgba(255, 153, 0, 0.6)',
        icon: '🔥',
        speedMult: 1.05,
        resistMult: 0.9,
        pressureMult: 1.35
    },
    rat: {
        id: 'rat',
        name: 'RAT SYNDICATE',
        motto: '"Survive. Adapt. Swarm."',
        perk: 'High Agility & Tighter Flocking Cohesion',
        color: '#b844ff',
        colorRgb: '184, 68, 255',
        glow: 'rgba(184, 68, 255, 0.6)',
        icon: '🐀',
        speedMult: 1.1,
        resistMult: 1.1,
        pressureMult: 1.1
    }
};

// Roguelike Tactical Doctrines - Upgrades chosen during battles
export const DOCTRINES_CATALOG = [
    {
        id: 'nanite_virulence',
        name: 'NANITE VIRULENCE',
        icon: '🧬',
        category: 'OFFENSIVE',
        description: 'Accelerates peer pressure conversion speed by 35%. Enemies turn allegiance faster.',
        apply: (game) => {
            CONFIG.peerPressureTime = Math.max(16, Math.floor(CONFIG.peerPressureTime * 0.65));
        }
    },
    {
        id: 'graviton_beacon',
        name: 'GRAVITON BEACON',
        icon: '🛰️',
        category: 'TACTICAL',
        description: 'Tactical Beacon radius +50% and pulls friendly units with 40% stronger acceleration.',
        apply: (game) => {
            CONFIG.beaconRadius *= 1.5;
            CONFIG.beaconAttractForce *= 1.4;
        }
    },

    {
        id: 'vanguard_shielding',
        name: 'VANGUARD PLATING',
        icon: '🛡️',
        category: 'DEFENSIVE',
        description: 'Friendly fleet receives reinforced hull, resisting enemy conversion for 50% longer.',
        apply: (game) => {
            game.playerResistBonus = (game.playerResistBonus || 1) * 1.5;
        }
    },

    {
        id: 'chain_assimilation',
        name: 'CHAIN ASSIMILATION',
        icon: '⚡',
        category: 'OFFENSIVE',
        description: 'Every conversion releases a nano-shock that immediately transfers pressure to nearby enemies.',
        apply: (game) => {
            game.chainAssimilation = true;
        }
    },
    {
        id: 'drone_fabricator',
        name: 'NANITE FABRICATOR',
        icon: '🛸',
        category: 'LOGISTICS',
        description: 'Immediately manufactures 8 veteran drone units to reinforce your active battlegroup.',
        apply: (game) => {
            if (game.boids && game.playerTeam) {
                const cx = game.canvas.width / 2;
                const cy = game.canvas.height / 2;
                for (let i = 0; i < 8; i++) {
                    game.addBoid(cx + (Math.random() - 0.5) * 80, cy + (Math.random() - 0.5) * 80, game.playerTeam);
                }
            }
        }
    },
    {
        id: 'emp_overcharge',
        name: 'EMP DISRUPTOR MATRIX',
        icon: '🌐',
        category: 'TACTICAL',
        description: 'EMP lockdown radius increased by 40% and freezes targets for 1.5 seconds longer.',
        apply: (game) => {
            CONFIG.empRadius *= 1.4;
            CONFIG.empDuration += 1.5;
        }
    }
];
