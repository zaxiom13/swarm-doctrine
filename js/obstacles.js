// Obstacle System - Environmental hazards for Survival Mode
import { Vector } from './vector.js';
import { CONFIG } from './config.js';

export const OBSTACLE_TYPES = {
    blackHole: {
        name: 'BLACK HOLE',
        color: '#220033',
        colorRgb: '34, 0, 51',
        glowColor: '#8800ff',
        baseRadius: 15,
        minRadius: 15,
        maxRadius: 50,
        radiusPerBoid: 0.15, // How much radius increases per boid
        pullRadiusMultiplier: 2.8, // pullRadius = radius * this
        pullStrength: 0.4,
        destroyRadiusMultiplier: 0.4, // destroyRadius = radius * this
        baseLifetime: 5,
        minLifetime: 5,
        maxLifetime: 15,
        lifetimePerBoid: 0.05, // How much lifetime increases per boid
        description: 'Pulls boids in and destroys them'
    },
    slowZone: {
        name: 'NEBULA',
        color: '#003366',
        colorRgb: '0, 51, 102',
        glowColor: '#0066cc',
        radius: 100,
        slowFactor: 0.4,
        description: 'Slows boids passing through'
    },
    asteroid: {
        name: 'ASTEROID FIELD',
        color: '#444444',
        colorRgb: '68, 68, 68',
        glowColor: '#666666',
        radius: 80,
        scatterStrength: 0.5,
        description: 'Scatters boids that enter'
    }
};

export class Obstacle {
    constructor(x, y, type, totalBoids = 0) {
        this.pos = new Vector(x, y);
        this.type = type;
        this.data = OBSTACLE_TYPES[type];
        this.radius = this.data.radius || this.data.baseRadius || 25;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.rotationAngle = 0;
        this.particles = []; // For visual effects
        this.expired = false;
        
        // Dynamic sizing and lifetime for black holes
        if (this.type === 'blackHole') {
            const d = this.data;
            // Calculate initial radius based on boid count
            this.radius = Math.min(d.maxRadius, Math.max(d.minRadius, d.baseRadius + totalBoids * d.radiusPerBoid));
            this.pullRadius = d.pullRadiusMultiplier * this.radius;
            this.destroyRadius = d.destroyRadiusMultiplier * this.radius;
            // Calculate lifetime based on boid count
            this.lifetime = Math.min(d.maxLifetime, Math.max(d.minLifetime, d.baseLifetime + totalBoids * d.lifetimePerBoid));
        } else {
            this.lifetime = this.data.lifetime || null; // null = permanent
        }
    }
    
    update(deltaTime, totalBoids = 0) {
        this.pulsePhase += deltaTime * 2;
        this.rotationAngle += deltaTime * (this.type === 'blackHole' ? 2 : 0.5);
        
        // Update lifetime
        if (this.lifetime !== null) {
            this.lifetime -= deltaTime;
            if (this.lifetime <= 0) {
                this.expired = true;
            }
        }
        
        // Dynamic sizing for black holes based on total boids
        if (this.type === 'blackHole') {
            const d = this.data;
            const targetRadius = Math.min(
                d.maxRadius,
                Math.max(d.minRadius, d.baseRadius + totalBoids * d.radiusPerBoid)
            );
            // Smooth transition to target radius
            this.radius += (targetRadius - this.radius) * deltaTime * 2;
            this.pullRadius = d.pullRadiusMultiplier * this.radius;
            this.destroyRadius = d.destroyRadiusMultiplier * this.radius;
        }
        
        // Update particles
        this.particles = this.particles.filter(p => {
            p.life -= deltaTime;
            p.angle += p.speed * deltaTime;
            return p.life > 0;
        });
        
        // Spawn new particles for black holes
        if (this.type === 'blackHole' && Math.random() < 0.3) {
            this.particles.push({
                angle: Math.random() * Math.PI * 2,
                dist: this.pullRadius * (0.3 + Math.random() * 0.7),
                speed: 2 + Math.random() * 2,
                life: 1 + Math.random(),
                size: 2 + Math.random() * 3
            });
        }
    }
    
