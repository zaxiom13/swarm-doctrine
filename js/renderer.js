// Canvas drawing for the match: terrain, ships, controls and short-lived effects.
import { prefersReducedMotion } from './settings.js';
import { TERRAIN_TYPES } from './terrain.js';

const MATCH_STATES = new Set(['playing', 'paused', 'sector-intro', 'lesson-intro', 'upgrade', 'victory', 'defeat']);
const RALLY_COLOR = '255, 170, 0';
const COOL_OFF_COLOR = '255, 68, 68';

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
        // Game logic uses canvas pixels as world units; a 1:1 backing store keeps fill rate low on phones.
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        const shortSide = Math.min(this.canvas.width, this.canvas.height);
        this.shipScale = shortSide < 430 ? 1.7 : shortSide < 700 ? 1.4 : shortSide < 1100 ? 1.15 : 1;
        this.vignette = null;
        this.buildGrid();
    }

    buildGrid() {
        this.gridCanvas = null;
        try {
            const grid = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(this.canvas.width, this.canvas.height) : document.createElement('canvas');
            grid.width = this.canvas.width;
            grid.height = this.canvas.height;
            const ctx = grid.getContext('2d');
            if (!ctx) return;
            this.strokeGrid(ctx);
            this.gridCanvas = grid;
        } catch { /* Older embedded browsers lack a detached canvas; draw directly instead. */ }
    }

    strokeGrid(ctx) {
        ctx.strokeStyle = 'rgba(0, 247, 255, 0.035)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < this.canvas.width; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); }
        for (let y = 0; y < this.canvas.height; y += 80) { ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); }
        ctx.stroke();
    }

    drawGrid() {
        if (this.gridCanvas) this.ctx.drawImage(this.gridCanvas, 0, 0);
        else this.strokeGrid(this.ctx);
    }

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
        if (inMatch) {
            const sim = game.sim;
            for (const field of sim.terrain) this.drawTerrain(field, live ? dt : 0);
            this.drawTethers(sim.boids, game);
            if (live) this.drawParticles(dt);
            this.drawShockwaves(live ? dt : 0);
            this.drawCommanders(game);
            this.drawShips(sim.boids, team => game.palette(team), sim.rules.conversionTicks);
            if (live) this.drawFloatingTexts(dt);
        }
        this.drawVignette();
        ctx.restore();
    }

    drawCommanders(game) {
        const ctx = this.ctx, sim = game.sim, player = sim.commanders[game.playerTeam];
        for (const commander of Object.values(sim.commanders)) {
            const color = commander.team === game.playerTeam ? '#a5e9ff' : '#ffbf87';
            if (commander.freezeField) {
                const field = commander.freezeField;
                ctx.save();
                ctx.strokeStyle = color + '55';
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(field.x, field.y, field.radius, 0, Math.PI * 2); ctx.stroke();
                ctx.font = '11px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`Frozen · ${Math.ceil(field.remaining)}s`, clamp(field.x, 80, this.canvas.width - 80), Math.max(150, field.y - field.radius + 20));
                ctx.restore();
            }
            if (commander !== player && commander.rallying) {
                ctx.save();
                ctx.strokeStyle = ctx.fillStyle = '#ffad7d';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(commander.target.x, commander.target.y, 22, 0, Math.PI * 2); ctx.stroke();
                ctx.font = '11px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(game.rivalName(), commander.target.x, Math.max(16, commander.target.y - 30));
                ctx.restore();
            }
        }
        if (!player || game.gameState !== 'playing') return;
        const pointer = game.input.pointer;
        if (player.freezeWait <= 0 && (!game.practice || game.tutorial.allowsAbility('freeze'))) {
            ctx.save();
            ctx.strokeStyle = game.input.freezeAiming ? '#b6edff99' : '#b6edff20';
            ctx.setLineDash([4, 8]);
            ctx.beginPath(); ctx.arc(pointer.x, pointer.y, player.freezeRadius, 0, Math.PI * 2); ctx.stroke();
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
        ctx.beginPath();
        ctx.arc(x, y, radius + Math.sin(this.time * 4) * 5, 0, Math.PI * 2);
        ctx.strokeStyle = active ? `rgba(${ring}, 0.5)` : cooling ? `rgba(${ring}, 0.35)` : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = active ? 2.5 : 1.5;
        ctx.setLineDash(active ? [6, 4] : cooling ? [3, 3] : [2, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
        if (active) {
            const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
            glow.addColorStop(0, `rgba(${ring}, 0.22)`);
            glow.addColorStop(0.5, `rgba(${ring}, 0.08)`);
            glow.addColorStop(1, 'transparent');
            ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.fill();
            const inward = (this.time * 2) % 1;
            ctx.beginPath(); ctx.arc(x, y, radius * (1 - inward), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${ring}, ${inward * 0.4})`; ctx.stroke();
        }
        ctx.translate(x, y);
        ctx.rotate(this.time * (active ? 3.5 : 1.5));
        ctx.strokeStyle = solid;
        for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(16, -4); ctx.lineTo(16, 4); ctx.stroke(); }
        ctx.restore();
        ctx.beginPath(); ctx.arc(x, y, active ? 6 : 3, 0, Math.PI * 2); ctx.fillStyle = solid; ctx.fill();
        if (active || cooling) {
            ctx.font = `bold ${Math.round(14 * this.shipScale)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillStyle = active ? '#ffaa00' : '#ff5555';
            ctx.fillText(active ? 'Gathering' : `Spreading · ${commander.coolOff.toFixed(1)}s`, x, y + 26);
        }
    }

    /** Lines from a recruiting ship to its target show pressure building. */
    drawTethers(boids, game) {
        const ctx = this.ctx, ticks = game.sim.rules.conversionTicks;
        for (const boid of boids) {
            const source = boid.conversionSource;
            if (boid.conversionPressure <= 8 || !source || game.sim.commanders[source.team]?.disarmed) continue;
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
            ctx.beginPath(); ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
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
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.size * alpha), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.rgb}, ${alpha})`;
            ctx.fill();
        }
    }

    /** Floating text is clamped so it is never cut off at the screen edge. */
    drawFloatingTexts(dt) {
        const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const text = this.floatingTexts[i];
            text.y -= 35 * dt;
            text.life -= dt;
            if (text.life <= 0) { this.floatingTexts.splice(i, 1); continue; }
            const margin = Math.min(70, w * 0.08);
            ctx.save();
            ctx.font = `bold ${Math.round(text.size * this.shipScale)}px system-ui, sans-serif`;
            ctx.fillStyle = ctx.shadowColor = text.color;
            ctx.globalAlpha = Math.max(0, text.life);
            ctx.textAlign = 'center';
            ctx.shadowBlur = 8;
            ctx.fillText(text.text, clamp(text.x, margin, w - margin), clamp(text.y, 64, h - Math.min(150, h * 0.24)));
            ctx.restore();
        }
    }

    drawVignette() {
        const { width, height } = this.canvas;
        if (!this.vignette) {
            this.vignette = this.ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 0.95);
            this.vignette.addColorStop(0, 'transparent');
            this.vignette.addColorStop(1, 'rgba(2, 4, 10, 0.65)');
        }
        this.ctx.fillStyle = this.vignette;
        this.ctx.fillRect(0, 0, width, height);
    }

    // Terrain -------------------------------------------------------------

    drawTerrain(field, dt) {
        const ctx = this.ctx, pulse = Math.sin(this.time * 2 + field.x * 0.01) * 0.15 + 1, spin = this.time * (field.type === 'blackHole' ? 2 : 0.5);
        const label = TERRAIN_TYPES[field.type].label;
        if (field.type === 'blackHole') this.drawBlackHole(field, pulse, spin, dt);
        else if (field.type === 'slowZone') this.drawNebula(field, pulse, spin);
        else this.drawAsteroids(field, spin);
        ctx.save();
        ctx.font = `${Math.round(12 * Math.min(this.shipScale, 1.25))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = field.type === 'blackHole' ? '#cda8ef' : '#a8c5d0';
        ctx.fillText(label.toUpperCase(), field.x, field.y - field.reach - 10);
        ctx.restore();
    }

    drawBlackHole(field, pulse, spin, dt) {
        const ctx = this.ctx, { x, y, radius, reach, core } = field;
        const pull = ctx.createRadialGradient(x, y, core, x, y, reach);
        pull.addColorStop(0, 'rgba(136, 0, 255, 0.3)');
        pull.addColorStop(0.5, 'rgba(136, 0, 255, 0.1)');
        pull.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(x, y, reach, 0, Math.PI * 2); ctx.fillStyle = pull; ctx.fill();
        let particles = this.fieldParticles.get(field);
        if (!particles) this.fieldParticles.set(field, particles = []);
        if (dt && Math.random() < 0.3) particles.push({ angle: Math.random() * Math.PI * 2, dist: reach * (0.3 + Math.random() * 0.7), speed: 2 + Math.random() * 2, life: 1 + Math.random(), size: 2 + Math.random() * 3 });
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt; p.angle += p.speed * dt;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            ctx.beginPath(); ctx.arc(x + Math.cos(p.angle) * p.dist, y + Math.sin(p.angle) * p.dist, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(136, 0, 255, ${p.life * 0.5})`; ctx.fill();
        }
        const horizon = ctx.createRadialGradient(x, y, 0, x, y, radius * pulse);
        horizon.addColorStop(0, 'rgba(0, 0, 0, 1)');
        horizon.addColorStop(0.7, 'rgba(34, 0, 51, 0.8)');
        horizon.addColorStop(1, 'rgba(136, 0, 255, 0.3)');
        ctx.beginPath(); ctx.arc(x, y, radius * pulse, 0, Math.PI * 2); ctx.fillStyle = '#220033'; ctx.fill(); ctx.fillStyle = horizon; ctx.fill();
        ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
        ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.5 * pulse, radius * 0.3 * pulse, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(136, 0, 255, 0.5)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
    }

    drawNebula(field, pulse, spin) {
        const ctx = this.ctx, { x, y, radius } = field;
        const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius * pulse);
        cloud.addColorStop(0, 'rgba(0, 102, 204, 0.3)');
        cloud.addColorStop(0.5, 'rgba(0, 51, 102, 0.2)');
        cloud.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(x, y, radius * pulse, 0, Math.PI * 2); ctx.fillStyle = cloud; ctx.fill();
        ctx.save(); ctx.translate(x, y); ctx.rotate(spin * 0.3);
        for (let i = 0; i < 3; i++) {
            const angle = i / 3 * Math.PI * 2 + this.time, cx = Math.cos(angle) * radius * 0.4, cy = Math.sin(angle) * radius * 0.4;
            const swirl = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.4);
            swirl.addColorStop(0, 'rgba(0, 150, 255, 0.2)');
            swirl.addColorStop(1, 'transparent');
            ctx.beginPath(); ctx.arc(cx, cy, radius * 0.4, 0, Math.PI * 2); ctx.fillStyle = swirl; ctx.fill();
        }
        ctx.restore();
        ctx.beginPath(); ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 102, 204, 0.3)'; ctx.lineWidth = 2; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
    }

    drawAsteroids(field, spin) {
        const ctx = this.ctx, { x, y, radius } = field;
        ctx.save(); ctx.translate(x, y); ctx.rotate(spin * 0.2);
        const dust = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        dust.addColorStop(0, 'rgba(100, 100, 100, 0.15)');
        dust.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fillStyle = dust; ctx.fill();
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
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)'; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    }

    // Ships ---------------------------------------------------------------

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
            ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.fill();
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
            ctx.beginPath(); ctx.arc(x, y, size * (1.8 + ratio * 0.8), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${ratio * 0.8})`; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.beginPath(); ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${ratio * 0.25})`; ctx.fill();
        }
        if (boid.frozen) {
            ctx.beginPath(); ctx.arc(x, y, size * 2, 0, Math.PI * 2);
            ctx.strokeStyle = look.color; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.strokeStyle = `rgba(${look.rgb}, 0.7)`;
            ctx.beginPath();
            ctx.moveTo(x - size * 2.2, y); ctx.lineTo(x + size * 2.2, y);
            ctx.moveTo(x, y - size * 2.2); ctx.lineTo(x, y + size * 2.2);
            ctx.stroke();
        }
        if (boid.justConverted) {
            ctx.beginPath(); ctx.arc(x, y, size * 3.5, 0, Math.PI * 2);
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
        ctx.beginPath(); ctx.arc(size * 0.15, 0, size * 0.25, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.fill();
        if (options.panels) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(size * 0.7, 0); ctx.lineTo(-size * 0.6, size * 0.5); ctx.moveTo(size * 0.7, 0); ctx.lineTo(-size * 0.6, -size * 0.5); ctx.stroke();
        }
        ctx.restore();
    }
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
