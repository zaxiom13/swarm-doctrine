// Enhanced Boid Class - Vector combatant with trails, aerodynamic chassis, and tactical behaviors
import { Vector } from './vector.js';
import { CONFIG, TEAMS } from './config.js';

export class Boid {
    constructor(x, y, team) {
        this.pos = new Vector(x, y);
        this.vel = Vector.random().mult(CONFIG.maxSpeed * 0.6);
        this.acc = new Vector();
        this.team = team;
        this.conversionPressure = 0;
        this.conversionCooldown = 0;
        this.justConverted = false;
        this.conversionSource = null; // Position of closest converting enemy for tethers
        this.pulsePhase = Math.random() * Math.PI * 2;

        // Status effects
        this.frozen = false;
        this.freezeRemaining = 0;
        this.slowMultiplier = 1;

        // Visual trail buffer (limited length for performance)
        this.trail = [];
        this.maxTrail = 4;
        this.trailCounter = 0;

        // Slight unique variations for organic movement
        this.agility = 0.9 + Math.random() * 0.2;
        this.size = CONFIG.boidSize * (0.95 + Math.random() * 0.1);
    }

    applyForce(force) {
        this.acc.x += force.x;
        this.acc.y += force.y;
    }

    // Separation: avoid crowding local flockmates (with emergency separation for close quarters)
    separate(neighbors) {
        let steerX = 0, steerY = 0;
        let count = 0;
        const sepRadius = CONFIG.separationRadius;
        const sepRadiusSq = sepRadius * sepRadius;
        let hasVeryClose = false;

        for (let i = 0; i < neighbors.length; i++) {
            const other = neighbors[i];
            const dx = this.pos.x - other.pos.x;
            const dy = this.pos.y - other.pos.y;
            const dSq = dx * dx + dy * dy;
            if (dSq > 0 && dSq < sepRadiusSq) {
                const d = Math.sqrt(dSq);
                // Strong non-linear repulsion for very close neighbors
                const weight = d < 14 ? 3.0 / (d * d) : 1.0 / (d * d);
                if (d < 14) hasVeryClose = true;
                steerX += dx * weight;
                steerY += dy * weight;
                count++;
            }
        }

        if (count > 0) {
            steerX /= count;
            steerY /= count;
            const mag = Math.sqrt(steerX * steerX + steerY * steerY);
            if (mag > 0) {
                steerX = (steerX / mag) * CONFIG.maxSpeed - this.vel.x;
                steerY = (steerY / mag) * CONFIG.maxSpeed - this.vel.y;

                // Allow higher force limit if boids are dangerously close
                const maxF = hasVeryClose ? CONFIG.maxForce * 2.8 : CONFIG.maxForce;
                const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
                if (steerMag > maxF) {
                    steerX = (steerX / steerMag) * maxF;
                    steerY = (steerY / steerMag) * maxF;
                }
            }
        }

        return new Vector(steerX, steerY);
    }

