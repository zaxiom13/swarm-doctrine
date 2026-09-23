// Canvas drawing for the match: terrain, ships, controls and short-lived effects.
import { prefersReducedMotion } from './settings.js';
import { TERRAIN_TYPES } from './terrain.js';

const MATCH_STATES = new Set(['playing', 'paused', 'sector-intro', 'lesson-intro', 'upgrade', 'victory', 'defeat']);
const RALLY_COLOR = '255, 170, 0';
const COOL_OFF_COLOR = '255, 68, 68';
export const WORLD_SHORT_SIDE = 720;

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.time = 0;
        this.shipScale = 1;
        this.floatingTexts = [];
        this.shockwaves = [];
        this.particles = [];
        this.shake = 0;
        this.gridCanvas = null;
        this.vignette = null;
        this.fieldParticles = new WeakMap();
        this.shipOptions = { scale: 1, trail: true, panels: true, thruster: true, gradient: true, simple: false };
    }

    resize() {
        // A 1:1 backing store keeps fill rate low on phones. The world always has a
        // WORLD_SHORT_SIDE short side, so rules and balance match on every screen.
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        const shortSide = Math.min(this.canvas.width, this.canvas.height) || WORLD_SHORT_SIDE;
        this.viewScale = shortSide / WORLD_SHORT_SIDE;
        this.width = this.canvas.width / this.viewScale;
        this.height = this.canvas.height / this.viewScale;
        this.shipScale = Math.max(1, 0.75 / this.viewScale);
        this.textScale = 1 / this.viewScale;
        this.vignette = null;
        this.buildGrid();
    }

    /** Screen pixels relative to the canvas to world units. */
    toWorld(x, y) { return { x: x / this.viewScale, y: y / this.viewScale }; }

    /** The background grid is drawn once per resize into its own canvas. */
    buildGrid() {
        const { width, height } = this.canvas, grid = this.gridCanvas = document.createElement('canvas');
        grid.width = width;
        grid.height = height;
        const ctx = grid.getContext('2d');
        ctx.strokeStyle = 'rgba(0, 247, 255, 0.035)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < width; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = 0; y < height; y += 80) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();
    }

    drawGrid() { this.ctx.drawImage(this.gridCanvas, 0, 0); }

    // Effects -------------------------------------------------------------

    addFloatingText(text, x, y, color = '#00ffff', size = 14) { this.floatingTexts.push({ text, x, y, color, size, life: 1 }); }
    addShockwave(x, y, maxRadius = 220, color = '#00ffff') { this.shockwaves.push({ x, y, radius: 10, maxRadius, color, alpha: 0.9 }); }

    burst(x, y, rgb) {
        for (let i = 0; i < 10; i++) {
            const angle = Math.PI * 2 * i / 10 + Math.random() * 0.3, speed = 60 + Math.random() * 120;
            this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.5 + Math.random() * 0.3, maxLife: 0.8, rgb, size: 3 + Math.random() * 3 });
        }
        this.shake = Math.max(this.shake, 0.2);
    }

    clearEffects() {
        this.floatingTexts = [];
        this.shockwaves = [];
        this.particles = [];
        this.shake = 0;
    }

    // Frame ---------------------------------------------------------------

    render(game, dt = 0.016) {
        const ctx = this.ctx, inMatch = MATCH_STATES.has(game.gameState), live = game.gameState === 'playing';
        this.time += dt;
        ctx.save();
        if (this.shake > 0 && !prefersReducedMotion()) ctx.translate((Math.random() - 0.5) * this.shake * 14, (Math.random() - 0.5) * this.shake * 14);
        this.shake = Math.max(0, this.shake - dt * 2.8);
        ctx.clearRect(-20, -20, this.canvas.width + 40, this.canvas.height + 40);
        this.drawGrid();
        ctx.scale(this.viewScale, this.viewScale);
        if (inMatch) {
            const sim = game.sim;
            for (const field of sim.terrain) this.drawTerrain(field, live ? dt : 0);
            this.drawTethers(sim.boids, game);
            if (live) this.drawParticles(dt);
            this.drawShockwaves(live ? dt : 0);
            this.drawCommanders(game);
            this.drawPlayerAura(sim.boids, game.playerTeam, game.palette(game.playerTeam));
            this.drawShips(sim.boids, team => game.palette(team), sim.rules.conversionTicks);
            if (live) this.drawFloatingTexts(dt);
        }
        ctx.restore();
        this.drawVignette();
    }

    drawCommanders(game) {
        const ctx = this.ctx, sim = game.sim, player = sim.commanders[game.playerTeam];
        for (const commander of Object.values(sim.commanders)) {
            if (commander !== player && commander.rallying) {
                ctx.save();
                ctx.strokeStyle = '#ffad7d';
                ctx.lineWidth = 2;
                circle(ctx, commander.target.x, commander.target.y, 22); ctx.stroke();
                ctx.restore();
                this.label(game.rivalName(), commander.target.x, Math.max(16, commander.target.y - 30), '#ffad7d');
            }
        }
        if (!player || game.gameState !== 'playing') return;
        const pointer = game.input.pointer;
        if (player.freezeWait <= 0 && (!game.practice || game.tutorial.allowsAbility('freeze'))) {
            ctx.save();
            ctx.strokeStyle = game.input.freezeAiming ? '#b6edff99' : '#b6edff20';
            ctx.setLineDash([4, 8]);
            circle(ctx, pointer.x, pointer.y, player.freezeRadius); ctx.stroke();
            ctx.restore();
        }
        this.drawRallyReticle(pointer, player, game.palette(game.playerTeam));
    }

    drawRallyReticle(point, commander, look) {
        const ctx = this.ctx, { x, y } = point, radius = commander.rallyRadius;
        const active = commander.rallying, cooling = !active && commander.coolOff > 0;
        const ring = active ? RALLY_COLOR : cooling ? COOL_OFF_COLOR : look.rgb;
        const solid = active ? '#ffaa00' : cooling ? '#ff4444' : look.color;
        ctx.save();
        circle(ctx, x, y, radius + Math.sin(this.time * 4) * 5);
        ctx.strokeStyle = active ? `rgba(${ring}, 0.5)` : cooling ? `rgba(${ring}, 0.35)` : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = active ? 2.5 : 1.5;
        ctx.setLineDash(active ? [6, 4] : cooling ? [3, 3] : [2, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
        if (active) {
            const glow = radial(ctx, x, y, 0, radius, [[0, `rgba(${ring}, 0.22)`], [0.5, `rgba(${ring}, 0.08)`], [1, 'transparent']]);
            circle(ctx, x, y, radius); ctx.fillStyle = glow; ctx.fill();
            const inward = (this.time * 2) % 1;
            circle(ctx, x, y, radius * (1 - inward));
            ctx.strokeStyle = `rgba(${ring}, ${inward * 0.4})`; ctx.stroke();
        }
        ctx.translate(x, y);
        ctx.rotate(this.time * (active ? 3.5 : 1.5));
        ctx.strokeStyle = solid;
        for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(16, -4); ctx.lineTo(16, 4); ctx.stroke(); }
        ctx.restore();
        circle(ctx, x, y, active ? 6 : 3); ctx.fillStyle = solid; ctx.fill();
        if (active || cooling) this.label(active ? 'Gathering' : `Spreading · ${commander.coolOff.toFixed(1)}s`, x, y + 26, active ? '#ffaa00' : '#ff5555', `bold ${Math.round(14 * this.textScale)}px`);
    }

    label(text, x, y, color, font = `${Math.round(11 * this.textScale)}px`) {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = `${font} system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    /** Lines from a recruiting ship to its target show pressure building. */
    drawTethers(boids, game) {
        const ctx = this.ctx, ticks = game.sim.rules.conversionTicks, reach = (game.sim.rules.conversionRadius * 1.5) ** 2;
        for (const boid of boids) {
            const source = boid.conversionSource;
            if (boid.conversionPressure <= 8 || !source || game.sim.commanders[source.team]?.disarmed) continue;
            // The source may have wrapped to the far edge or left; never draw a line across the arena.
            if ((source.pos.x - boid.pos.x) ** 2 + (source.pos.y - boid.pos.y) ** 2 > reach) continue;
            const ratio = Math.min(1, boid.conversionPressure / ticks);
            ctx.beginPath();
            ctx.moveTo(source.pos.x, source.pos.y);
            ctx.lineTo(boid.pos.x, boid.pos.y);
            ctx.strokeStyle = `rgba(${game.palette(source.team).rgb}, ${ratio * 0.75})`;
            ctx.lineWidth = 1.2 + ratio * 1.5;
            ctx.stroke();
        }
    }

    drawShockwaves(dt) {
        const ctx = this.ctx;
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const wave = this.shockwaves[i];
            wave.radius += (wave.maxRadius - wave.radius) * dt * 12 + (dt ? 10 : 0);
            wave.alpha -= dt * 2.2;
            if (wave.alpha <= 0 || wave.radius >= wave.maxRadius) { this.shockwaves.splice(i, 1); continue; }
            circle(ctx, wave.x, wave.y, wave.radius);
            ctx.strokeStyle = wave.color;
            ctx.lineWidth = 4 * wave.alpha;
            ctx.shadowColor = wave.color;
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    drawParticles(dt) {
        const ctx = this.ctx;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }
            p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
            const alpha = p.life / p.maxLife;
            circle(ctx, p.x, p.y, Math.max(1, p.size * alpha));
            ctx.fillStyle = `rgba(${p.rgb}, ${alpha})`;
            ctx.fill();
        }
    }

    /** Floating text is clamped so it is never cut off at the screen edge. */
    drawFloatingTexts(dt) {
        const ctx = this.ctx, w = this.width, h = this.height;
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const text = this.floatingTexts[i];
            text.y -= 35 * dt;
            text.life -= dt;
            if (text.life <= 0) { this.floatingTexts.splice(i, 1); continue; }
            const margin = Math.min(70, w * 0.08);
            ctx.save();
            ctx.font = `bold ${Math.round(text.size * this.textScale)}px system-ui, sans-serif`;
            ctx.fillStyle = ctx.shadowColor = text.color;
            ctx.globalAlpha = Math.max(0, text.life);
            ctx.textAlign = 'center';
            ctx.shadowBlur = 8;
            ctx.fillText(text.text, clamp(text.x, margin, w - margin), clamp(text.y, 64 * this.textScale, h - Math.min(150 * this.textScale, h * 0.24)));
            ctx.restore();
        }
    }

    drawVignette() {
        const { width, height } = this.canvas;
        this.vignette ||= radial(this.ctx, width / 2, height / 2, height * 0.35, height * 0.95, [[0, 'transparent'], [1, 'rgba(2, 4, 10, 0.65)']]);
        this.ctx.fillStyle = this.vignette;
        this.ctx.fillRect(0, 0, width, height);
    }

    // Terrain -------------------------------------------------------------

    drawTerrain(field, dt) {
        const pulse = Math.sin(this.time * 2 + field.x * 0.01) * 0.15 + 1, spin = this.time * (field.type === 'blackHole' ? 2 : 0.5);
        if (field.type === 'blackHole') this.drawBlackHole(field, pulse, spin, dt);
        else if (field.type === 'slowZone') this.drawNebula(field, pulse, spin);
        else this.drawAsteroids(field, spin);
        this.label(TERRAIN_TYPES[field.type].label.toUpperCase(), field.x, field.y - field.reach - 10, field.type === 'blackHole' ? '#cda8ef' : '#a8c5d0', `${Math.round(12 * this.textScale)}px`);
    }

    drawBlackHole(field, pulse, spin, dt) {
        const ctx = this.ctx, { x, y, radius, reach, core } = field;
        const pull = radial(ctx, x, y, core, reach, [[0, 'rgba(136, 0, 255, 0.3)'], [0.5, 'rgba(136, 0, 255, 0.1)'], [1, 'transparent']]);
        circle(ctx, x, y, reach); ctx.fillStyle = pull; ctx.fill();
        let particles = this.fieldParticles.get(field);
        if (!particles) this.fieldParticles.set(field, particles = []);
        if (dt && Math.random() < 0.3) particles.push({ angle: Math.random() * Math.PI * 2, dist: reach * (0.3 + Math.random() * 0.7), speed: 2 + Math.random() * 2, life: 1 + Math.random(), size: 2 + Math.random() * 3 });
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt; p.angle += p.speed * dt;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            circle(ctx, x + Math.cos(p.angle) * p.dist, y + Math.sin(p.angle) * p.dist, p.size);
            ctx.fillStyle = `rgba(136, 0, 255, ${p.life * 0.5})`; ctx.fill();
        }
        const horizon = radial(ctx, x, y, 0, radius * pulse, [[0, 'rgba(0, 0, 0, 1)'], [0.7, 'rgba(34, 0, 51, 0.8)'], [1, 'rgba(136, 0, 255, 0.3)']]);
        circle(ctx, x, y, radius * pulse); ctx.fillStyle = '#220033'; ctx.fill(); ctx.fillStyle = horizon; ctx.fill();
        ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
        ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.5 * pulse, radius * 0.3 * pulse, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(136, 0, 255, 0.5)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
    }

    drawNebula(field, pulse, spin) {
        const ctx = this.ctx, { x, y, radius } = field;
        const cloud = radial(ctx, x, y, 0, radius * pulse, [[0, 'rgba(0, 102, 204, 0.3)'], [0.5, 'rgba(0, 51, 102, 0.2)'], [1, 'transparent']]);
        circle(ctx, x, y, radius * pulse); ctx.fillStyle = cloud; ctx.fill();
        ctx.save(); ctx.translate(x, y); ctx.rotate(spin * 0.3);
        for (let i = 0; i < 3; i++) {
            const angle = i / 3 * Math.PI * 2 + this.time, cx = Math.cos(angle) * radius * 0.4, cy = Math.sin(angle) * radius * 0.4;
            const swirl = radial(ctx, cx, cy, 0, radius * 0.4, [[0, 'rgba(0, 150, 255, 0.2)'], [1, 'transparent']]);
            circle(ctx, cx, cy, radius * 0.4); ctx.fillStyle = swirl; ctx.fill();
        }
        ctx.restore();
        circle(ctx, x, y, radius * pulse);
        ctx.strokeStyle = 'rgba(0, 102, 204, 0.3)'; ctx.lineWidth = 2; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
    }

    drawAsteroids(field, spin) {
        const ctx = this.ctx, { x, y, radius } = field;
        ctx.save(); ctx.translate(x, y); ctx.rotate(spin * 0.2);
        const dust = radial(ctx, 0, 0, 0, radius, [[0, 'rgba(100, 100, 100, 0.15)'], [1, 'transparent']]);
        circle(ctx, 0, 0, radius); ctx.fillStyle = dust; ctx.fill();
        for (let i = 0; i < 12; i++) {
            const angle = i / 12 * Math.PI * 2, dist = radius * (0.2 + (i % 3) * 0.25), size = 5 + (i % 4) * 3;
            const ax = Math.cos(angle) * dist, ay = Math.sin(angle) * dist;
            ctx.beginPath(); ctx.moveTo(ax + size, ay);
            for (let j = 1; j < 6; j++) { const a = j / 6 * Math.PI * 2, r = size * (0.7 + Math.sin(i * 3 + j) * 0.3); ctx.lineTo(ax + Math.cos(a) * r, ay + Math.sin(a) * r); }
            ctx.closePath();
            ctx.fillStyle = `rgba(${80 + i * 10}, ${80 + i * 8}, ${80 + i * 6}, 0.8)`; ctx.fill();
            ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)'; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.restore();
        circle(ctx, x, y, radius);
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)'; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    }

    // Ships ---------------------------------------------------------------

    /** A soft pulsing halo under every player ship and a "YOU" tag over the fleet, without changing its colour. */
    drawPlayerAura(boids, team, look) {
        if (!team) return;
        if (this.auraColor !== look.color) {
            const sprite = this.auraSprite = document.createElement('canvas');
            sprite.width = sprite.height = 64;
            const sctx = sprite.getContext('2d');
            const glow = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            glow.addColorStop(0.35, `rgba(${look.rgb}, 0.55)`);
            glow.addColorStop(1, `rgba(${look.rgb}, 0)`);
            sctx.fillStyle = glow;
            sctx.fillRect(0, 0, 64, 64);
            this.auraColor = look.color;
        }
        const ctx = this.ctx, size = 11 * this.shipScale * (1 + Math.sin(this.time * 4) * 0.15);
        let sx = 0, sy = 0, n = 0;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.7;
        for (const boid of boids) {
            if (boid.team !== team) continue;
            ctx.drawImage(this.auraSprite, boid.pos.x - size, boid.pos.y - size, size * 2, size * 2);
            sx += boid.pos.x; sy += boid.pos.y; n++;
        }
        ctx.restore();
        if (!n) return;
        // Anchor the tag to the ship nearest the fleet's centre so split fleets still point at real ships.
        const cx = sx / n, cy = sy / n;
        let anchor = null, best = Infinity;
        for (const boid of boids) {
            if (boid.team !== team) continue;
            const d = (boid.pos.x - cx) ** 2 + (boid.pos.y - cy) ** 2;
            if (d < best) { best = d; anchor = boid; }
        }
        const x = anchor.pos.x, y = anchor.pos.y - 34 * this.textScale - Math.sin(this.time * 3) * 3;
        ctx.save();
        ctx.font = `800 ${Math.round(15 * this.textScale)}px Fredoka, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = (ctx.measureText('YOU')?.width ?? 24) + 18 * this.textScale, h = 24 * this.textScale;
        ctx.fillStyle = look.color;
        ctx.beginPath();
        ctx.roundRect?.(x - w / 2, y - h / 2, w, h, h / 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - 5 * this.textScale, y + h / 2); ctx.lineTo(x + 5 * this.textScale, y + h / 2); ctx.lineTo(x, y + h / 2 + 6 * this.textScale);
        ctx.fill();
        ctx.fillStyle = '#120a33';
        ctx.fillText('YOU', x, y + 1);
        ctx.restore();
    }

    /** Dense fleets drop trails, panels and gradients to stay smooth on phones. */
    drawShips(boids, palette, conversionTicks = 36) {
        const dense = boids.length > 120, veryDense = boids.length > 180;
        const compact = Math.min(this.canvas.width, this.canvas.height) < 700;
        const options = Object.assign(this.shipOptions, { scale: this.shipScale, trail: !dense, thruster: !veryDense, panels: !dense, simple: dense, gradient: !dense && !compact });
        const looks = new Map();
        for (const boid of boids) {
            let look = looks.get(boid.team);
            if (!look) looks.set(boid.team, look = { ...palette(boid.team), trail: `rgba(${palette(boid.team).rgb}, 0.28)` });
            this.drawShip(boid, look, options, conversionTicks);
        }
    }

    drawShip(boid, look, options, conversionTicks) {
        const ctx = this.ctx, angle = Math.atan2(boid.vel.y, boid.vel.x), size = boid.size * options.scale, { x, y } = boid.pos;
        if (boid.team === 'neutral') {
            // Unclaimed ships have a distinct outline, not a third fleet livery.
            ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
            ctx.strokeStyle = ctx.fillStyle = look.color; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(size * 0.8, 0); ctx.lineTo(0, size * 0.5); ctx.lineTo(-size * 0.8, 0); ctx.lineTo(0, -size * 0.5); ctx.closePath(); ctx.stroke();
            circle(ctx, 0, 0, 1.5); ctx.fill();
            ctx.restore();
            return;
        }
        if (options.simple && !boid.frozen && boid.conversionPressure <= 5 && !boid.justConverted) {
            const cos = Math.cos(angle), sin = Math.sin(angle);
            ctx.beginPath();
            ctx.moveTo(x + cos * size * 1.3, y + sin * size * 1.3);
            ctx.lineTo(x - cos * size * 0.8 + sin * size * 0.75, y - sin * size * 0.8 - cos * size * 0.75);
            ctx.lineTo(x - cos * size * 0.4, y - sin * size * 0.4);
            ctx.lineTo(x - cos * size * 0.8 - sin * size * 0.75, y - sin * size * 0.8 + cos * size * 0.75);
            ctx.closePath();
            ctx.fillStyle = look.color;
            ctx.fill();
            return;
        }
        if (options.trail && boid.trailLen > 1 && !boid.frozen) {
            ctx.beginPath();
            const start = boid.trailLen < boid.maxTrail ? 0 : boid.trailHead;
            let previous = null;
            for (let step = 0; step < boid.trailLen; step++) {
                const p = boid.trail[(start + step) % boid.maxTrail];
                // Samples more than 35px apart mean the ship wrapped around the arena.
                if (!previous || (p.x - previous.x) ** 2 + (p.y - previous.y) ** 2 > 1225) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
                previous = p;
            }
            if (previous && (x - previous.x) ** 2 + (y - previous.y) ** 2 <= 1225) ctx.lineTo(x, y);
            ctx.strokeStyle = look.trail; ctx.lineWidth = size * 0.35; ctx.lineCap = 'round'; ctx.stroke();
        }
        if (boid.conversionPressure > 5) {
            const ratio = Math.min(1, boid.conversionPressure / conversionTicks);
            circle(ctx, x, y, size * (1.8 + ratio * 0.8));
            ctx.strokeStyle = `rgba(255, 255, 255, ${ratio * 0.8})`; ctx.lineWidth = 1.5; ctx.stroke();
            circle(ctx, x, y, size * 1.5);
            ctx.fillStyle = `rgba(255, 255, 255, ${ratio * 0.25})`; ctx.fill();
        }
        if (boid.frozen) {
            circle(ctx, x, y, size * 2);
            ctx.strokeStyle = look.color; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.strokeStyle = `rgba(${look.rgb}, 0.7)`;
            ctx.beginPath();
            ctx.moveTo(x - size * 2.2, y); ctx.lineTo(x + size * 2.2, y);
            ctx.moveTo(x, y - size * 2.2); ctx.lineTo(x, y + size * 2.2);
            ctx.stroke();
        }
        if (boid.justConverted) {
            circle(ctx, x, y, size * 3.5);
            ctx.fillStyle = `rgba(${look.rgb}, 0.7)`; ctx.fill();
        }
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
        if (!boid.frozen && options.thruster) {
            const thrust = size * (0.8 + Math.sin(boid.pulsePhase * 3) * 0.3);
            ctx.beginPath(); ctx.moveTo(-size * 0.4, -size * 0.25); ctx.lineTo(-size * 0.4 - thrust, 0); ctx.lineTo(-size * 0.4, size * 0.25); ctx.closePath();
            if (options.gradient) {
                const plume = ctx.createLinearGradient(0, 0, -thrust - size * 0.5, 0);
                plume.addColorStop(0, '#ffffff');
                plume.addColorStop(0.3, `rgba(${look.rgb}, 0.8)`);
                plume.addColorStop(1, 'transparent');
                ctx.fillStyle = plume;
                ctx.fill();
            } else {
                ctx.fillStyle = look.color; ctx.globalAlpha = 0.72; ctx.fill(); ctx.globalAlpha = 1;
            }
        }
        ctx.beginPath();
        ctx.moveTo(size * 1.3, 0); ctx.lineTo(-size * 0.8, size * 0.75); ctx.lineTo(-size * 0.4, 0); ctx.lineTo(-size * 0.8, -size * 0.75);
        ctx.closePath();
        ctx.fillStyle = boid.frozen ? '#606470' : look.color;
        ctx.fill();
        circle(ctx, size * 0.15, 0, size * 0.25); ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.fill();
        if (options.panels) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(size * 0.7, 0); ctx.lineTo(-size * 0.6, size * 0.5); ctx.moveTo(size * 0.7, 0); ctx.lineTo(-size * 0.6, -size * 0.5); ctx.stroke();
        }
        ctx.restore();
    }
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function radial(ctx, x, y, r0, r1, stops) {
    const gradient = ctx.createRadialGradient(x, y, r0, x, y, r1);
    for (const [at, color] of stops) gradient.addColorStop(at, color);
    return gradient;
}
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
