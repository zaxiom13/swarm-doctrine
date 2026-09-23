// A single ship. Pure model code: rules are passed in, drawing lives in the renderer.
import { Vector } from './vector.js';

export class Boid {
    constructor(x, y, team, rules, random = Math.random) {
        const angle = random() * Math.PI * 2, speed = rules.maxSpeed * 0.6;
        this.pos = new Vector(x, y);
        this.vel = new Vector(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.acc = new Vector();
        this.team = team;
        this.conversionPressure = 0;
        this.conversionCooldown = 0;
        this.conversionSource = null;
        this.justConverted = false;
        this.frozen = false;
        this.freezeRemaining = 0;
        this.slowMultiplier = 1;
        this.agility = 0.9 + random() * 0.2;
        this.size = rules.shipSize * (0.95 + random() * 0.1);
        this.pulsePhase = random() * Math.PI * 2;

        // Steering runs every tick for every ship; reused buffers avoid garbage.
        this._separationForce = new Vector();
        this._alignmentForce = new Vector();
        this._cohesionForce = new Vector();
        this._rallyForce = new Vector();
        this._fleeForce = new Vector();
        this._seekForce = new Vector();

        // Fixed-size ring buffer for the motion trail.
        this.maxTrail = 4;
        this.trail = new Array(this.maxTrail);
        this.trailHead = 0;
        this.trailLen = 0;
        this.trailCounter = 0;
    }

    applyForce(force) {
        this.acc.x += force.x;
        this.acc.y += force.y;
    }

    separate(neighbors, rules, out = this._separationForce) {
        let steerX = 0, steerY = 0, count = 0, veryClose = false;
        const radiusSq = rules.separationRadius * rules.separationRadius;
        for (let i = 0; i < neighbors.length; i++) {
            const other = neighbors[i];
            const dx = this.pos.x - other.pos.x;
            const dy = this.pos.y - other.pos.y;
            const dSq = dx * dx + dy * dy;
            if (dSq > 0 && dSq < radiusSq) {
                const close = dSq < 196;
                const weight = (close ? 3 : 1) / dSq;
                if (close) veryClose = true;
                steerX += dx * weight;
                steerY += dy * weight;
                count++;
            }
        }
        if (count > 0) {
            const mag = length(steerX, steerY);
            if (mag > 0) {
                steerX = steerX / mag * rules.maxSpeed - this.vel.x;
                steerY = steerY / mag * rules.maxSpeed - this.vel.y;
                return limit(out, steerX, steerY, veryClose ? rules.maxForce * 2.8 : rules.maxForce);
            }
        }
        return out.set(0, 0);
    }

    align(neighbors, rules, out = this._alignmentForce) {
        let sumX = 0, sumY = 0, count = 0;
        for (let i = 0; i < neighbors.length; i++) {
            const other = neighbors[i];
            if (other === this) continue;
            sumX += other.vel.x;
            sumY += other.vel.y;
            count++;
        }
        if (!count) return out.set(0, 0);
        const mag = length(sumX, sumY);
        if (mag > 0) { sumX = sumX / mag * rules.maxSpeed; sumY = sumY / mag * rules.maxSpeed; }
        return limit(out, sumX - this.vel.x, sumY - this.vel.y, rules.maxForce);
    }

    cohere(neighbors, rules, out = this._cohesionForce) {
        let sumX = 0, sumY = 0, count = 0;
        for (let i = 0; i < neighbors.length; i++) {
            const other = neighbors[i];
            if (other === this) continue;
            sumX += other.pos.x;
            sumY += other.pos.y;
            count++;
        }
        return count ? this.seekXY(sumX / count, sumY / count, rules, out) : out.set(0, 0);
    }

    seekXY(tx, ty, rules, out = this._seekForce) {
        let dx = tx - this.pos.x, dy = ty - this.pos.y;
        const mag = length(dx, dy);
        if (mag > 0) { dx = dx / mag * rules.maxSpeed; dy = dy / mag * rules.maxSpeed; }
        return limit(out, dx - this.vel.x, dy - this.vel.y, rules.maxForce);
    }

    /** Escort a rally point: sprint in from afar, orbit nearby, never collapse to a dot. */
    rallyTowards(target, rules, forceMult = 1, out = this._rallyForce) {
        const dx = target.x - this.pos.x, dy = target.y - this.pos.y;
        const dist = length(dx, dy);
        if (dist === 0) return out.set(0, 0);
        const speed = rules.maxSpeed * 1.25, ux = dx / dist, uy = dy / dist;
        let desiredX, desiredY;
        if (dist > 75) { desiredX = ux * speed; desiredY = uy * speed; }
        else if (dist < 35) { desiredX = -ux * speed * 0.9; desiredY = -uy * speed * 0.9; }
        else {
            const radial = (dist - 55) / 20;
            desiredX = (-uy * 0.85 + ux * radial * 0.35) * speed;
            desiredY = (ux * 0.85 + uy * radial * 0.35) * speed;
        }
        return limit(out, desiredX - this.vel.x, desiredY - this.vel.y, rules.maxForce * 1.6 * forceMult);
    }

    fleePoint(target, force, maxSpeed, rules, random = Math.random, out = this._fleeForce) {
        let dx = this.pos.x - target.x, dy = this.pos.y - target.y;
        const dist = length(dx, dy);
        if (dist === 0) { dx = random() - 0.5; dy = random() - 0.5; }
        else { dx = dx / dist * maxSpeed; dy = dy / dist * maxSpeed; }
        return limit(out, dx - this.vel.x, dy - this.vel.y, rules.maxForce * force);
    }

    flock(neighbors, rules, cohesionMult = 1) {
        const sep = this.separate(neighbors, rules);
        const ali = this.align(neighbors, rules);
        const coh = this.cohere(neighbors, rules);
        const cohesion = rules.cohesionWeight * cohesionMult;
        this.acc.x += sep.x * rules.separationWeight + ali.x * rules.alignmentWeight + coh.x * cohesion;
        this.acc.y += sep.y * rules.separationWeight + ali.y * rules.alignmentWeight + coh.y * cohesion;
    }

    stun(seconds) {
        this.frozen = true;
        this.freezeRemaining = Math.max(this.freezeRemaining, seconds);
        this.vel.x *= 0.1;
        this.vel.y *= 0.1;
    }

    convert(team, rules) {
        this.team = team;
        this.frozen = false;
        this.freezeRemaining = 0;
        this.conversionPressure = 0;
        this.conversionCooldown = rules.conversionCooldownTicks;
        this.justConverted = true;
        this.conversionSource = null;
    }

    update(width, height, rules, speedMult = 1, random = Math.random) {
        if (this.frozen) {
            this.acc.x = 0;
            this.acc.y = 0;
            this.pulsePhase += 0.05;
            return;
        }
        const maxSpeed = rules.maxSpeed * speedMult * this.slowMultiplier;
        this.vel.x += this.acc.x * this.agility;
        this.vel.y += this.acc.y * this.agility;
        const speedSq = this.vel.x * this.vel.x + this.vel.y * this.vel.y;
        if (speedSq > maxSpeed * maxSpeed) {
            const speed = Math.sqrt(speedSq);
            this.vel.x = this.vel.x / speed * maxSpeed;
            this.vel.y = this.vel.y / speed * maxSpeed;
        } else {
            // A minimum cruising speed keeps dense clumps from stalling.
            const minSpeed = rules.maxSpeed * 0.45;
            if (speedSq < minSpeed * minSpeed) {
                const speed = Math.sqrt(speedSq);
                if (speed > 0.01) { this.vel.x = this.vel.x / speed * minSpeed; this.vel.y = this.vel.y / speed * minSpeed; }
                else { const a = random() * Math.PI * 2; this.vel.x = Math.cos(a) * minSpeed; this.vel.y = Math.sin(a) * minSpeed; }
            }
        }
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
        this.acc.x = 0;
        this.acc.y = 0;

        // Wrap into [0, size) so every ship stays inside the spatial index.
        let wrapped = false;
        if (this.pos.x < 0) { this.pos.x += width; wrapped = true; } else if (this.pos.x >= width) { this.pos.x -= width; wrapped = true; }
        if (this.pos.y < 0) { this.pos.y += height; wrapped = true; } else if (this.pos.y >= height) { this.pos.y -= height; wrapped = true; }
        if (wrapped) { this.trailHead = 0; this.trailLen = 0; }
        else if (++this.trailCounter % 2 === 0) {
            const slot = this.trail[this.trailHead] ||= { x: 0, y: 0 };
            slot.x = this.pos.x;
            slot.y = this.pos.y;
            this.trailHead = (this.trailHead + 1) % this.maxTrail;
            if (this.trailLen < this.maxTrail) this.trailLen++;
        }
        this.pulsePhase += 0.12;
        this.justConverted = false;
    }

    clearTrail() { this.trailHead = 0; this.trailLen = 0; }
}

function limit(out, x, y, max) {
    const mag = length(x, y);
    if (mag > max) { x = x / mag * max; y = y / mag * max; }
    return out.set(x, y);
}

function length(x, y) { return Math.sqrt(x * x + y * y); }

