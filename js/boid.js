// Boid Class - Individual unit with flocking behavior
import { Vector } from './vector.js';
import { CONFIG, TEAMS } from './config.js';

export class Boid {
    constructor(x, y, team) {
        this.pos = new Vector(x, y);
        this.vel = Vector.random().mult(CONFIG.maxSpeed * 0.5);
        this.acc = new Vector();
        this.team = team; // 'player' or 'enemy'
        this.conversionPressure = 0;
        this.conversionCooldown = 0;
        this.justConverted = false;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.frozen = false;
        this.frozenUntil = 0;
        this.slowMultiplier = 1; // For obstacle slow zones
    }
    
    applyForce(force) {
        this.acc = this.acc.add(force);
    }
    
    // Separation: steer to avoid crowding local flockmates (optimized)
    separate(neighbors) {
        let steerX = 0, steerY = 0;
        let count = 0;
        const sepRadiusSq = CONFIG.separationRadius * CONFIG.separationRadius;
        
        for (const other of neighbors) {
            const dx = this.pos.x - other.pos.x;
            const dy = this.pos.y - other.pos.y;
            const dSq = dx * dx + dy * dy;
            if (dSq > 0 && dSq < sepRadiusSq) {
                const d = Math.sqrt(dSq);
                steerX += dx / (d * d);
                steerY += dy / (d * d);
                count++;
            }
        }
        
        if (count > 0) {
            steerX /= count;
            steerY /= count;
            const mag = Math.sqrt(steerX * steerX + steerY * steerY);
            if (mag > 0) {
                steerX = steerX / mag * CONFIG.maxSpeed - this.vel.x;
                steerY = steerY / mag * CONFIG.maxSpeed - this.vel.y;
                // Limit
                const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
                if (steerMag > CONFIG.maxForce) {
                    steerX = steerX / steerMag * CONFIG.maxForce;
                    steerY = steerY / steerMag * CONFIG.maxForce;
                }
            }
        }
        
        return new Vector(steerX, steerY);
    }
    
    // Alignment: steer towards average heading of local flockmates (same team) - optimized
    align(neighbors) {
        let sumX = 0, sumY = 0;
        let count = 0;
        
        for (const other of neighbors) {
            if (other !== this && other.team === this.team) {
                sumX += other.vel.x;
                sumY += other.vel.y;
                count++;
            }
        }
        
        if (count > 0) {
            sumX /= count;
            sumY /= count;
            const mag = Math.sqrt(sumX * sumX + sumY * sumY);
            if (mag > 0) {
                sumX = sumX / mag * CONFIG.maxSpeed;
                sumY = sumY / mag * CONFIG.maxSpeed;
            }
            let steerX = sumX - this.vel.x;
            let steerY = sumY - this.vel.y;
            const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
            if (steerMag > CONFIG.maxForce) {
                steerX = steerX / steerMag * CONFIG.maxForce;
                steerY = steerY / steerMag * CONFIG.maxForce;
            }
            return new Vector(steerX, steerY);
        }
        
        return new Vector();
    }
    
    // Cohesion: steer towards average position of local flockmates (same team) - optimized
    cohere(neighbors) {
        let sumX = 0, sumY = 0;
        let count = 0;
        
        for (const other of neighbors) {
            if (other !== this && other.team === this.team) {
                sumX += other.pos.x;
                sumY += other.pos.y;
                count++;
            }
        }
        
        if (count > 0) {
            sumX /= count;
            sumY /= count;
            return this.seekXY(sumX, sumY);
        }
        
        return new Vector();
    }
    
    seek(target) {
        return this.seekXY(target.x, target.y);
    }
    