    // Apply effects to a boid, returns true if boid should be destroyed
    affectBoid(boid) {
        const dx = boid.pos.x - this.pos.x;
        const dy = boid.pos.y - this.pos.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        
        switch (this.type) {
            case 'blackHole':
                // Check if within pull radius (use dynamic pullRadius)
                if (dist < this.pullRadius) {
                    // Pull towards center
                    const pullForce = this.data.pullStrength * (1 - dist / this.pullRadius);
                    const fx = -dx / dist * pullForce;
                    const fy = -dy / dist * pullForce;
                    boid.applyForce(new Vector(fx, fy));
                    
                    // Destroy if too close (use dynamic destroyRadius)
                    if (dist < this.destroyRadius) {
                        return true; // Destroy boid
                    }
                }
                break;
                
            case 'slowZone':
                // Check if inside zone
                if (dist < this.radius) {
                    boid.slowMultiplier = this.data.slowFactor;
                } else if (boid.slowMultiplier < 1) {
                    // Gradually restore speed when leaving
                    boid.slowMultiplier = Math.min(1, boid.slowMultiplier + 0.05);
                }
                break;
                
            case 'asteroid':
                // Scatter boids that enter
                if (dist < this.radius) {
                    const scatterForce = this.data.scatterStrength;
                    const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
                    const fx = Math.cos(angle) * scatterForce;
                    const fy = Math.sin(angle) * scatterForce;
                    boid.applyForce(new Vector(fx, fy));
                }
                break;
        }
        
        return false; // Don't destroy
    }
    
    draw(ctx) {
        const pulse = Math.sin(this.pulsePhase) * 0.15 + 1;
        
        switch (this.type) {
            case 'blackHole':
                this.drawBlackHole(ctx, pulse);
                break;
            case 'slowZone':
                this.drawSlowZone(ctx, pulse);
                break;
            case 'asteroid':
                this.drawAsteroid(ctx, pulse);
                break;
        }
    }
    