    // Alignment: match heading with every nearby ship, any allegiance
    align(neighbors) {
        let sumX = 0, sumY = 0;
        let count = 0;

        for (let i = 0; i < neighbors.length; i++) {
            const other = neighbors[i];
            if (other !== this) {
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

    // Cohesion: steer toward the center of every nearby ship, any allegiance
    cohere(neighbors) {
        let sumX = 0, sumY = 0;
        let count = 0;

        for (let i = 0; i < neighbors.length; i++) {
            const other = neighbors[i];
            if (other !== this) {
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

    // Direct Tactical Beacon command (Friendly units orbit and maintain perimeter escort around beacon, never collapsing to a point)
    rallyTowardsBeacon(target, forceMult = 1.0) {
        let dx = target.x - this.pos.x;
        let dy = target.y - this.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return new Vector();

        const speed = CONFIG.maxSpeed * 1.25;
        let desiredX = 0;
        let desiredY = 0;

        if (dist > 75) {
            // Far away: sprint towards the beacon
            desiredX = (dx / dist) * speed;
            desiredY = (dy / dist) * speed;
        } else if (dist < 35) {
            // Buffer zone: push gently outward to maintain formation volume and prevent collapsing into a dot
            desiredX = -(dx / dist) * speed * 0.9;
            desiredY = -(dy / dist) * speed * 0.9;
        } else {
            // Escort perimeter (35px - 75px): orbit dynamically around beacon
            const perpX = -dy / dist;
            const perpY = dx / dist;
            const radialFactor = (dist - 55) / 20; // -1 to +1
            desiredX = (perpX * 0.85 + (dx / dist) * radialFactor * 0.35) * speed;
            desiredY = (perpY * 0.85 + (dy / dist) * radialFactor * 0.35) * speed;
        }

        let steerX = desiredX - this.vel.x;
        let steerY = desiredY - this.vel.y;
        const maxF = CONFIG.maxForce * 1.6 * forceMult;
        const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
        if (steerMag > maxF) {
            steerX = (steerX / steerMag) * maxF;
            steerY = (steerY / steerMag) * maxF;
        }
        return new Vector(steerX, steerY);
    }

    // Kinetic Shockwave / Scatter blast
    fleePoint(target, force = 4.0, maxSpeed = 7.0) {
        let dx = this.pos.x - target.x;
        let dy = this.pos.y - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
        } else {
            dx = (dx / dist) * maxSpeed;
            dy = (dy / dist) * maxSpeed;
        }

        let steerX = dx - this.vel.x;
        let steerY = dy - this.vel.y;
        const maxF = CONFIG.maxForce * force;
        const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
        if (steerMag > maxF) {
            steerX = (steerX / steerMag) * maxF;
            steerY = (steerY / steerMag) * maxF;
        }
        return new Vector(steerX, steerY);
    }

    fleeMouse(target) {
        return this.fleePoint(target, 4.0, CONFIG.maxSpeed * 1.6);
    }


    stun(durationSeconds) {
        this.frozen = true;
        this.freezeRemaining = Math.max(this.freezeRemaining, durationSeconds);
        this.vel.x *= 0.1;
        this.vel.y *= 0.1;
    }

    convert(newTeam) {
        this.team = newTeam;
        this.frozen = false;
        this.freezeRemaining = 0;
        this.conversionPressure = 0;
        this.conversionCooldown = CONFIG.conversionCooldown;
        this.justConverted = true;
        this.conversionSource = null;
    }

    flock(neighbors, difficultyMod, isEnemy) {
        const sep = this.separate(neighbors);
        const ali = this.align(neighbors);
        const coh = this.cohere(neighbors);

        const cohMult = isEnemy ? CONFIG.cohesionWeight * difficultyMod.enemyCohesion : CONFIG.cohesionWeight;

        this.acc.x += sep.x * CONFIG.separationWeight + ali.x * CONFIG.alignmentWeight + coh.x * cohMult;
        this.acc.y += sep.y * CONFIG.separationWeight + ali.y * CONFIG.alignmentWeight + coh.y * cohMult;
    }

    update(width, height, difficultyMod, powerupSpeedMult = 1) {
        // Freeze check
        if (this.frozen) {
            if (this.freezeRemaining > 0) {
                this.acc.x = 0;
                this.acc.y = 0;
                this.pulsePhase += 0.05;
                return;
            } else {
                this.frozen = false;
            }
        }

        // Team perk speed
        const teamData = TEAMS[this.team];
        const teamSpeed = teamData ? (teamData.speedMult || 1) : 1;
        const maxSpeed = CONFIG.maxSpeed * powerupSpeedMult * this.slowMultiplier * teamSpeed;

        this.vel.x += this.acc.x * this.agility;
        this.vel.y += this.acc.y * this.agility;

        // Ensure velocity is capped at maxSpeed and maintained above a minimum speed to prevent clump stalling
        const velMagSq = this.vel.x * this.vel.x + this.vel.y * this.vel.y;
        if (velMagSq > maxSpeed * maxSpeed) {
            const velMag = Math.sqrt(velMagSq);
            this.vel.x = (this.vel.x / velMag) * maxSpeed;
            this.vel.y = (this.vel.y / velMag) * maxSpeed;
        } else {
            const minSpeed = CONFIG.maxSpeed * 0.45;
            if (velMagSq < minSpeed * minSpeed) {
                const velMag = Math.sqrt(velMagSq);
                if (velMag > 0.01) {
                    this.vel.x = (this.vel.x / velMag) * minSpeed;
                    this.vel.y = (this.vel.y / velMag) * minSpeed;
                } else {
                    const randA = Math.random() * Math.PI * 2;
                    this.vel.x = Math.cos(randA) * minSpeed;
                    this.vel.y = Math.sin(randA) * minSpeed;
                }
            }
        }

        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;

        // Reset acceleration
        this.acc.x = 0;
        this.acc.y = 0;

        // Wrap around boundaries smoothly - clear trail on boundary wrap to prevent screen-slashing lines
        let wrapped = false;
        if (this.pos.x < 0) { this.pos.x = width; wrapped = true; }
        if (this.pos.x > width) { this.pos.x = 0; wrapped = true; }
        if (this.pos.y < 0) { this.pos.y = height; wrapped = true; }
        if (this.pos.y > height) { this.pos.y = 0; wrapped = true; }
        if (wrapped) {
            this.trail = [];
        }

        // Update trail buffer
        this.trailCounter++;
        if (this.trailCounter % 2 === 0 && !wrapped) {
            this.trail.push({ x: this.pos.x, y: this.pos.y });
            if (this.trail.length > this.maxTrail) {
                this.trail.shift();
            }
        }

        this.pulsePhase += 0.12;
        this.justConverted = false;
    }

    draw(ctx) {
        const teamData = TEAMS[this.team] || TEAMS.dragon;
        const baseColor = teamData.color;
        const colorRgb = teamData.colorRgb;
        const angle = Math.atan2(this.vel.y, this.vel.x);
        const size = this.size;

        // 1. Draw motion trail - with distance check to strictly prevent screen-wrap slashes
        if (this.trail.length > 1 && !this.frozen) {
            ctx.beginPath();
            let drawing = false;
            for (let i = 0; i < this.trail.length; i++) {
                const p = this.trail[i];
                if (i === 0) {
                    ctx.moveTo(p.x, p.y);
                    drawing = true;
                } else {
                    const prev = this.trail[i - 1];
                    const dx = p.x - prev.x;
                    const dy = p.y - prev.y;
                    // If distance between samples is over 35px, it wrapped around screen: split line
                    if (dx * dx + dy * dy > 1225) {
                        ctx.moveTo(p.x, p.y);
                    } else {
                        ctx.lineTo(p.x, p.y);
                    }
                }
            }
            if (drawing && this.trail.length > 0) {
                const last = this.trail[this.trail.length - 1];
                const dx = this.pos.x - last.x;
                const dy = this.pos.y - last.y;
                if (dx * dx + dy * dy <= 1225) {
                    ctx.lineTo(this.pos.x, this.pos.y);
                }
            }
            ctx.strokeStyle = `rgba(${colorRgb}, 0.28)`;
            ctx.lineWidth = size * 0.35;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // 2. Conversion pressure indicator (Aura and warning ring)
        if (this.conversionPressure > 5) {
            const ratio = Math.min(1, this.conversionPressure / CONFIG.peerPressureTime);
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, size * (1.8 + ratio * 0.8), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${ratio * 0.8})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, size * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${ratio * 0.25})`;
            ctx.fill();
        }

        // 3. Frozen EMP cage
        if (this.frozen) {
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, size * 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Electric spark crosshairs
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
            ctx.beginPath();
            ctx.moveTo(this.pos.x - size * 2.2, this.pos.y);
            ctx.lineTo(this.pos.x + size * 2.2, this.pos.y);
            ctx.moveTo(this.pos.x, this.pos.y - size * 2.2);
            ctx.lineTo(this.pos.x, this.pos.y + size * 2.2);
            ctx.stroke();
        }

        // 4. Conversion flash
        if (this.justConverted) {
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, size * 3.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${colorRgb}, 0.7)`;
            ctx.fill();
        }

        // 5. Draw high-tech fighter dart
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(angle);

        // Thruster plume
        if (!this.frozen) {
            const thrustLength = size * (0.8 + Math.sin(this.pulsePhase * 3) * 0.3);
            const thrustGrad = ctx.createLinearGradient(0, 0, -thrustLength - size * 0.5, 0);
            thrustGrad.addColorStop(0, '#ffffff');
            thrustGrad.addColorStop(0.3, `rgba(${colorRgb}, 0.8)`);
            thrustGrad.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.moveTo(-size * 0.4, -size * 0.25);
            ctx.lineTo(-size * 0.4 - thrustLength, 0);
            ctx.lineTo(-size * 0.4, size * 0.25);
            ctx.closePath();
            ctx.fillStyle = thrustGrad;
            ctx.fill();
        }

        // Ship Hull (faceted stealth fighter chassis)
        ctx.beginPath();
        ctx.moveTo(size * 1.3, 0);                 // Nose
        ctx.lineTo(-size * 0.8, size * 0.75);      // Right wingtip
        ctx.lineTo(-size * 0.4, 0);                // Engine notch
        ctx.lineTo(-size * 0.8, -size * 0.75);     // Left wingtip
        ctx.closePath();

        ctx.fillStyle = this.frozen ? '#606470' : baseColor;
        ctx.fill();

        // Cockpit / glowing power core
        ctx.beginPath();
        ctx.arc(size * 0.15, 0, size * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fill();

        // Wing panel accents
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(size * 0.7, 0);
        ctx.lineTo(-size * 0.6, size * 0.5);
        ctx.moveTo(size * 0.7, 0);
        ctx.lineTo(-size * 0.6, -size * 0.5);
        ctx.stroke();

        ctx.restore();
    }
}