    seekXY(tx, ty) {
        let dx = tx - this.pos.x;
        let dy = ty - this.pos.y;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag > 0) {
            dx = dx / mag * CONFIG.maxSpeed;
            dy = dy / mag * CONFIG.maxSpeed;
        }
        let steerX = dx - this.vel.x;
        let steerY = dy - this.vel.y;
        const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
        if (steerMag > CONFIG.maxForce) {
            steerX = steerX / steerMag * CONFIG.maxForce;
            steerY = steerY / steerMag * CONFIG.maxForce;
        }
        return new Vector(steerX, steerY);
    }
    
    // Strong flee from mouse when left mouse is pressed - optimized
    fleeMouse(target) {
        let dx = this.pos.x - target.x;
        let dy = this.pos.y - target.y;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag > 0) {
            const speed = CONFIG.maxSpeed * 1.5;
            dx = dx / mag * speed;
            dy = dy / mag * speed;
        }
        let steerX = dx - this.vel.x;
        let steerY = dy - this.vel.y;
        const maxForce = CONFIG.maxForce * 4;
        const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
        if (steerMag > maxForce) {
            steerX = steerX / steerMag * maxForce;
            steerY = steerY / steerMag * maxForce;
        }
        return new Vector(steerX, steerY);
    }
    
    // Check peer pressure for conversion
    checkConversion(neighbors, difficultyMod) {
        if (this.conversionCooldown > 0) {
            this.conversionCooldown--;
            return false;
        }
        
        let sameTeam = 0;
        let otherTeam = 0;
        
        for (const other of neighbors) {
            if (other !== this) {
                if (other.team === this.team) {
                    sameTeam++;
                } else {
                    otherTeam++;
                }
            }
        }
        
        const threshold = CONFIG.conversionThreshold;
        const resistMod = this.team === 'enemy' ? difficultyMod.conversionResist : 1;
        
        if (otherTeam >= threshold && otherTeam > sameTeam * resistMod) {
            this.conversionPressure += 1;
            
            if (this.conversionPressure >= CONFIG.peerPressureTime) {
                return true;
            }
        } else {
            this.conversionPressure = Math.max(0, this.conversionPressure - 2);
        }
        
        return false;
    }
    
    convert(newTeam) {
        this.team = newTeam;
        this.conversionPressure = 0;
        this.conversionCooldown = CONFIG.conversionCooldown;
        this.justConverted = true;
    }
    
    // Flocking behavior - now accepts pre-queried neighbors (optimized)
    flock(neighbors, difficultyMod, isEnemy) {
        const sep = this.separate(neighbors);
        const ali = this.align(neighbors);
        const coh = this.cohere(neighbors);
        
        // Apply weights directly to acceleration to avoid creating new vectors
        const cohMult = isEnemy ? CONFIG.cohesionWeight * difficultyMod.enemyCohesion : CONFIG.cohesionWeight;
        
        this.acc.x += sep.x * CONFIG.separationWeight + ali.x * CONFIG.alignmentWeight + coh.x * cohMult;
        this.acc.y += sep.y * CONFIG.separationWeight + ali.y * CONFIG.alignmentWeight + coh.y * cohMult;
    }
    
    update(width, height, difficultyMod, powerupSpeedMult = 1) {
        // Check if frozen
        if (this.frozen && Date.now() < this.frozenUntil) {
            // Still frozen - don't move, just reset acceleration
            this.acc.x = 0;
            this.acc.y = 0;
            this.pulsePhase += 0.1;
            return;
        } else if (this.frozen) {
            this.frozen = false;
        }
        
        const maxSpeed = CONFIG.maxSpeed * powerupSpeedMult * this.slowMultiplier;
        
        // Mutable operations to avoid allocations
        this.vel.x += this.acc.x;
        this.vel.y += this.acc.y;
        
        // Limit velocity
        const velMagSq = this.vel.x * this.vel.x + this.vel.y * this.vel.y;
        if (velMagSq > maxSpeed * maxSpeed) {
            const velMag = Math.sqrt(velMagSq);
            this.vel.x = this.vel.x / velMag * maxSpeed;
            this.vel.y = this.vel.y / velMag * maxSpeed;
        }
        
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
        
        // Reset acceleration
        this.acc.x = 0;
        this.acc.y = 0;
        
        // Wrap around edges
        if (this.pos.x < 0) this.pos.x = width;
        if (this.pos.x > width) this.pos.x = 0;
        if (this.pos.y < 0) this.pos.y = height;
        if (this.pos.y > height) this.pos.y = 0;
        
        this.pulsePhase += 0.1;
        this.justConverted = false;
    }
    
    draw(ctx) {
        const angle = Math.atan2(this.vel.y, this.vel.x);
        const size = CONFIG.boidSize;
        const teamData = TEAMS[this.team];
        const baseColor = teamData ? teamData.color : '#ffffff';
        const colorRgb = teamData ? teamData.colorRgb : '255, 255, 255';
        
        // Draw frozen effect
        if (this.frozen) {
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, size * 1.8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Draw slow effect
        if (this.slowMultiplier < 1) {
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, size * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(128, 0, 255, 0.2)';
            ctx.fill();
        }
        
        // Draw pressure glow only when significant
        if (this.conversionPressure > 10) {
            const pressureRatio = this.conversionPressure / CONFIG.peerPressureTime;
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, size * 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${pressureRatio * 0.4})`;
            ctx.fill();
        }
        
        // Conversion flash
        if (this.justConverted) {
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, size * 3, 0, Math.PI * 2);
            ctx.fillStyle = baseColor;
            ctx.fill();
        }
        
        // Draw boid body (triangle) - no shadow for performance
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(angle);
        
        // Engine glow
        if (!this.frozen) {
            ctx.beginPath();
            // Draw behind the boid
            ctx.fillStyle = `rgba(${colorRgb}, 0.2)`;
            ctx.arc(-size, 0, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner bright core
            ctx.beginPath();
            ctx.fillStyle = `rgba(${colorRgb}, 0.4)`;
            ctx.arc(-size * 0.8, 0, size * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.7, size * 0.5);
        ctx.lineTo(-size * 0.4, 0);
        ctx.lineTo(-size * 0.7, -size * 0.5);
        ctx.closePath();
        
        // Frozen boids are grayed out
        ctx.fillStyle = this.frozen ? '#888888' : baseColor;
        ctx.fill();
        
        ctx.restore();
    }
}
