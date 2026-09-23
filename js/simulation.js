// The game world without a browser: ships, terrain, commanders and recruitment.
// The playable game, headless training, the lookahead bot and tests all step
// this same class, so there is exactly one implementation of the rules.
import { Boid } from './boid.js';
import { Commander } from './commander.js';
import { QuadTree, Rectangle, Circle } from './quadtree.js';
import { TerrainField } from './terrain.js';
import { createRules } from './rules.js';
import { baseModifiers } from './catalog.js';

export const TICK = 1 / 60;

export class Simulation {
    constructor({ width = 1280, height = 720, rules = createRules(), random = Math.random } = {}) {
        this.width = width;
        this.height = height;
        this.rules = rules;
        this.random = random;
        this.time = 0;
        this.boids = [];
        this.terrain = [];
        this.commanders = {};
        this.mods = {};
        this.teams = [];
        this.counts = {};
        this.events = [];
        // Optional lesson hooks: which ships may be recruited or move, and a
        // gentler recruitment assist for one team.
        this.canConvert = null;
        this.canMove = null;
        this.assist = null;
        this.dormant = false;

        this._bounds = new Rectangle(0, 0, 1, 1);
        this._query = new Circle(0, 0, 1);
        this._neighbors = [];
        this._tree = null;
    }

    emit(event) { this.events.push(event); }
    drainEvents() { const events = this.events; this.events = []; return events; }

    modifiers(team) { return this.mods[team] ||= baseModifiers(); }
    setModifiers(team, values) { this.mods[team] = { ...baseModifiers(), ...values }; }

    commander(team) { return this.commanders[team] ||= new Commander(this, team); }

    setTeams(teams) {
        this.teams = [...teams];
        this.counts = Object.fromEntries([...teams, 'neutral'].map(team => [team, 0]));
    }

    addBoid(x, y, team) {
        const boid = new Boid(x, y, team, this.rules, this.random);
        this.boids.push(boid);
        return boid;
    }

    /** A loose rectangular blob of ships around a point. */
    spawnBlob(team, count, cx, cy, spreadX, spreadY = spreadX) {
        for (let i = 0; i < count; i++) this.addBoid(cx + (this.random() - 0.5) * spreadX, cy + (this.random() - 0.5) * spreadY, team);
    }

    /** A tight spiral cluster, used for lesson targets and reinforcements. */
    spawnCluster(team, count, cx, cy, radius) {
        for (let i = 0; i < count; i++) {
            const angle = i * 2.399963, r = Math.sqrt(i / count) * radius;
            this.addBoid(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, team);
        }
    }

    /** Adds ships beside a team's fleet, away from black holes. */
    spawnNear(team, count) {
        const unsafe = boid => this.terrain.some(field => field.type === 'blackHole' && (boid.pos.x - field.x) ** 2 + (boid.pos.y - field.y) ** 2 < (field.reach + 30) ** 2);
        const anchor = this.boids.find(boid => boid.team === team && !unsafe(boid));
        const cx = anchor?.pos.x ?? this.width * 0.18, cy = anchor?.pos.y ?? this.height * 0.18;
        for (let i = 0; i < count; i++) {
            this.addBoid(clamp(cx + (this.random() - 0.5) * 40, 12, this.width - 12), clamp(cy + (this.random() - 0.5) * 40, 12, this.height - 12), team);
        }
    }

    /** Gray ships in the open middle of the arena, bounded by the duel caps. */
    spawnNeutrals(count) {
        const existing = this.boids.filter(boid => boid.team === 'neutral').length;
        count = Math.max(0, Math.min(count, this.rules.duelNeutralCap - existing, this.rules.duelShipCap - this.boids.length));
        for (let i = 0; i < count; i++) {
            for (let attempt = 0; attempt < 30; attempt++) {
                const x = this.width * (0.12 + this.random() * 0.76), y = this.height * (0.3 + this.random() * 0.4);
                if (this.terrain.some(field => (x - field.x) ** 2 + (y - field.y) ** 2 < (field.reach + 24) ** 2)) continue;
                this.addBoid(x, y, 'neutral');
                break;
            }
        }
    }

    setTerrain(specs) { this.terrain = specs.map(spec => new TerrainField(spec)); }

    count(team) { return this.boids.reduce((n, boid) => n + (boid.team === team), 0); }

