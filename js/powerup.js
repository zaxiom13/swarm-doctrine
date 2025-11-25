// Powerup System - Balanced powerups that enhance gameplay
import { Vector } from './vector.js';
import { CONFIG, TEAMS } from './config.js';

export const POWERUP_TYPES = {
    speed: {
        name: 'VELOCITY SURGE',
        color: '#00ff88',
        colorRgb: '0, 255, 136',
        icon: '⚡',
        duration: 5,
        description: 'Boost your fleet speed'
    },
    shield: {
        name: 'CONVERSION SHIELD',
        color: '#4488ff',
        colorRgb: '68, 136, 255',
        icon: '🛡️',
        duration: 4,
        description: 'Protect from conversion'
    },
    magnet: {
        name: 'RALLY BEACON',
        color: '#ffaa00',
        colorRgb: '255, 170, 0',
        icon: '🧲',
        duration: 3,
        description: 'Pull your boids together'
    },
    convert: {
        name: 'PROPAGANDA WAVE',
        color: '#ff44ff',
        colorRgb: '255, 68, 255',
        icon: '📢',
        duration: 0, // Instant
        description: 'Instant conversion burst'
    },
    clone: {
        name: 'CLONE BURST',
        color: '#00ffff',
        colorRgb: '0, 255, 255',
        icon: '🧬',
        duration: 0, // Instant
        description: 'Spawn copies of your boids'
    },
    emp: {
        name: 'EMP BLAST',
        color: '#ffff00',
        colorRgb: '255, 255, 0',
        icon: '💥',
        duration: 3,
        description: 'Freeze enemy boids'
    }
};

export class Powerup {
    constructor(x, y, type) {
        this.pos = new Vector(x, y);
        this.type = type;
        this.data = POWERUP_TYPES[type];
        this.radius = 20;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.spawnTime = Date.now();
        this.lifetime = 10000; // 10 seconds before despawn
        this.collected = false;
        this.collectAnimation = 0;
    }
    
    update() {
        this.pulsePhase += 0.08;
        
        // Check if expired
        if (Date.now() - this.spawnTime > this.lifetime) {
            return false; // Remove
        }
        return !this.collected || this.collectAnimation < 1;
    }
    
    checkCollection(boids, playerTeam) {
        if (this.collected) return null;
        
        for (const boid of boids) {
            const d = this.pos.dist(boid.pos);
            if (d < this.radius + CONFIG.boidSize) {
                this.collected = true;
                this.collectedByTeam = boid.team;
                return this.type;
            }
        }
        return null;
    }
    
    draw(ctx) {
        const pulse = Math.sin(this.pulsePhase) * 0.3 + 1;
        const fadeIn = Math.min(1, (Date.now() - this.spawnTime) / 500);
        const fadeOut = Math.max(0, 1 - (Date.now() - this.spawnTime - this.lifetime + 2000) / 2000);
        const alpha = fadeIn * fadeOut;
        
        if (this.collected) {
            // Collection animation
            this.collectAnimation += 0.1;
            const scale = 1 + this.collectAnimation * 3;
            const collectAlpha = 1 - this.collectAnimation;
            
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.radius * scale, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.data.colorRgb}, ${collectAlpha * 0.5})`;
            ctx.fill();
            return;
        }
        
        // Outer glow
        const gradient = ctx.createRadialGradient(
            this.pos.x, this.pos.y, 0,
            this.pos.x, this.pos.y, this.radius * 2 * pulse
        );
        gradient.addColorStop(0, `rgba(${this.data.colorRgb}, ${0.4 * alpha})`);
        gradient.addColorStop(0.5, `rgba(${this.data.colorRgb}, ${0.2 * alpha})`);
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius * 2 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Inner circle
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.data.colorRgb}, ${0.3 * alpha})`;
        ctx.strokeStyle = `rgba(${this.data.colorRgb}, ${0.8 * alpha})`;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        
        // Icon
        ctx.font = `${this.radius}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillText(this.data.icon, this.pos.x, this.pos.y);
        
        // Rotating particles
        for (let i = 0; i < 4; i++) {
            const angle = this.pulsePhase * 2 + (i * Math.PI / 2);
            const dist = this.radius * 1.5;
            const px = this.pos.x + Math.cos(angle) * dist;
            const py = this.pos.y + Math.sin(angle) * dist;
            
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.data.colorRgb}, ${0.6 * alpha})`;
            ctx.fill();
        }
    }
}

