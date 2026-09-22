// Terrain hazards as pure data plus their effect on ships. Drawing lives in the renderer.
export const TERRAIN_TYPES = {
    blackHole: { label: 'Black hole · keep clear', radius: 25, pullMultiplier: 2.8, coreMultiplier: 0.4, pullStrength: 0.4 },
    slowZone: { label: 'Nebula · slow', radius: 100, slowFactor: 0.4 },
    asteroid: { label: 'Asteroids · scatter', radius: 80, scatterStrength: 0.5 },
};

export class TerrainField {
    constructor({ type, x, y, radius, id = null }) {
        const kind = TERRAIN_TYPES[type];
        if (!kind) throw new Error(`Unknown terrain type: ${type}`);
        this.type = type;
        this.id = id;
        this.x = x;
        this.y = y;
        this.setRadius(radius ?? kind.radius);
    }

    setRadius(radius) {
        this.radius = radius;
        const kind = TERRAIN_TYPES[this.type];
        // Only black holes reach beyond their visible radius; others act within it.
        this.reach = this.type === 'blackHole' ? radius * kind.pullMultiplier : radius;
        this.core = this.type === 'blackHole' ? radius * kind.coreMultiplier : 0;
    }

    /** Applies this field to a ship. Returns true when the ship is destroyed. */
    affect(boid, random = Math.random) {
        const dx = boid.pos.x - this.x, dy = boid.pos.y - this.y;
        const distSq = dx * dx + dy * dy;
        if (distSq >= this.reach * this.reach) return false;
        const dist = Math.sqrt(distSq);
        const kind = TERRAIN_TYPES[this.type];
        if (this.type === 'blackHole') {
            if (dist < this.core) return true;
            const pull = kind.pullStrength * (1 - dist / this.reach) / dist;
            boid.acc.x -= dx * pull;
            boid.acc.y -= dy * pull;
        } else if (this.type === 'slowZone') {
            boid.slowMultiplier = kind.slowFactor;
        } else {
            const angle = Math.atan2(dy, dx) + (random() - 0.5) * 0.5;
            boid.acc.x += Math.cos(angle) * kind.scatterStrength;
            boid.acc.y += Math.sin(angle) * kind.scatterStrength;
        }
        return false;
    }

    toJSON() { return { type: this.type, x: this.x, y: this.y, radius: this.radius, id: this.id }; }
}