    step(dt = TICK) {
        const rules = this.rules;
        this.time += dt;
        for (const commander of Object.values(this.commanders)) commander.step(dt);
        for (const boid of this.boids) {
            boid.freezeRemaining = Math.max(0, boid.freezeRemaining - dt);
            boid.frozen = boid.freezeRemaining > 0;
            if (boid.slowMultiplier < 1) boid.slowMultiplier = Math.min(1, boid.slowMultiplier + dt * 2);
        }
        this.applyTerrain();

        const tree = this.buildTree();
        const query = this._query, neighbors = this._neighbors;
        const radius = Math.max(rules.perceptionRadius, rules.separationRadius, rules.conversionRadius);
        query.r = radius;
        query.rSquared = radius * radius;
        const commanders = Object.values(this.commanders);
        for (const team in this.counts) this.counts[team] = 0;

        for (let i = 0; i < this.boids.length; i++) {
            const boid = this.boids[i];
            if (!this.dormant) {
                const mods = this.modifiers(boid.team);
                query.x = boid.pos.x;
                query.y = boid.pos.y;
                neighbors.length = 0;
                tree.query(query, neighbors);
                boid.flock(neighbors, rules, mods.cohesion);
                for (let c = 0; c < commanders.length; c++) commanders[c].steer(boid);
                if (!this.canConvert || this.canConvert(boid)) {
                    const winner = this.recruitmentStep(boid, neighbors);
                    if (winner) this.convert(boid, winner, neighbors);
                }
                if (!this.canMove || this.canMove(boid)) boid.update(this.width, this.height, rules, mods.speed, this.random);
                else boid.acc.set(0, 0);
            }
            this.counts[boid.team] = (this.counts[boid.team] || 0) + 1;
        }
    }

    applyTerrain() {
        if (!this.terrain.length) return;
        let destroyed = null;
        for (const boid of this.boids) {
            for (const field of this.terrain) {
                if (field.affect(boid, this.random)) { (destroyed ||= new Set()).add(boid); break; }
            }
        }
        if (!destroyed) return;
        this.boids = this.boids.filter(boid => !destroyed.has(boid));
        for (const boid of destroyed) this.emit({ type: 'destroyed', team: boid.team, x: boid.pos.x, y: boid.pos.y });
    }

    buildTree() {
        const bounds = this._bounds;
        bounds.x = this.width / 2; bounds.y = this.height / 2;
        bounds.w = this.width / 2; bounds.h = this.height / 2;
        if (this._tree) this._tree.clear();
        else this._tree = new QuadTree(bounds, 4);
        for (let i = 0; i < this.boids.length; i++) this._tree.insert(this.boids[i]);
        return this._tree;
    }

    /**
     * One tick of recruitment pressure on a ship. Returns the recruiting team
     * once pressure reaches the threshold. Frozen ships and gray ships never
     * exert pressure; a team that is rallying cannot recruit.
     */
    recruitmentStep(boid, neighbors) {
        if (boid.conversionCooldown > 0) { boid.conversionCooldown--; return null; }
        const rules = this.rules;
        const radiusSq = rules.conversionRadius * rules.conversionRadius;
        const counts = {};
        let nearest = null, nearestSq = Infinity;
        for (let i = 0; i < neighbors.length; i++) {
            const other = neighbors[i];
            if (other === boid || other.team === 'neutral' || other.frozen) continue;
            const dx = other.pos.x - boid.pos.x, dy = other.pos.y - boid.pos.y, dSq = dx * dx + dy * dy;
            if (dSq > radiusSq) continue;
            counts[other.team] = (counts[other.team] || 0) + 1;
            if (other.team !== boid.team && dSq < nearestSq) { nearestSq = dSq; nearest = other; }
        }
        let attacker = null, attackers = 0, tied = false;
        for (const team in counts) {
            if (team === boid.team) continue;
            if (counts[team] > attackers) { attackers = counts[team]; attacker = team; tied = false; }
            else if (counts[team] === attackers) tied = true;
        }
        const decay = amount => {
            boid.conversionPressure = Math.max(0, boid.conversionPressure - amount);
            if (boid.conversionPressure === 0) boid.conversionSource = null;
            return null;
        };
        if (attacker && this.commanders[attacker]?.disarmed) return decay(2);
        // Two fleets tied over a gray ship cancel each other out.
        if (boid.team === 'neutral' && tied) attacker = null;

        const assisted = this.assist;
        const threshold = assisted ? assisted.threshold : rules.conversionThreshold;
        let resist = this.modifiers(boid.team).resist;
        if (this.commanders[boid.team]?.disarmed) resist *= rules.rallyVulnerability;
        if (assisted && boid.team !== assisted.team) resist *= assisted.rivalResist;
        const defenders = counts[boid.team] || 0;
        if (!attacker || attackers < threshold || attackers <= defenders * resist) return decay(1.5);

        boid.conversionSource = nearest;
        boid.conversionPressure += (boid.frozen ? 1 / rules.frozenConversionSlowdown : 1) * this.modifiers(attacker).pressure;
        return boid.conversionPressure >= rules.conversionTicks * (assisted ? assisted.speedup : 1) ? attacker : null;
    }