export class PowerupManager {
    constructor(game) {
        this.game = game;
        this.powerups = [];
        this.activeEffects = {}; // { type: endTime }
        this.spawnTimer = 0;
        this.spawnInterval = 8; // Seconds between spawns
        this.maxPowerups = 3;
    }
    
    reset() {
        this.powerups = [];
        this.activeEffects = {};
        this.teamEffects = {};
        this.spawnTimer = 5; // First spawn after 5 seconds
    }
    
    update(deltaTime, boids, playerTeam) {
        // Spawn new powerups
        this.spawnTimer -= deltaTime;
        if (this.spawnTimer <= 0 && this.powerups.length < this.maxPowerups) {
            this.spawnPowerup();
            this.spawnTimer = this.spawnInterval + Math.random() * 4;
        }
        
        // Update powerups and check collection
        this.powerups = this.powerups.filter(powerup => {
            const alive = powerup.update();
            
            const collected = powerup.checkCollection(boids, playerTeam);
            if (collected) {
                const collectingTeam = powerup.collectedByTeam;
                this.activatePowerup(collected, boids, collectingTeam);
                // Only play sound if player team collected
                if (collectingTeam === playerTeam) {
                    this.game.audio.playPowerup();
                }
            }
            
            return alive;
        });
        
        // Update active effects
        const now = Date.now();
        for (const [type, endTime] of Object.entries(this.activeEffects)) {
            if (now > endTime) {
                delete this.activeEffects[type];
            }
        }
    }
    
    spawnPowerup() {
        const types = Object.keys(POWERUP_TYPES);
        const type = types[Math.floor(Math.random() * types.length)];
        
        // Spawn away from edges
        const margin = 100;
        const x = margin + Math.random() * (this.game.canvas.width - margin * 2);
        const y = margin + Math.random() * (this.game.canvas.height - margin * 2);
        
        this.powerups.push(new Powerup(x, y, type));
    }
    
    activatePowerup(type, boids, collectingTeam) {
        const data = POWERUP_TYPES[type];
        const playerTeam = this.game.playerTeam;
        const isPlayerTeam = collectingTeam === playerTeam;
        
        // Store effects per team
        if (!this.teamEffects) this.teamEffects = {};
        if (!this.teamEffects[collectingTeam]) this.teamEffects[collectingTeam] = {};
        
        switch (type) {
            case 'speed':
                this.teamEffects[collectingTeam].speed = Date.now() + data.duration * 1000;
                // Also set player activeEffects if player team for UI
                if (isPlayerTeam) {
                    this.activeEffects.speed = Date.now() + data.duration * 1000;
                }
                break;
                
            case 'shield':
                this.teamEffects[collectingTeam].shield = Date.now() + data.duration * 1000;
                // Reset conversion pressure for collecting team's boids
                for (const boid of boids) {
                    if (boid.team === collectingTeam) {
                        boid.conversionPressure = 0;
                    }
                }
                if (isPlayerTeam) {
                    this.activeEffects.shield = Date.now() + data.duration * 1000;
                }
                break;
                
            case 'magnet':
                this.teamEffects[collectingTeam].magnet = Date.now() + data.duration * 1000;
                if (isPlayerTeam) {
                    this.activeEffects.magnet = Date.now() + data.duration * 1000;
                }
                break;
                
            case 'convert':
                // Instant effect: convert nearby enemy boids to the collecting team
                // Find center of collecting team's swarm
                let centerX = 0, centerY = 0, count = 0;
                for (const boid of boids) {
                    if (boid.team === collectingTeam) {
                        centerX += boid.pos.x;
                        centerY += boid.pos.y;
                        count++;
                    }
                }
                if (count > 0) {
                    centerX /= count;
                    centerY /= count;
                    let converted = 0;
                    for (const boid of boids) {
                        if (boid.team !== collectingTeam && converted < 5) {
                            const dx = boid.pos.x - centerX;
                            const dy = boid.pos.y - centerY;
                            const d = Math.sqrt(dx * dx + dy * dy);
                            if (d < 150) {
                                boid.convert(collectingTeam);
                                converted++;
                            }
                        }
                    }
                }
                break;
                
            case 'clone':
                // Instant effect: spawn copies of collecting team's boids
                const cloneCount = Math.min(8, Math.floor(this.game.teamCounts[collectingTeam] * 0.2) + 3);
                const teamBoids = boids.filter(b => b.team === collectingTeam);
                if (teamBoids.length > 0) {
                    for (let i = 0; i < cloneCount; i++) {
                        const sourceBoid = teamBoids[Math.floor(Math.random() * teamBoids.length)];
                        const offsetX = (Math.random() - 0.5) * 40;
                        const offsetY = (Math.random() - 0.5) * 40;
                        // Use game's addBoid method if available, otherwise push directly
                        if (this.game.addBoid) {
                            this.game.addBoid(sourceBoid.pos.x + offsetX, sourceBoid.pos.y + offsetY, collectingTeam);
                        } else {
                            const { Boid } = require('./boid.js');
                            const newBoid = new (boids[0].constructor)(sourceBoid.pos.x + offsetX, sourceBoid.pos.y + offsetY, collectingTeam);
                            newBoid.vel.x = sourceBoid.vel.x + (Math.random() - 0.5);
                            newBoid.vel.y = sourceBoid.vel.y + (Math.random() - 0.5);
                            boids.push(newBoid);
                        }
                    }
                    // Spawn particles at clone locations
                    if (this.game.spawnConversionParticles) {
                        const teamData = this.game.constructor.TEAMS ? this.game.constructor.TEAMS[collectingTeam] : null;
                        const colorRgb = teamData ? teamData.colorRgb : '0, 255, 255';
                        for (const sourceBoid of teamBoids.slice(0, cloneCount)) {
                            this.game.spawnConversionParticles(sourceBoid.pos.x, sourceBoid.pos.y, colorRgb);
                        }
                    }
                }
                break;
                
            case 'emp':
                // Freeze all enemy boids for duration
                this.teamEffects[collectingTeam].emp = Date.now() + data.duration * 1000;
                this.empSource = collectingTeam; // Track who triggered EMP
                if (isPlayerTeam) {
                    this.activeEffects.emp = Date.now() + data.duration * 1000;
                }
                // Visual feedback - set frozen state on enemy boids
                for (const boid of boids) {
                    if (boid.team !== collectingTeam) {
                        boid.frozen = true;
                        boid.frozenUntil = Date.now() + data.duration * 1000;
                    }
                }
                break;
        }
    }
    
