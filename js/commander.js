// Rally and Freeze for one team. The player, scripted bots, the local policy and
// Jev all drive the same Commander, so every side obeys identical rules.
import { Vector } from './vector.js';

export class Commander {
    constructor(sim, team) {
        this.sim = sim;
        this.team = team;
        this.target = new Vector(sim.width / 2, sim.height / 2);
        this.rallying = false;
        this.holdRemaining = Infinity;
        this.coolOff = 0;
        this.settle = 0;
        this.freezeCooldown = 0;
        this.freezeField = null;
    }

    get mods() { return this.sim.modifiers(this.team); }
    get rallyRadius() { return this.sim.rules.rallyRadius * this.mods.rallyRadius; }
    get freezeRadius() { return this.sim.rules.freezeRadius * this.mods.freezeRadius; }
    get freezeDuration() { return this.sim.rules.freezeDuration + this.mods.freezeDuration; }

    /** Ships cannot recruit while rallying or during the short cool-off after release. */
    get disarmed() { return this.rallying || this.coolOff > 0; }

    /** Seconds until Freeze can be cast, including the opening lockout. */
    get freezeWait() {
        return Math.max(this.freezeCooldown, this.sim.rules.freezeLockout - this.sim.time, 0);
    }

    rally(x, y, holdSeconds = Infinity) {
        this.target.set(x, y);
        this.holdRemaining = holdSeconds;
        if (!this.rallying) this.sim.emit({ type: 'rally', team: this.team });
        this.rallying = true;
        this.coolOff = this.sim.rules.rallyCoolOff;
    }

    moveTarget(x, y) { this.target.set(x, y); }

    release() {
        if (!this.rallying) return;
        const { rules, random } = this.sim;
        this.rallying = false;
        this.holdRemaining = Infinity;
        this.coolOff = rules.rallyCoolOff;
        this.settle = rules.releaseSettle;
        // A gentle outward bloom turns the rally knot into a surrounding ring.
        const radiusSq = rules.releaseSpreadRadius * rules.releaseSpreadRadius;
        for (const boid of this.sim.boids) {
            if (boid.team !== this.team || boid.pos.distSq(this.target) >= radiusSq) continue;
            const angle = Math.atan2(boid.pos.y - this.target.y, boid.pos.x - this.target.x) + (random() - 0.5) * 0.5;
            const force = 0.35 + random() * 0.3;
            boid.vel.x += Math.cos(angle) * force;
            boid.vel.y += Math.sin(angle) * force;
        }
        this.sim.emit({ type: 'release', team: this.team });
    }

    /** Freezes every other ship among eligible rivals. A miss keeps the charge. */
    freeze(x, y) {
        if (this.freezeWait > 0) return null;
        const radius = this.freezeRadius;
        const radiusSq = radius * radius;
        const eligible = this.sim.boids.filter(b => b.team !== this.team && b.team !== 'neutral' && (b.pos.x - x) ** 2 + (b.pos.y - y) ** 2 <= radiusSq);
        const step = Math.max(1, Math.round(1 / this.sim.rules.freezeFraction));
        const victims = eligible.filter((_, index) => index % step === 0);
        if (!victims.length) {
            this.sim.emit({ type: 'freeze-miss', team: this.team, x, y });
            return null;
        }
        const duration = this.freezeDuration;
        for (const boid of victims) boid.stun(duration);
        this.freezeCooldown = this.sim.rules.freezeCooldown;
        this.freezeField = { x, y, radius, remaining: duration };
        this.release();
        this.coolOff = 0;
        this.sim.emit({ type: 'freeze', team: this.team, x, y, radius, duration, victims: victims.length, eligible: eligible.length });
        return { victims, eligible };
    }

    /** Applies a validated AI action: wait, release, rally or freeze. */
    apply(action) {
        if (!action || action.type === 'wait') return;
        if (action.type === 'release') this.release();
        else if (action.type === 'rally') this.rally(action.x, action.y, action.holdSeconds ?? Infinity);
        else if (action.type === 'freeze') this.freeze(action.x, action.y);
    }

    step(dt) {
        this.freezeCooldown = Math.max(0, this.freezeCooldown - dt);
        if (this.freezeField) {
            this.freezeField.remaining -= dt;
            if (this.freezeField.remaining <= 0) this.freezeField = null;
        }
        this.settle = Math.max(0, this.settle - dt);
        if (this.rallying) {
            this.coolOff = this.sim.rules.rallyCoolOff;
            this.holdRemaining -= dt;
            if (this.holdRemaining <= 0) this.release();
        } else {
            this.coolOff = Math.max(0, this.coolOff - dt);
        }
    }

    /** Rally pulls this team's ships and pushes nearby rival ships away. */
    steer(boid) {
        const rules = this.sim.rules;
        if (boid.team === this.team) {
            if (this.rallying) boid.applyForce(boid.rallyTowards(this.target, rules, rules.rallyAttractForce * this.mods.rallyForce));
            else if (this.settle > 0) boid.applyForce(boid.rallyTowards(this.target, rules, 0.7));
        } else if (this.rallying && boid.team !== 'neutral') {
            const radius = this.rallyRadius;
            if (boid.pos.distSq(this.target) < radius * radius) {
                boid.applyForce(boid.fleePoint(this.target, rules.rallyRepelForce, rules.maxSpeed * 0.8, rules, this.sim.random));
            }
        }
    }

    resize(sx, sy, sr) {
        this.target.x *= sx;
        this.target.y *= sy;
        if (this.freezeField) { this.freezeField.x *= sx; this.freezeField.y *= sy; this.freezeField.radius *= sr; }
    }

    toJSON() {
        return { team: this.team, target: { x: this.target.x, y: this.target.y }, rallying: this.rallying, holdRemaining: this.holdRemaining,
            coolOff: this.coolOff, settle: this.settle, freezeCooldown: this.freezeCooldown, freezeField: this.freezeField && { ...this.freezeField } };
    }

    restore(data) {
        this.target.set(data.target.x, data.target.y);
        Object.assign(this, { rallying: data.rallying, holdRemaining: data.holdRemaining ?? Infinity, coolOff: data.coolOff, settle: data.settle,
            freezeCooldown: data.freezeCooldown, freezeField: data.freezeField && { ...data.freezeField } });
    }
}