    convert(boid, team, neighbors) {
        const from = boid.team, wasFrozen = boid.frozen;
        boid.convert(team, this.rules);
        this.emit({ type: 'convert', from, to: team, wasFrozen, x: boid.pos.x, y: boid.pos.y });
        if (this.modifiers(team).chain) {
            const next = neighbors.find(other => other !== boid && other.team !== team && other.team !== 'neutral');
            if (next) next.conversionPressure += Math.floor(this.rules.conversionTicks * 0.5);
        }
    }

    /** What one team's controller may see: its fleet, rivals, gray ships, terrain and controls. */
    snapshotFor(team) {
        const point = boid => ({ x: clamp(boid.pos.x, 0, this.width), y: clamp(boid.pos.y, 0, this.height), ...(boid.frozen ? { frozen: true } : {}) });
        const commander = this.commander(team);
        const allies = [], rivals = [], neutrals = [];
        for (const boid of this.boids) (boid.team === team ? allies : boid.team === 'neutral' ? neutrals : rivals).push(point(boid));
        return {
            arena: { width: this.width, height: this.height },
            time: this.time,
            allies, rivals, neutrals,
            terrain: this.terrain.map(field => ({ type: field.type, x: field.x, y: field.y, radius: field.radius, reach: field.reach })),
            rally: { active: commander.rallying, remaining: Number.isFinite(commander.holdRemaining) ? commander.holdRemaining : 0, cooldown: commander.coolOff, target: { x: commander.target.x, y: commander.target.y } },
            freeze: { cooldown: commander.freezeWait },
            abilities: { freezeRadius: commander.freezeRadius, freezeDuration: commander.freezeDuration, freezeCooldown: this.rules.freezeCooldown,
                rallyRadius: commander.rallyRadius, conversionRadius: this.rules.conversionRadius, maxSpeed: this.rules.maxSpeed },
            rules: { conversionThreshold: this.rules.conversionThreshold, conversionTicks: this.rules.conversionTicks, rallyCoolOff: this.rules.rallyCoolOff,
                freezeLockout: this.rules.freezeLockout, freezeFraction: this.rules.freezeFraction },
        };
    }

    /** Scales the world after a viewport change without rebuilding the map. */
    resize(width, height) {
        const sx = width / this.width, sy = height / this.height, sr = Math.min(width, height) / Math.min(this.width, this.height);
        this.width = width;
        this.height = height;
        for (const boid of this.boids) { boid.pos.x *= sx; boid.pos.y *= sy; boid.clearTrail(); }
        for (const field of this.terrain) { field.x *= sx; field.y *= sy; field.setRadius(field.radius * sr); }
        for (const commander of Object.values(this.commanders)) commander.resize(sx, sy, sr);
        return { sx, sy, sr };
    }

    toJSON() {
        return {
            width: this.width, height: this.height, time: this.time, rules: { ...this.rules }, teams: this.teams, mods: this.mods,
            terrain: this.terrain.map(field => field.toJSON()),
            commanders: Object.values(this.commanders).map(commander => commander.toJSON()),
            boids: this.boids.map(b => [b.team, b.pos.x, b.pos.y, b.vel.x, b.vel.y, b.conversionPressure, b.conversionCooldown, b.freezeRemaining, b.slowMultiplier, b.agility]),
        };
    }

    static fromJSON(data, random = Math.random) {
        const sim = new Simulation({ width: data.width, height: data.height, rules: createRules(data.rules), random });
        sim.time = data.time;
        sim.setTeams(data.teams);
        for (const [team, mods] of Object.entries(data.mods)) sim.setModifiers(team, mods);
        sim.setTerrain(data.terrain);
        for (const [team, x, y, vx, vy, pressure, cooldown, freeze, slow, agility] of data.boids) {
            const boid = sim.addBoid(x, y, team);
            boid.vel.set(vx, vy);
            Object.assign(boid, { conversionPressure: pressure, conversionCooldown: cooldown, freezeRemaining: freeze, frozen: freeze > 0, slowMultiplier: slow, agility });
        }
        for (const commander of data.commanders) sim.commander(commander.team).restore(commander);
        return sim;
    }
}

export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