    hasEffect(type) {
        return this.activeEffects[type] && Date.now() < this.activeEffects[type];
    }
    
    getEffectTimeRemaining(type) {
        if (!this.activeEffects[type]) return 0;
        return Math.max(0, (this.activeEffects[type] - Date.now()) / 1000);
    }
    
    getSpeedMultiplier(team = null) {
        if (team && this.teamEffects && this.teamEffects[team]) {
            return this.teamEffects[team].speed && Date.now() < this.teamEffects[team].speed ? 1.4 : 1;
        }
        return this.hasEffect('speed') ? 1.4 : 1;
    }
    
    isShielded(team = null) {
        if (team && this.teamEffects && this.teamEffects[team]) {
            return this.teamEffects[team].shield && Date.now() < this.teamEffects[team].shield;
        }
        return this.hasEffect('shield');
    }
    
    getMagnetForce(boid, team) {
        // Check if this boid's team has magnet active
        const hasMagnet = (this.teamEffects && this.teamEffects[boid.team] && 
            this.teamEffects[boid.team].magnet && Date.now() < this.teamEffects[boid.team].magnet);
        
        if (!hasMagnet) {
            return new Vector(0, 0);
        }
        
        // Pull towards center of boid's team swarm
        const center = this.getTeamCenter(boid.team);
        if (!center) return new Vector(0, 0);
        
        let desired = center.sub(boid.pos);
        desired = desired.normalize().mult(CONFIG.maxSpeed * 0.5);
        let steer = desired.sub(boid.vel);
        return steer.limit(CONFIG.maxForce * 2);
    }
    
    getTeamCenter(team) {
        let sum = new Vector(0, 0);
        let count = 0;
        
        for (const boid of this.game.boids) {
            if (boid.team === team) {
                sum = sum.add(boid.pos);
                count++;
            }
        }
        
        if (count === 0) return null;
        return sum.div(count);
    }
    
    draw(ctx) {
        for (const powerup of this.powerups) {
            powerup.draw(ctx);
        }
    }
    
    getActiveEffects() {
        const effects = [];
        for (const [type, endTime] of Object.entries(this.activeEffects)) {
            if (Date.now() < endTime) {
                effects.push({
                    type,
                    data: POWERUP_TYPES[type],
                    remaining: (endTime - Date.now()) / 1000
                });
            }
        }
        return effects;
    }
}