    drawBlackHole(ctx, pulse) {
        // Draw pull radius indicator (use dynamic radii)
        const gradient = ctx.createRadialGradient(
            this.pos.x, this.pos.y, this.destroyRadius,
            this.pos.x, this.pos.y, this.pullRadius
        );
        gradient.addColorStop(0, 'rgba(136, 0, 255, 0.3)');
        gradient.addColorStop(0.5, 'rgba(136, 0, 255, 0.1)');
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.pullRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Draw swirling particles
        for (const p of this.particles) {
            const px = this.pos.x + Math.cos(p.angle) * p.dist;
            const py = this.pos.y + Math.sin(p.angle) * p.dist;
            const alpha = p.life * 0.5;
            
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(136, 0, 255, ${alpha})`;
            ctx.fill();
        }
        
        // Draw event horizon
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = this.data.color;
        ctx.fill();
        
        // Inner glow
        const innerGradient = ctx.createRadialGradient(
            this.pos.x, this.pos.y, 0,
            this.pos.x, this.pos.y, this.radius * pulse
        );
        innerGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        innerGradient.addColorStop(0.7, 'rgba(34, 0, 51, 0.8)');
        innerGradient.addColorStop(1, 'rgba(136, 0, 255, 0.3)');
        
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = innerGradient;
        ctx.fill();
        
        // Accretion disk
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.rotationAngle);
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius * 1.5 * pulse, this.radius * 0.3 * pulse, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(136, 0, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }
    
    drawSlowZone(ctx, pulse) {
        // Nebula effect - multiple overlapping circles
        const gradient = ctx.createRadialGradient(
            this.pos.x, this.pos.y, 0,
            this.pos.x, this.pos.y, this.radius * pulse
        );
        gradient.addColorStop(0, 'rgba(0, 102, 204, 0.3)');
        gradient.addColorStop(0.5, 'rgba(0, 51, 102, 0.2)');
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Inner swirls
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.rotationAngle * 0.3);
        
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 + this.pulsePhase * 0.5;
            const dist = this.radius * 0.4;
            const cx = Math.cos(angle) * dist;
            const cy = Math.sin(angle) * dist;
            
            const swirlGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.radius * 0.4);
            swirlGradient.addColorStop(0, 'rgba(0, 150, 255, 0.2)');
            swirlGradient.addColorStop(1, 'transparent');
            
            ctx.beginPath();
            ctx.arc(cx, cy, this.radius * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = swirlGradient;
            ctx.fill();
        }
        
        ctx.restore();
        
        // Border
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 102, 204, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Label
        ctx.font = "10px 'Rajdhani', sans-serif";
        ctx.fillStyle = 'rgba(0, 150, 255, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('SLOW ZONE', this.pos.x, this.pos.y - this.radius - 10);
    }
    
    drawAsteroid(ctx, pulse) {
        // Draw scattered rocks
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.rotationAngle * 0.2);
        
        // Background dust
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        gradient.addColorStop(0, 'rgba(100, 100, 100, 0.15)');
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Draw asteroids
        const asteroidCount = 12;
        for (let i = 0; i < asteroidCount; i++) {
            const angle = (i / asteroidCount) * Math.PI * 2 + this.pulsePhase * 0.1;
            const dist = this.radius * (0.2 + (i % 3) * 0.25);
            const size = 5 + (i % 4) * 3;
            const ax = Math.cos(angle) * dist;
            const ay = Math.sin(angle) * dist;
            
            ctx.beginPath();
            // Irregular shape
            ctx.moveTo(ax + size, ay);
            for (let j = 1; j < 6; j++) {
                const a = (j / 6) * Math.PI * 2;
                const r = size * (0.7 + Math.sin(i * 3 + j) * 0.3);
                ctx.lineTo(ax + Math.cos(a) * r, ay + Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fillStyle = `rgba(${80 + i * 10}, ${80 + i * 8}, ${80 + i * 6}, 0.8)`;
            ctx.fill();
            ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Danger border
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

export class ObstacleManager {
    constructor(game) {
        this.game = game;
        this.obstacles = [];
    }
    
    reset() {
        this.obstacles = [];
    }
    
    // Spawn initial obstacles for conquest mode
    spawnForConquest() {
        const width = this.game.canvas.width;
        const height = this.game.canvas.height;
        const margin = 150;
        
        // Spawn 2-3 obstacles initially
        const obstacleCount = 2 + Math.floor(Math.random() * 2);
        const types = Object.keys(OBSTACLE_TYPES);
        
        for (let i = 0; i < obstacleCount; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            
            let x, y, valid;
            let attempts = 0;
            do {
                x = margin + Math.random() * (width - margin * 2);
                y = margin + Math.random() * (height - margin * 2);
                
                // Check distance from corners (team spawn areas)
                const corners = [
                    { x: width * 0.15, y: height * 0.15 },
                    { x: width * 0.85, y: height * 0.15 },
                    { x: width * 0.15, y: height * 0.85 },
                    { x: width * 0.85, y: height * 0.85 }
                ];
                valid = true;
                for (const corner of corners) {
                    const dist = Math.sqrt((x - corner.x)**2 + (y - corner.y)**2);
                    if (dist < 150) {
                        valid = false;
                        break;
                    }
                }
                
                // Check distance from other obstacles
                if (valid) {
                    for (const obs of this.obstacles) {
                        const dist = Math.sqrt((x - obs.pos.x)**2 + (y - obs.pos.y)**2);
                        if (dist < obs.radius + OBSTACLE_TYPES[type].radius + 50) {
                            valid = false;
                            break;
                        }
                    }
                }
                
                attempts++;
            } while (!valid && attempts < 20);
            
            if (valid) {
                const totalBoids = this.game.boids ? this.game.boids.length : 0;
                this.obstacles.push(new Obstacle(x, y, type, totalBoids));
            }
        }
    }
    
    // Refresh obstacles periodically in conquest mode
    refreshForConquest() {
        // Remove 1-2 random obstacles
        if (this.obstacles.length > 0) {
            const removeCount = Math.min(1 + Math.floor(Math.random() * 2), this.obstacles.length);
            this.removeRandomObstacles(removeCount);
        }
        
        // Add 1-2 new obstacles if under cap
        const maxObstacles = 4;
        if (this.obstacles.length < maxObstacles) {
            const addCount = Math.min(1 + Math.floor(Math.random() * 2), maxObstacles - this.obstacles.length);
            const width = this.game.canvas.width;
            const height = this.game.canvas.height;
            const margin = 150;
            const types = Object.keys(OBSTACLE_TYPES);
            
            for (let i = 0; i < addCount; i++) {
                const type = types[Math.floor(Math.random() * types.length)];
                
                let x, y, valid;
                let attempts = 0;
                do {
                    x = margin + Math.random() * (width - margin * 2);
                    y = margin + Math.random() * (height - margin * 2);
                    valid = true;
                    
                    // Check distance from other obstacles
                    for (const obs of this.obstacles) {
                        const dist = Math.sqrt((x - obs.pos.x)**2 + (y - obs.pos.y)**2);
                        if (dist < obs.radius + OBSTACLE_TYPES[type].radius + 50) {
                            valid = false;
                            break;
                        }
                    }
                    
                    attempts++;
                } while (!valid && attempts < 15);
                
                if (valid) {
                    const totalBoids = this.game.boids ? this.game.boids.length : 0;
                    this.obstacles.push(new Obstacle(x, y, type, totalBoids));
                }
            }
        }
    }
    
    // Remove some obstacles at the start of a new wave
    removeRandomObstacles(count) {
        const toRemove = Math.min(count, this.obstacles.length);
        for (let i = 0; i < toRemove; i++) {
            const idx = Math.floor(Math.random() * this.obstacles.length);
            this.obstacles.splice(idx, 1);
        }
    }
    
    // Spawn obstacles for survival mode
    spawnForSurvival(wave) {
        const width = this.game.canvas.width;
        const height = this.game.canvas.height;
        const margin = 150;
        
        // Remove some existing obstacles each wave (keeps the field fresh)
        if (this.obstacles.length > 0) {
            const removeCount = Math.max(1, Math.floor(this.obstacles.length * 0.4));
            this.removeRandomObstacles(removeCount);
        }
        
        // More obstacles as waves progress, but cap total
        const maxObstacles = 6;
        const currentCount = this.obstacles.length;
        const targetNew = Math.min(1 + Math.floor(wave / 3), 3);
        const obstacleCount = Math.min(targetNew, maxObstacles - currentCount);
        
        for (let i = 0; i < obstacleCount; i++) {
            // Pick random type, weighted towards slow zones early
            const types = Object.keys(OBSTACLE_TYPES);
            let type;
            if (wave < 3) {
                type = Math.random() < 0.7 ? 'slowZone' : 'asteroid';
            } else if (wave < 6) {
                type = types[Math.floor(Math.random() * types.length)];
            } else {
                // More black holes later
                type = Math.random() < 0.4 ? 'blackHole' : types[Math.floor(Math.random() * types.length)];
            }
            
            // Find position away from center and other obstacles
            let x, y, valid;
            let attempts = 0;
            do {
                x = margin + Math.random() * (width - margin * 2);
                y = margin + Math.random() * (height - margin * 2);
                
                // Check distance from center
                const centerDist = Math.sqrt((x - width/2)**2 + (y - height/2)**2);
                valid = centerDist > 200;
                
                // Check distance from other obstacles
                for (const obs of this.obstacles) {
                    const dist = Math.sqrt((x - obs.pos.x)**2 + (y - obs.pos.y)**2);
                    if (dist < obs.radius + OBSTACLE_TYPES[type].radius + 50) {
                        valid = false;
                        break;
                    }
                }
                
                attempts++;
            } while (!valid && attempts < 20);
            
            if (valid) {
                const totalBoids = this.game.boids ? this.game.boids.length : 0;
                this.obstacles.push(new Obstacle(x, y, type, totalBoids));
            }
        }
    }
    
    update(deltaTime, boids) {
        const totalBoids = boids.length;
        
        // Update obstacle animations
        for (const obstacle of this.obstacles) {
            obstacle.update(deltaTime, totalBoids);
        }
        
        // Remove expired obstacles
        this.obstacles = this.obstacles.filter(obs => !obs.expired);
        
        // Reset slow multipliers
        for (const boid of boids) {
            if (boid.slowMultiplier < 1) {
                boid.slowMultiplier = Math.min(1, boid.slowMultiplier + deltaTime * 2);
            }
        }
        
        // Apply obstacle effects to boids
        const boidsToRemove = [];
        for (const boid of boids) {
            for (const obstacle of this.obstacles) {
                if (obstacle.affectBoid(boid)) {
                    boidsToRemove.push(boid);
                    break;
                }
            }
        }
        
        return boidsToRemove;
    }
    
    draw(ctx) {
        for (const obstacle of this.obstacles) {
            obstacle.draw(ctx);
        }
    }
}
