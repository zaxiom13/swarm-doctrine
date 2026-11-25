// Canvas drawing for the match: deep-space backdrop, terrain hazards, ships, controls and effects.
import { prefersReducedMotion } from './settings.ts';
import { TERRAIN_TYPES } from './terrain.ts';

const MATCH_STATES = new Set(['playing', 'paused', 'sector-intro', 'lesson-intro', 'upgrade', 'victory', 'defeat']);
const RALLY_COLOR = '255, 190, 59';
const COOL_OFF_COLOR = '255, 90, 112';
const MAX_PARTICLES = 220;
export const WORLD_SHORT_SIDE = 720;

export class Renderer {
    declare canvas: any;
    declare ctx: any;
    declare time: number;
    declare shipScale: number;
    declare floatingTexts: any;
    declare shockwaves: any;
    declare particles: any;
    declare shake: number;
    declare gridCanvas: any;
    declare vignette: any;
    declare fieldParticles: WeakMap<WeakKey, any>;
    declare shipOptions: any;
    declare offsetX: number;
    declare offsetY: number;
    declare viewScale: number;
    declare width: any;
    declare height: any;
    declare textScale: number;
    declare fixed: any;
    declare auraSprite: HTMLCanvasElement;
    declare auraColor: any;
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
        this.offsetX = this.offsetY = 0;
        if (this.fixed) {
            // Online matches share one arena size; fit it inside the screen.
            this.viewScale = Math.min(this.canvas.width / this.fixed.width, this.canvas.height / this.fixed.height) || 1;
            this.width = this.fixed.width;
            this.height = this.fixed.height;
            this.offsetX = (this.canvas.width - this.width * this.viewScale) / 2;
            this.offsetY = (this.canvas.height - this.height * this.viewScale) / 2;
        } else {
            const shortSide = Math.min(this.canvas.width, this.canvas.height) || WORLD_SHORT_SIDE;
            this.viewScale = shortSide / WORLD_SHORT_SIDE;
            this.width = this.canvas.width / this.viewScale;
            this.height = this.canvas.height / this.viewScale;
        }
        this.shipScale = Math.max(1, 0.75 / this.viewScale);
        this.textScale = 1 / this.viewScale;
        this.vignette = null;
        this.buildGrid();
    }

    /** Screen pixels relative to the canvas to world units. */
    toWorld(x, y) { return { x: (x - this.offsetX) / this.viewScale, y: (y - this.offsetY) / this.viewScale }; }

    /** Pins the world to a fixed size (online play) or, with null, back to the screen's shape. */
    fixArena(size) { this.fixed = size; this.resize(); }

    /** The deep-space backdrop, starfield, and tactical grid are pre-rendered once per resize. */
    buildGrid() {
        const { width, height } = this.canvas, grid = this.gridCanvas = document.createElement('canvas');
        grid.width = width;
        grid.height = height;
        const ctx = grid.getContext('2d');

        // Deep Obsidian sky base + subtle cosmic nebula washes (avoids linear gradient in offscreen cache)
        ctx.fillStyle = '#060a17';
        ctx.fillRect(0, 0, width, height);

        const baseGlow = radial(ctx, width * 0.5, height * 0.45, 0, Math.max(width, height) * 0.72,
            [[0, 'rgba(16, 28, 62, 0.78)'], [0.65, 'rgba(9, 15, 34, 0.42)'], [1, 'rgba(5, 8, 18, 0)']]);
        ctx.fillStyle = baseGlow;
        ctx.fillRect(0, 0, width, height);

        // Soft ambient nebula clouds
        const cloudA = radial(ctx, width * 0.22, height * 0.24, 0, Math.max(width, height) * 0.45,
            [[0, 'rgba(55, 226, 213, 0.055)'], [0.55, 'rgba(22, 62, 110, 0.03)'], [1, 'transparent']]);
        ctx.fillStyle = cloudA;
        ctx.fillRect(0, 0, width, height);

        const cloudB = radial(ctx, width * 0.78, height * 0.74, 0, Math.max(width, height) * 0.5,
            [[0, 'rgba(143, 123, 255, 0.065)'], [0.55, 'rgba(42, 32, 108, 0.03)'], [1, 'transparent']]);
        ctx.fillStyle = cloudB;
        ctx.fillRect(0, 0, width, height);

        // Deterministic seeded starfield
        const starCount = Math.min(120, Math.max(40, Math.round(width * height / 11000)));
        let s = (width * 73856093 ^ height * 19349663) >>> 0;
        const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
        const tints = ['240, 246, 255', '175, 244, 255', '205, 196, 255'];
        for (let i = 0; i < starCount; i++) {
            const x = rand() * width, y = rand() * height;
            const r = 0.55 + rand() * 1.15;
            const alpha = 0.16 + rand() * 0.42;
            ctx.fillStyle = `rgba(${tints[i % tints.length]}, ${alpha.toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Subtle tactical grid + intersection crosshairs
        ctx.strokeStyle = 'rgba(55, 226, 213, 0.032)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < width; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = 0; y < height; y += 80) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(148, 214, 255, 0.08)';
        ctx.beginPath();
        for (let x = 80; x < width; x += 160) {
            for (let y = 80; y < height; y += 160) {
                ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y);
                ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3);
            }
        }
        ctx.stroke();
    }

    drawGrid() { this.ctx.drawImage(this.gridCanvas, 0, 0); }

    // Effects -------------------------------------------------------------

    addFloatingText(text, x, y, color = '#37e2d5', size = 14) { this.floatingTexts.push({ text, x, y, color, size, life: 1 }); }
    addShockwave(x, y, maxRadius = 220, color = '#37e2d5') { this.shockwaves.push({ x, y, radius: 10, maxRadius, color, alpha: 0.9 }); }

    burst(x, y, rgb) {
        if (this.particles.length >= MAX_PARTICLES) return;
        for (let i = 0; i < 10; i++) {
            const angle = Math.PI * 2 * i / 10 + Math.random() * 0.35, speed = 75 + Math.random() * 135;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.42 + Math.random() * 0.28,
                maxLife: 0.7,
                rgb,
                size: 2.2 + Math.random() * 2.4,
            });
        }
        this.shake = Math.max(this.shake, 0.18);
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
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.viewScale, this.viewScale);
        if (this.fixed && inMatch) {
            ctx.strokeStyle = 'rgba(55, 226, 213, 0.35)';
            ctx.lineWidth = 2 / this.viewScale;
            ctx.strokeRect(0, 0, this.width, this.height);
        }
        if (inMatch) {
            const sim = game.sim;
            for (const field of sim.terrain) this.drawTerrain(field, live ? dt : 0);
            this.drawTethers(sim.boids, game);
            if (live) this.drawParticles(dt);
            this.drawShockwaves(live ? dt : 0);
            this.drawCommanders(game);
            const playerBadge = this.drawPlayerAura(sim.boids, game.playerTeam, game.palette(game.playerTeam));
            this.drawShips(sim.boids, team => game.palette(team), sim.rules.conversionTicks);
            if (playerBadge) this.drawPlayerBadge(playerBadge.x, playerBadge.y, playerBadge.look);
            if (live) this.drawFloatingTexts(dt);
        }
        ctx.restore();
        this.drawVignette();
    }

    drawCommanders(game) {
        const ctx = this.ctx, sim = game.sim, player = sim.commanders[game.playerTeam];
        for (const commander of Object.values(sim.commanders) as any[]) {
            if (commander !== player && commander.rallying) {
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 140, 96, 0.78)';
                ctx.lineWidth = 1.8;
                ctx.setLineDash([5, 5]);
                circle(ctx, commander.target.x, commander.target.y, 24);
                ctx.stroke();
                ctx.setLineDash([]);
                circle(ctx, commander.target.x, commander.target.y, 4);
                ctx.fillStyle = '#ff9d76';
                ctx.fill();
                ctx.restore();
                this.label(game.rivalName(), commander.target.x, Math.max(18, commander.target.y - 32), '#ffb294');
            }
        }
        if (!player || game.gameState !== 'playing') return;
        const pointer = game.input.pointer;
        if (player.freezeWait <= 0 && (!game.practice || game.tutorial.allowsAbility('freeze'))) {
            ctx.save();
            if (game.input.freezeAiming) {
                ctx.fillStyle = 'rgba(121, 212, 242, 0.08)';
                circle(ctx, pointer.x, pointer.y, player.freezeRadius);
                ctx.fill();
                ctx.strokeStyle = 'rgba(165, 233, 255, 0.78)';
                ctx.lineWidth = 2;
                ctx.setLineDash([7, 6]);
            } else {
                ctx.strokeStyle = 'rgba(165, 233, 255, 0.14)';
                ctx.lineWidth = 1.2;
                ctx.setLineDash([4, 8]);
            }
            circle(ctx, pointer.x, pointer.y, player.freezeRadius);
            ctx.stroke();
            ctx.restore();
        }
        this.drawRallyReticle(pointer, player, game.palette(game.playerTeam));
    }

    drawRallyReticle(point, commander, look) {
        const ctx = this.ctx, { x, y } = point, radius = commander.rallyRadius;
        const active = commander.rallying, cooling = !active && commander.coolOff > 0;
        const ring = active ? RALLY_COLOR : cooling ? COOL_OFF_COLOR : look.rgb;
        const solid = active ? '#ffbe3b' : cooling ? '#ff5a70' : look.color;
        ctx.save();
        circle(ctx, x, y, radius + Math.sin(this.time * 4) * 4);
        ctx.strokeStyle = active ? `rgba(${ring}, 0.55)` : cooling ? `rgba(${ring}, 0.38)` : 'rgba(148, 214, 255, 0.1)';
        ctx.lineWidth = active ? 2.2 : 1.4;
        ctx.setLineDash(active ? [8, 5] : cooling ? [3, 4] : [2, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
        if (active) {
            const glow = radial(ctx, x, y, 0, radius, [[0, `rgba(${ring}, 0.20)`], [0.55, `rgba(${ring}, 0.07)`], [1, 'transparent']]);
            circle(ctx, x, y, radius); ctx.fillStyle = glow; ctx.fill();
            const inward = (this.time * 1.9) % 1;
            circle(ctx, x, y, radius * (1 - inward));
            ctx.strokeStyle = `rgba(${ring}, ${(inward * 0.42).toFixed(2)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.translate(x, y);
        ctx.rotate(this.time * (active ? 3.2 : 1.2));
        ctx.strokeStyle = solid;
        ctx.lineWidth = 1.8;
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(14, -4.5); ctx.lineTo(18, 0); ctx.lineTo(14, 4.5);
            ctx.stroke();
        }
        ctx.restore();
        circle(ctx, x, y, active ? 5.5 : 3);
        ctx.fillStyle = solid;
        ctx.fill();
        if (active || cooling) {
            this.label(active ? 'Rallying' : `Spreading · ${commander.coolOff.toFixed(1)}s`, x, y + 26, solid, `700 ${Math.round(13 * this.textScale)}px`);
        }
    }

    label(text, x, y, color, font = `600 ${Math.round(11 * this.textScale)}px`, pill = false) {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = `${font} "Chakra Petch", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (pill) {
            const w = (ctx.measureText(text)?.width ?? text.length * 6) + 14 * this.textScale;
            const h = 19 * this.textScale;
            ctx.fillStyle = 'rgba(6, 9, 19, 0.72)';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
            else ctx.rect(x - w / 2, y - h / 2, w, h);
            ctx.fill();
        }
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    /** Dual-layer beams from a recruiting ship to its target show pressure building. */
    drawTethers(boids, game) {
        const ctx = this.ctx, ticks = game.sim.rules.conversionTicks, reach = (game.sim.rules.conversionRadius * 1.5) ** 2;
        for (const boid of boids) {
            const source = boid.conversionSource;
            if (boid.conversionPressure <= 8 || !source || game.sim.commanders[source.team]?.disarmed) continue;
            // The source may have wrapped to the far edge or left; never draw a line across the arena.
            if ((source.pos.x - boid.pos.x) ** 2 + (source.pos.y - boid.pos.y) ** 2 > reach) continue;
            const ratio = Math.min(1, boid.conversionPressure / ticks);
            const rgb = game.palette(source.team).rgb;
            ctx.beginPath();
            ctx.moveTo(source.pos.x, source.pos.y);
            ctx.lineTo(boid.pos.x, boid.pos.y);
            ctx.strokeStyle = `rgba(${rgb}, ${(ratio * 0.32).toFixed(2)})`;
            ctx.lineWidth = 3 + ratio * 2;
            ctx.stroke();
            ctx.strokeStyle = `rgba(${rgb}, ${(0.45 + ratio * 0.45).toFixed(2)})`;
            ctx.lineWidth = 1.1;
            ctx.stroke();
        }
    }

    drawShockwaves(dt) {
        const ctx = this.ctx;
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const wave = this.shockwaves[i];
            wave.radius += (wave.maxRadius - wave.radius) * dt * 11 + (dt ? 10 : 0);
            wave.alpha -= dt * 2.1;
            if (wave.alpha <= 0 || wave.radius >= wave.maxRadius) { this.shockwaves.splice(i, 1); continue; }
            ctx.save();
            ctx.globalAlpha = Math.max(0, wave.alpha);
            circle(ctx, wave.x, wave.y, wave.radius);
            ctx.strokeStyle = wave.color;
            ctx.lineWidth = 3.2 * wave.alpha;
            ctx.stroke();
            if (wave.radius > 18) {
                ctx.globalAlpha = Math.max(0, wave.alpha * 0.45);
                circle(ctx, wave.x, wave.y, wave.radius * 0.82);
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    drawParticles(dt) {
        const ctx = this.ctx;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }
            const px = p.x, py = p.y;
            p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95;
            const alpha = p.life / p.maxLife;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(p.x + p.vx * 0.025, p.y + p.vy * 0.025);
            ctx.strokeStyle = `rgba(${p.rgb}, ${alpha.toFixed(2)})`;
            ctx.lineWidth = Math.max(1.2, p.size * alpha);
            ctx.lineCap = 'round';
            ctx.stroke();
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
            ctx.font = `700 ${Math.round(text.size * this.textScale)}px "Chakra Petch", system-ui, sans-serif`;
            ctx.fillStyle = text.color;
            ctx.globalAlpha = Math.max(0, Math.min(1, text.life * 1.25));
            ctx.textAlign = 'center';
            ctx.fillText(text.text, clamp(text.x, margin, w - margin), clamp(text.y, 64 * this.textScale, h - Math.min(150 * this.textScale, h * 0.24)));
            ctx.restore();
        }
    }

    drawVignette() {
        const { width, height } = this.canvas;
        this.vignette ||= radial(this.ctx, width / 2, height / 2, height * 0.38, height * 0.98, [[0, 'transparent'], [1, 'rgba(3, 5, 13, 0.62)']]);
        this.ctx.fillStyle = this.vignette;
        this.ctx.fillRect(0, 0, width, height);
    }

    // Terrain -------------------------------------------------------------

    drawTerrain(field, dt) {
        const pulse = Math.sin(this.time * 2 + field.x * 0.01) * 0.12 + 1, spin = this.time * (field.type === 'blackHole' ? 1.8 : 0.45);
        if (field.type === 'blackHole') this.drawBlackHole(field, pulse, spin, dt);
        else if (field.type === 'slowZone') this.drawNebula(field, pulse, spin);
        else this.drawAsteroids(field, spin);
        this.label(TERRAIN_TYPES[field.type].label.toUpperCase(), field.x, field.y - field.reach - 14, field.type === 'blackHole' ? '#d8b8ff' : '#b2d5e8', `700 ${Math.round(11 * this.textScale)}px`, true);
    }

    drawBlackHole(field, pulse, spin, dt) {
        const ctx = this.ctx, { x, y, radius, reach, core } = field;
        const pull = radial(ctx, x, y, core, reach, [[0, 'rgba(143, 82, 255, 0.34)'], [0.45, 'rgba(116, 48, 224, 0.12)'], [1, 'transparent']]);
        circle(ctx, x, y, reach); ctx.fillStyle = pull; ctx.fill();

        ctx.save();
        circle(ctx, x, y, reach);
        ctx.strokeStyle = 'rgba(168, 120, 255, 0.24)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 8]);
        ctx.stroke();
        ctx.restore();

        let particles = this.fieldParticles.get(field);
        if (!particles) this.fieldParticles.set(field, particles = []);
        if (dt && particles.length < 18 && Math.random() < 0.35) {
            particles.push({ angle: Math.random() * Math.PI * 2, dist: reach * (0.35 + Math.random() * 0.65), speed: 2.2 + Math.random() * 2, life: 1 + Math.random(), size: 1.8 + Math.random() * 2.2 });
        }
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt; p.angle += p.speed * dt;
            p.dist = Math.max(core, p.dist - dt * 16);
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            circle(ctx, x + Math.cos(p.angle) * p.dist, y + Math.sin(p.angle) * p.dist, p.size);
            ctx.fillStyle = `rgba(182, 134, 255, ${(p.life * 0.45).toFixed(2)})`;
            ctx.fill();
        }

        // Event horizon & photon rim
        const horizon = radial(ctx, x, y, 0, radius * pulse, [[0, '#020105'], [0.68, '#16062c'], [1, 'rgba(168, 92, 255, 0.45)']]);
        circle(ctx, x, y, radius * pulse);
        ctx.fillStyle = horizon;
        ctx.fill();
        circle(ctx, x, y, radius * 0.65);
        ctx.strokeStyle = 'rgba(216, 178, 255, 0.5)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Dual tilted accretion rings
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(spin);
        ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.55 * pulse, radius * 0.34 * pulse, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(176, 118, 255, 0.58)'; ctx.lineWidth = 2.4; ctx.stroke();
        ctx.rotate(-spin * 0.6 + 0.8);
        ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.28 * pulse, radius * 0.24 * pulse, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(235, 198, 255, 0.45)'; ctx.lineWidth = 1.3; ctx.stroke();
        ctx.restore();
    }

    drawNebula(field, pulse, spin) {
        const ctx = this.ctx, { x, y, radius } = field;
        const cloud = radial(ctx, x, y, 0, radius * pulse, [[0, 'rgba(22, 134, 224, 0.26)'], [0.55, 'rgba(34, 186, 204, 0.14)'], [1, 'transparent']]);
        circle(ctx, x, y, radius * pulse); ctx.fillStyle = cloud; ctx.fill();
        ctx.save(); ctx.translate(x, y); ctx.rotate(spin * 0.28);
        for (let i = 0; i < 3; i++) {
            const angle = i / 3 * Math.PI * 2 + this.time * 0.6, cx = Math.cos(angle) * radius * 0.36, cy = Math.sin(angle) * radius * 0.36;
            const swirl = radial(ctx, cx, cy, 0, radius * 0.44, [[0, i % 2 === 0 ? 'rgba(55, 226, 213, 0.16)' : 'rgba(64, 156, 255, 0.18)'], [1, 'transparent']]);
            circle(ctx, cx, cy, radius * 0.44); ctx.fillStyle = swirl; ctx.fill();
        }
        ctx.restore();
        circle(ctx, x, y, radius * pulse);
        ctx.strokeStyle = 'rgba(64, 186, 255, 0.32)'; ctx.lineWidth = 1.6; ctx.setLineDash([8, 8]); ctx.stroke(); ctx.setLineDash([]);
    }

    drawAsteroids(field, spin) {
        const ctx = this.ctx, { x, y, radius } = field;
        ctx.save(); ctx.translate(x, y); ctx.rotate(spin * 0.18);
        const dust = radial(ctx, 0, 0, 0, radius, [[0, 'rgba(130, 152, 186, 0.14)'], [1, 'transparent']]);
        circle(ctx, 0, 0, radius); ctx.fillStyle = dust; ctx.fill();
        for (let i = 0; i < 12; i++) {
            const angle = i / 12 * Math.PI * 2, dist = radius * (0.22 + (i % 3) * 0.24), size = 5 + (i % 4) * 2.8;
            const ax = Math.cos(angle) * dist, ay = Math.sin(angle) * dist;
            ctx.beginPath(); ctx.moveTo(ax + size, ay);
            for (let j = 1; j < 6; j++) {
                const a = j / 6 * Math.PI * 2, r = size * (0.72 + Math.sin(i * 3 + j) * 0.28);
                ctx.lineTo(ax + Math.cos(a) * r, ay + Math.sin(a) * r);
            }
            ctx.closePath();
            const shade = 74 + i * 7;
            ctx.fillStyle = `rgba(${shade}, ${shade + 8}, ${shade + 22}, 0.9)`;
            ctx.fill();
            ctx.strokeStyle = 'rgba(190, 212, 242, 0.48)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
        circle(ctx, x, y, radius);
        ctx.strokeStyle = 'rgba(164, 188, 218, 0.28)'; ctx.lineWidth = 1.3; ctx.setLineDash([5, 6]); ctx.stroke(); ctx.setLineDash([]);
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
            glow.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
            glow.addColorStop(0.35, `rgba(${look.rgb}, 0.5)`);
            glow.addColorStop(1, `rgba(${look.rgb}, 0)`);
            sctx.fillStyle = glow;
            sctx.fillRect(0, 0, 64, 64);
            this.auraColor = look.color;
        }
        const ctx = this.ctx, size = 11 * this.shipScale * (1 + Math.sin(this.time * 4) * 0.14);
        let sx = 0, sy = 0, n = 0;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.65;
        for (const boid of boids) {
            if (boid.team !== team) continue;
            ctx.drawImage(this.auraSprite, boid.pos.x - size, boid.pos.y - size, size * 2, size * 2);
            sx += boid.pos.x; sy += boid.pos.y; n++;
        }
        ctx.restore();
        if (!n) return null;
        // Anchor the tag to the ship nearest the fleet's centre so split fleets still point at real ships.
        const cx = sx / n, cy = sy / n;
        let anchor = null, best = Infinity;
        for (const boid of boids) {
            if (boid.team !== team) continue;
            const d = (boid.pos.x - cx) ** 2 + (boid.pos.y - cy) ** 2;
            if (d < best) { best = d; anchor = boid; }
        }
        return {
            x: anchor.pos.x,
            y: anchor.pos.y - 34 * this.textScale - Math.sin(this.time * 3) * 2.5,
            look,
        };
    }

    drawPlayerBadge(x, y, look) {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = `700 ${Math.round(13 * this.textScale)}px "Chakra Petch", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = (ctx.measureText('YOU')?.width ?? 24) + 18 * this.textScale, h = 22 * this.textScale;
        ctx.fillStyle = look.color;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
        else ctx.rect(x - w / 2, y - h / 2, w, h);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - 5 * this.textScale, y + h / 2); ctx.lineTo(x + 5 * this.textScale, y + h / 2); ctx.lineTo(x, y + h / 2 + 5.5 * this.textScale);
        ctx.fill();
        ctx.fillStyle = '#060913';
        ctx.fillText('YOU', x, y + 0.5);
        ctx.restore();
    }

    /** Dense fleets drop trails, panels and gradients to stay smooth on phones. */
    drawShips(boids, palette, conversionTicks = 36) {
        const dense = boids.length > 120, veryDense = boids.length > 180;
        const compact = Math.min(this.canvas.width, this.canvas.height) < 700;
        const options = Object.assign(this.shipOptions, { scale: this.shipScale, trail: !dense, thruster: !veryDense, panels: !dense, simple: dense, gradient: !dense && !compact });
        const looks = new Map();
        const ctx = this.ctx;
        for (const boid of boids) {
            let look = looks.get(boid.team);
            if (!look) { look = palette(boid.team); looks.set(boid.team, look); }
            const { x, y } = boid.pos, angle = Math.atan2(boid.vel.y, boid.vel.x), size = (boid.size ?? 9) * options.scale;
            if (boid.team === 'neutral') {
                // Unclaimed ships have a crisp diamond beacon silhouette.
                ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
                ctx.strokeStyle = look.color; ctx.fillStyle = 'rgba(205, 224, 245, 0.25)'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(size * 0.85, 0); ctx.lineTo(0, size * 0.52); ctx.lineTo(-size * 0.85, 0); ctx.lineTo(0, -size * 0.52); ctx.closePath();
                ctx.fill(); ctx.stroke();
                circle(ctx, 0, 0, 1.8); ctx.fillStyle = '#e2eeff'; ctx.fill();
                ctx.restore();
                continue;
            }
            if (options.simple && !boid.frozen && boid.conversionPressure <= 5 && !boid.justConverted) {
                const cos = Math.cos(angle), sin = Math.sin(angle);
                ctx.beginPath();
                ctx.moveTo(x + cos * size * 1.35, y + sin * size * 1.35);
                ctx.lineTo(x - cos * size * 0.8 + sin * size * 0.75, y - sin * size * 0.8 - cos * size * 0.75);
                ctx.lineTo(x - cos * size * 0.38, y - sin * size * 0.38);
                ctx.lineTo(x - cos * size * 0.8 - sin * size * 0.75, y - sin * size * 0.8 + cos * size * 0.75);
                ctx.closePath();
                ctx.fillStyle = look.color;
                ctx.fill();
                continue;
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
                ctx.strokeStyle = `rgba(${look.rgb}, 0.24)`; ctx.lineWidth = size * 0.32; ctx.lineCap = 'round'; ctx.stroke();
            }
            if (boid.conversionPressure > 5) {
                const ratio = Math.min(1, boid.conversionPressure / conversionTicks);
                circle(ctx, x, y, size * 1.55);
                ctx.fillStyle = `rgba(255, 255, 255, ${(ratio * 0.2).toFixed(2)})`;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x, y, size * 1.85, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
                ctx.strokeStyle = `rgba(255, 255, 255, ${(0.4 + ratio * 0.55).toFixed(2)})`;
                ctx.lineWidth = 1.8;
                ctx.stroke();
            }
            if (boid.frozen) {
                // Hexagonal crystalline stasis cage
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(this.time * 0.5 + boid.pulsePhase);
                ctx.beginPath();
                const r = size * 1.85;
                for (let k = 0; k < 6; k++) {
                    const a = k * Math.PI / 3;
                    if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
                    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                }
                ctx.closePath();
                ctx.fillStyle = 'rgba(121, 212, 242, 0.14)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(165, 233, 255, 0.85)';
                ctx.lineWidth = 1.4;
                ctx.stroke();
                ctx.restore();
            }
            if (boid.justConverted) {
                circle(ctx, x, y, size * 3.4);
                ctx.fillStyle = `rgba(${look.rgb}, 0.55)`;
                ctx.fill();
            }
            ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
            if (!boid.frozen && options.thruster) {
                const thrust = size * (0.85 + Math.sin(boid.pulsePhase * 3) * 0.3);
                ctx.beginPath(); ctx.moveTo(-size * 0.4, -size * 0.24); ctx.lineTo(-size * 0.4 - thrust, 0); ctx.lineTo(-size * 0.4, size * 0.24); ctx.closePath();
                if (options.gradient) {
                    const plume = ctx.createLinearGradient(0, 0, -thrust - size * 0.5, 0);
                    plume.addColorStop(0, '#ffffff');
                    plume.addColorStop(0.35, `rgba(${look.rgb}, 0.85)`);
                    plume.addColorStop(1, 'transparent');
                    ctx.fillStyle = plume;
                    ctx.fill();
                } else {
                    ctx.fillStyle = look.color; ctx.globalAlpha = 0.72; ctx.fill(); ctx.globalAlpha = 1;
                }
            }
            ctx.beginPath();
            ctx.moveTo(size * 1.35, 0); ctx.lineTo(-size * 0.8, size * 0.75); ctx.lineTo(-size * 0.38, 0); ctx.lineTo(-size * 0.8, -size * 0.75);
            ctx.closePath();
            ctx.fillStyle = boid.frozen ? '#79d4f2' : look.color;
            ctx.fill();
            circle(ctx, size * 0.16, 0, size * 0.24); ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'; ctx.fill();
            if (options.panels) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(size * 0.75, 0); ctx.lineTo(-size * 0.55, size * 0.48); ctx.moveTo(size * 0.75, 0); ctx.lineTo(-size * 0.55, -size * 0.48); ctx.stroke();
            }
            ctx.restore();
        }
    }
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function radial(ctx, x, y, r0, r1, stops) {
    const gradient = ctx.createRadialGradient(x, y, r0, x, y, r1);
    for (const [at, color] of stops) gradient.addColorStop(at, color);
    return gradient;
}
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
