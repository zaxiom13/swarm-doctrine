// Game Configuration - Default values
const DEFAULT_CONFIG = {
    boidCount: 150,
    conversionThreshold: 3,
    difficulty: 'medium',
    soundEnabled: true,
    
    // Boid behavior
    maxSpeed: 4,
    maxForce: 0.15,
    perceptionRadius: 50,
    separationRadius: 25,
    conversionRadius: 60,
    
    // Flocking weights
    separationWeight: 1.5,
    alignmentWeight: 1.0,
    cohesionWeight: 1.0,
    
    // Player influence - stronger scatter
    attractForce: 0.0,
    repelForce: 2.0,
    influenceRadius: 120,
    
    // Conversion mechanics
    conversionCooldown: 60,
    peerPressureTime: 45, // Reduced for faster conversions
    
    // Visual
    boidSize: 8,
    trailLength: 5,
};

// LocalStorage key
const STORAGE_KEY = 'swarm-doctrine-config';

// Load config from localStorage or use defaults
function loadConfig() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge with defaults to handle new properties
            return { ...DEFAULT_CONFIG, ...parsed };
        }
    } catch (e) {
        console.warn('Failed to load config from localStorage:', e);
    }
    return { ...DEFAULT_CONFIG };
}

// Save config to localStorage
export function saveConfig() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(CONFIG));
    } catch (e) {
        console.warn('Failed to save config to localStorage:', e);
    }
}

// Reset config to defaults
export function resetConfig() {
    Object.assign(CONFIG, DEFAULT_CONFIG);
    saveConfig();
}

// Update a config value and save
export function updateConfig(key, value) {
    if (key in CONFIG) {
        CONFIG[key] = value;
        saveConfig();
    }
}

export const CONFIG = loadConfig();

export const DIFFICULTY_MODS = {
    easy: { enemySpeed: 0.8, enemyCohesion: 0.7, conversionResist: 0.8 },
    medium: { enemySpeed: 1.0, enemyCohesion: 1.0, conversionResist: 1.0 },
    hard: { enemySpeed: 1.2, enemyCohesion: 1.3, conversionResist: 1.2 },
};

// Team definitions - 4 teams with distinct colors
export const TEAMS = {
    dragon: {
        id: 'dragon',
        name: 'DRAGON ARMY',
        color: '#00ffff',
        colorRgb: '0, 255, 255',
        glow: 'rgba(0, 255, 255, 0.5)',
        icon: '🐉'
    },
    salamander: {
        id: 'salamander',
        name: 'SALAMANDER',
        color: '#ff4444',
        colorRgb: '255, 68, 68',
        glow: 'rgba(255, 68, 68, 0.5)',
        icon: '🦎'
    },
    phoenix: {
        id: 'phoenix',
        name: 'PHOENIX ARMY',
        color: '#ff8800',
        colorRgb: '255, 136, 0',
        glow: 'rgba(255, 136, 0, 0.5)',
        icon: '🔥'
    },
    rat: {
        id: 'rat',
        name: 'RAT ARMY',
        color: '#aa44ff',
        colorRgb: '170, 68, 255',
        glow: 'rgba(170, 68, 255, 0.5)',
        icon: '🐀'
    }
};
