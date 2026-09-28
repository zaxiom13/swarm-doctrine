// @ts-nocheck: a canvas art script that runs in the capture page, not in the app; it is checked by rendering it.
// A 31-second vertical promo, rendered frame by frame. Each shot is a real
// Simulation drawn by the game's own Renderer, with SVG titles on top and a
// soundtrack synthesized with an OfflineAudioContext. scripts/make-promo.ts
// drives this page in Chromium and encodes the frames to MP4.
import { Simulation } from '../../src/lib/simulation.ts';
import { createRules } from '../../src/lib/rules.ts';
import { Renderer } from '../../src/lib/renderer.ts';
import { TEAMS, NEUTRAL_LOOK, DUEL_LOOK } from '../../src/lib/catalog.ts';

export const FPS = 30;
export const DURATION = 31;
const W = 1080, H = 1920;

const canvas = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const renderer = new Renderer(canvas);
renderer.resize();
renderer.shipScale = 1.25;

// Helpers -------------------------------------------------------------------

function seeded(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const ease = t => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = t => (t = clamp(t), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

function world({ seed = 1, teams = ['dragon', 'salamander'], duel = false, time = 30 } = {}) {
    Math.random = seeded(seed * 7919);
    const sim = new Simulation({ width: renderer.width, height: renderer.height, rules: createRules(), random: seeded(seed) });
    sim.setTeams(teams);
    sim.time = time;
    sim.commander('dragon');
    renderer.clearEffects();
    return {
        sim, gameState: 'playing', playerTeam: 'dragon', gameMode: duel ? 'duel' : 'levels', practice: false, tutorial: null,
        input: { pointer: { x: -999, y: -999 }, freezeAiming: false },
        rivalName: () => 'Rival',
        palette(team) {
            if (team === 'neutral') return NEUTRAL_LOOK;
            if (duel) return team === 'dragon' ? DUEL_LOOK.you : DUEL_LOOK.rival;
            return TEAMS[team] || NEUTRAL_LOOK;
        },
    };
}
const P = (sim, fx, fy) => ({ x: sim.width * fx, y: sim.height * fy });
function ring(sim, team, count, c, r0, r1) {
    for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2, r = r0 + (i % 3) / 2 * (r1 - r0);
        sim.addBoid(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, team);
    }
}
function still(sim) { for (const b of sim.boids) { b.vel.x *= 0.15; b.vel.y *= 0.15; } }

// SVG title pieces -----------------------------------------------------------

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Words rise into place one after another, then fade out together. One <text>, so spacing stays natural. */
function headline(text, y, size, t, { at = 0, out = 99, color = '#ffffff', glow = '#6a4bff', weight = 700, spacing = 6, stagger = 0.09 } = {}) {
    const fadeOut = 1 - ease((t - out) / 0.35);
    // Relative dy keeps every word in one centred text chunk.
    let previous = 0;
    const list = text.split(' ');
    const words = list.map((word, i) => {
        const p = ease((t - at - i * stagger) / 0.45), offset = (1 - p) * size * 0.5, dy = offset - previous;
        previous = offset;
        return `<tspan dy="${dy}" fill-opacity="${p * fadeOut}">${esc(word)}${i < list.length - 1 ? ' ' : ''}</tspan>`;
    }).join('');
    if (t < at || fadeOut <= 0) return '';
    return `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="Chakra Petch" font-weight="${weight}" font-size="${size}" letter-spacing="${spacing}"
        fill="${color}" filter="url(#glow-${glow.slice(1)})" xml:space="preserve">${words}</text>`;
}

function subline(text, y, t, { at = 0, out = 99, size = 40, color = '#cfc6f5', spacing = 10 } = {}) {
    const p = ease((t - at) / 0.5) * (1 - ease((t - out) / 0.35));
    if (p <= 0) return '';
    return `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="Chakra Petch" font-weight="600" font-size="${size}" letter-spacing="${spacing * p}" fill="${color}" opacity="${p}">${esc(text.toUpperCase())}</text>`;
}

/** A chapter marker in the top-left, like a documentary. */
function chapter(numeral, label, t, dur) {
    const p = ease(t / 0.5) * (1 - ease((t - dur + 0.3) / 0.3));
    if (p <= 0) return '';
    const len = 150 * ease((t - 0.1) / 0.6);
    return `<g opacity="${p}" font-family="Chakra Petch">
        <text x="80" y="170" font-weight="700" font-size="44" fill="#37e2d5" letter-spacing="6">${numeral}</text>
        <line x1="80" y1="195" x2="${80 + len}" y2="195" stroke="#37e2d5" stroke-width="3"/>
        <text x="80" y="245" font-weight="600" font-size="30" fill="#cfc6f5" letter-spacing="10">${esc(label)}</text></g>`;
}

function flash(t, strength = 0.85) {
    const p = strength * (1 - ease(t / 0.28));
    return p > 0.01 ? `<rect width="${W}" height="${H}" fill="#fff8e0" opacity="${p}"/>` : '';
}

/** Five ships in a V, the game's mark. */
function mark(cx, cy, s, color = '#37e2d5', opacity = 1) {
    const ship = (x, y, k, o) => `<path transform="translate(${cx + x * s} ${cy + y * s}) scale(${k * s})" d="M0 -9 L6.5 7 L0 3.5 L-6.5 7 Z" fill="${color}" opacity="${o * opacity}"/>`;
    return ship(0, -14, 1.35, 1) + ship(-11, 0, 1.05, 0.85) + ship(11, 0, 1.05, 0.85) + ship(-21, 14, 0.8, 0.55) + ship(21, 14, 0.8, 0.55);
}

const DEFS = `<defs>
    ${['6a4bff', '37e2d5', 'ff3b3b', 'b6edff', 'ff6bd6', 'ffd23f'].map(c => `<filter id="glow-${c}" x="-20%" y="-50%" width="140%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="14" result="b"/><feFlood flood-color="#${c}" flood-opacity="0.75"/><feComposite in2="b" operator="in"/>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`).join('')}
    <linearGradient id="doctrine" x1="0" x2="1"><stop offset="0" stop-color="#37e2d5"/><stop offset="0.5" stop-color="#8f7bff"/><stop offset="1" stop-color="#ff6bd6"/></linearGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="75%"><stop offset="0.55" stop-color="#05021a" stop-opacity="0"/><stop offset="1" stop-color="#05021a" stop-opacity="0.9"/></radialGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05021a" stop-opacity="0.85"/><stop offset="0.22" stop-color="#05021a" stop-opacity="0"/>
        <stop offset="0.7" stop-color="#05021a" stop-opacity="0"/><stop offset="1" stop-color="#05021a" stop-opacity="0.9"/></linearGradient>
</defs>`;

// Shots ------------------------------------------------------------------------
// Each shot: start/end in seconds, setup() → game, act(game, t) before each
// simulation tick, zoom(t) for a slow camera push, and titles(t) → SVG.

const SHOTS = [
    {   // One ship, hunted.
        start: 0, end: 4,
        setup() {
            const g = world({ seed: 3 }), { sim } = g, c = P(sim, 0.5, 0.52);
            sim.addBoid(c.x, c.y, 'dragon').vel.set(0.6, -1.2);
            ring(sim, 'salamander', 36, c, 330, 420);
            still(sim);
            return g;
        },
        act(g, t) { if (t > 1.1) g.sim.commander('salamander').rally(g.sim.width / 2, g.sim.height * 0.52); },
        zoom: t => lerp(1.7, 1.25, easeInOut(t / 4)),
        titles: t => headline('ONE SHIP', 600, 150, t, { at: 0.3, out: 3.6 }) + subline('is prey', 700, t, { at: 1.6, out: 3.6, size: 46 }),
    },
    {   // The swarm.
        start: 4, end: 8,
        setup() {
            const g = world({ seed: 5, teams: ['dragon'] }), { sim } = g;
            sim.spawnCluster('dragon', 110, sim.width / 2, sim.height * 0.55, 260);
            return g;
        },
        act(g, t) {
            const { sim } = g, a = t * 1.3;
            sim.commander('dragon').rally(sim.width / 2 + Math.cos(a) * 140, sim.height * 0.55 + Math.sin(a) * 200);
        },
        zoom: t => lerp(1.0, 1.18, easeInOut(t / 4)),
        titles: t => chapter('I', 'THE SWARM', t, 4) + headline('A SWARM', 560, 150, t, { at: 0.25, out: 3.6 })
            + headline('IS AN EMPIRE', 720, 104, t, { at: 1.3, out: 3.6, glow: '#37e2d5', color: '#bdfbf6' }),
    },
    {   // Rally.
        start: 8, end: 12,
        setup() {
            const g = world({ seed: 8 }), { sim } = g;
            sim.spawnCluster('dragon', 70, sim.width * 0.35, sim.height * 0.82, 120);
            sim.spawnCluster('salamander', 16, sim.width * 0.6, sim.height * 0.3, 55);
            still(sim);
            return g;
        },
        act(g, t) {
            const { sim } = g, from = P(sim, 0.35, 0.8), to = P(sim, 0.58, 0.44), k = easeInOut((t - 0.3) / 2.6);
            const p = { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) };
            g.input.pointer = p;
            if (t > 0.3 && t < 3.6) sim.commander('dragon').rally(p.x, p.y); else sim.commander('dragon').release();
        },
        zoom: t => lerp(1.12, 1.3, easeInOut(t / 4)),
        titles: t => chapter('II', 'RALLY', t, 4) + headline('MOVE', 560, 170, t, { at: 0.2, out: 3.6, glow: '#ffd23f' })
            + headline('AS ONE', 730, 170, t, { at: 0.55, out: 3.6, glow: '#ffd23f' }) + subline('hold · drag · release', 1640, t, { at: 1.2, out: 3.6 }),
    },
    {   // Surround and convert.
        start: 12, end: 16,
        setup() {
            const g = world({ seed: 13 }), { sim } = g, c = P(sim, 0.5, 0.56);
            sim.spawnCluster('salamander', 16, c.x, c.y, 45);
            ring(sim, 'dragon', 54, c, 80, 150);
            still(sim);
            sim.canMove = () => false;
            g.converted = 0;
            return g;
        },
        act(g, t) { if (t > 2.4) g.sim.canMove = null; },
        zoom: t => lerp(1.45, 1.2, easeInOut(t / 4)),
        titles(t, g) {
            const n = g.sim.count('dragon') - 54;
            return chapter('III', 'RECRUIT', t, 4) + headline('SURROUND', 520, 150, t, { at: 0.15, out: 3.6 })
                + headline('CONVERT', 680, 150, t, { at: 1.2, out: 3.6, glow: '#37e2d5', color: '#bdfbf6' })
                + (n > 0 ? `<text x="${W / 2}" y="1620" text-anchor="middle" font-family="Chakra Petch" font-weight="700" font-size="120" fill="#37e2d5" filter="url(#glow-37e2d5)" opacity="${clamp((3.8 - t) / 0.3)}">+${n}</text>` : '');
        },
    },
    {   // Freeze.
        start: 16, end: 19.5,
        setup() {
            const g = world({ seed: 19 }), { sim } = g;
            sim.spawnCluster('dragon', 60, sim.width * 0.5, sim.height * 0.86, 110);
            sim.spawnCluster('salamander', 30, sim.width * 0.5, sim.height * 0.46, 120);
            still(sim);
            return g;
        },
        act(g, t) {
            const { sim } = g, me = sim.commander('dragon'), c = P(sim, 0.5, 0.46);
            if (t > 0.55 && !g.frozen) { g.frozen = true; me.freeze(c.x, c.y); renderer.addShockwave(c.x, c.y, me.freezeRadius, '#b6edff'); renderer.shake = 0.6; }
            if (t > 1.1 && t < 2.5) { g.input.pointer = c; me.rally(c.x, c.y + 20); } else if (t >= 2.5) me.release();
        },
        zoom: t => (t < 0.6 ? lerp(1.1, 1.2, t / 0.6) : lerp(1.32, 1.18, easeInOut((t - 0.6) / 2.9))),
        titles: t => chapter('IV', 'FREEZE', t, 3.5) + headline('FREEZE', 560, 180, t, { at: 0.55, out: 3.1, color: '#e8fbff', glow: '#b6edff', stagger: 0 })
            + headline('THEM COLD', 720, 110, t, { at: 0.95, out: 3.1, color: '#b6edff', glow: '#b6edff' }) + flash(t - 0.55, 0.55),
    },
    {   // The void.
        start: 19.5, end: 23,
        setup() {
            const g = world({ seed: 37 }), { sim } = g;
            sim.setTerrain([{ type: 'blackHole', ...P(sim, 0.5, 0.5), radius: 60 }, { type: 'slowZone', ...P(sim, 0.2, 0.25), radius: 130 }, { type: 'asteroid', ...P(sim, 0.82, 0.75), radius: 110 }]);
            sim.spawnCluster('dragon', 70, sim.width * 0.5, sim.height * 0.9, 110);
            return g;
        },
        act(g) { const { sim } = g; g.input.pointer = { x: -999, y: -999 }; sim.commander('dragon').rally(sim.width * 0.5, sim.height * 0.05); },
        zoom: t => lerp(1.0, 1.15, easeInOut(t / 3.5)),
        titles: t => chapter('V', 'TERRAIN', t, 3.5) + headline('RESPECT', 560, 150, t, { at: 0.2, out: 3.1, glow: '#ff6bd6' })
            + headline('THE VOID', 720, 150, t, { at: 0.6, out: 3.1, glow: '#ff6bd6', color: '#ffd9f4' }),
    },
    {   // Online duel.
        start: 23, end: 27,
        setup() {
            const g = world({ seed: 43, duel: true }), { sim } = g;
            sim.spawnCluster('dragon', 80, sim.width * 0.5, sim.height * 0.85, 130);
            sim.spawnCluster('salamander', 80, sim.width * 0.5, sim.height * 0.2, 130);
            sim.spawnCluster('neutral', 24, sim.width * 0.5, sim.height * 0.52, 140);
            still(sim);
            return g;
        },
        act(g, t) {
            const { sim } = g;
            sim.commander('salamander').rally(sim.width * 0.52, sim.height * 0.45);
            g.input.pointer = P(sim, 0.46, 0.6);
            if (t < 2.6) sim.commander('dragon').rally(sim.width * 0.46, sim.height * 0.6); else sim.commander('dragon').release();
            if (t > 2.6) sim.commander('salamander').release();
        },
        zoom: t => lerp(1.0, 1.12, easeInOut(t / 4)),
        titles(t) {
            const regions = ['EUROPE', 'AMERICAS', 'ASIA-PACIFIC', 'AFRICA & MIDDLE EAST'];
            const chips = regions.map((name, i) => {
                const p = ease((t - 1.3 - i * 0.12) / 0.4) * (1 - ease((t - 3.6) / 0.35)), y = 1500 + i * 78, w = 560;
                return p > 0 ? `<g opacity="${p}" transform="translate(${(1 - p) * 60} 0)"><rect x="${W / 2 - w / 2}" y="${y - 44}" width="${w}" height="60" rx="30" fill="#0d0826cc" stroke="#4cf0a8" stroke-width="2"/>
                    <circle cx="${W / 2 - w / 2 + 34}" cy="${y - 14}" r="8" fill="#4cf0a8"/><text x="${W / 2 + 14}" y="${y - 3}" text-anchor="middle" font-family="Chakra Petch" font-weight="600" font-size="30" letter-spacing="4" fill="#e9fff6">${esc(name)}</text></g>` : '';
            }).join('');
            return chapter('VI', 'ONLINE', t, 4) + headline('DUEL', 560, 190, t, { at: 0.2, out: 3.6, glow: '#37e2d5' })
                + headline('THE WORLD', 730, 140, t, { at: 0.55, out: 3.6, glow: '#37e2d5', color: '#bdfbf6' }) + chips
                + subline('live · peer to peer · no codes', 1830, t, { at: 1.6, out: 3.6, size: 32, color: '#4cf0a8' });
        },
    },
    {   // Title card.
        start: 27, end: 31,
        setup() {
            const g = world({ seed: 47, teams: ['dragon'] }), { sim } = g;
            sim.spawnCluster('dragon', 170, sim.width / 2, sim.height / 2, 330);
            return g;
        },
        act(g, t) { const { sim } = g, a = t * 0.9; sim.commander('dragon').rally(sim.width / 2 + Math.cos(a) * 200, sim.height / 2 + Math.sin(a) * 300, Infinity); },
        zoom: t => lerp(1.25, 1.05, easeInOut(t / 4)),
        titles(t) {
            const p = ease((t - 0.15) / 0.8), q = ease((t - 0.7) / 0.8), r = ease((t - 1.4) / 0.6), s = ease((t - 2.0) / 0.6);
            const out = 1 - ease((t - 3.5) / 0.5);
            return `<rect width="${W}" height="${H}" fill="#05021a" opacity="${0.55 * p}"/>
                <g opacity="${out}">
                ${mark(W / 2, 560 - (1 - p) * 40, 5.2, '#37e2d5', p)}
                <text x="${W / 2}" y="${900 + (1 - q) * 50}" text-anchor="middle" font-family="Chakra Petch" font-weight="700" font-size="230" letter-spacing="${lerp(60, 20, q)}" fill="#fff" opacity="${q}" filter="url(#glow-6a4bff)">SWARM</text>
                <text x="${W / 2}" y="1030" text-anchor="middle" font-family="Chakra Petch" font-weight="600" font-size="92" letter-spacing="${lerp(10, 44, q)}" fill="url(#doctrine)" opacity="${q}">DOCTRINE</text>
                <text x="${W / 2}" y="1140" text-anchor="middle" font-family="Chakra Petch" font-weight="600" font-size="38" letter-spacing="10" fill="#978cc7" opacity="${r}">MOVE TOGETHER · RECRUIT EVERYONE</text>
                <g opacity="${s}" transform="translate(0 ${(1 - s) * 30})">
                    <path d="M ${W / 2 - 330} 1290 h 640 l 20 20 v 80 l -20 20 h -640 l -20 -20 v -80 z" fill="#ffd23f" filter="url(#glow-ffd23f)"/>
                    <text x="${W / 2}" y="1368" text-anchor="middle" font-family="Chakra Petch" font-weight="700" font-size="48" letter-spacing="8" fill="#1d1200">PLAY FREE NOW</text>
                </g>
                <text x="${W / 2}" y="1500" text-anchor="middle" font-family="Chakra Petch" font-weight="600" font-size="32" letter-spacing="8" fill="#cfc6f5" opacity="${s}">IN YOUR BROWSER · PHONE OR DESKTOP</text>
                </g>
                <rect width="${W}" height="${H}" fill="#000" opacity="${ease((t - 3.6) / 0.4)}"/>`;
        },
    },
];

// Frame loop ---------------------------------------------------------------------

let current = null, game = null;

/** Draws frame `f`. Frames must be requested in order: the simulation carries state between them. */
globalThis.renderFrame = f => {
    const t = f / FPS;
    const shot = SHOTS.find(s => t >= s.start && t < s.end) ?? SHOTS[SHOTS.length - 1];
    const local = t - shot.start;
    if (shot !== current) {
        current = shot;
        game = shot.setup();
        // Let each shot settle for a moment so trails and motion are already there.
        for (let i = 0; i < 20; i++) { shot.act(game, 0); game.sim.step(); game.sim.drainEvents(); renderer.render(game, 1 / 60); }
    }
    for (let i = 0; i < 2; i++) {
        shot.act(game, local + i / 60);
        game.sim.step();
        for (const event of game.sim.drainEvents()) {
            if (event.type === 'destroyed') renderer.burst(event.x, event.y, '255, 120, 200');
            if (event.type === 'convert') renderer.burst(event.x, event.y, game.palette(event.to).rgb);
        }
        renderer.render(game, 1 / 60);
    }
    const zoom = shot.zoom(local);
    canvas.style.transform = `scale(${zoom})`;
    const cut = shot.start > 0 ? flash(local, 0.7) : '';
    overlay.innerHTML = `${DEFS}<rect width="${W}" height="${H}" fill="url(#vignette)"/><rect width="${W}" height="${H}" fill="url(#shade)"/>${shot.titles(local, game)}${cut}`;
};

globalThis.promoReady = document.fonts.ready.then(() => Promise.all(['400', '600', '700'].map(w => document.fonts.load(`${w} 40px "Chakra Petch"`))));

// Soundtrack -------------------------------------------------------------------------

/** Renders the soundtrack to a 16-bit stereo WAV, returned as base64. */
globalThis.renderSoundtrack = async () => {
    const rate = 44100, ctx = new OfflineAudioContext(2, DURATION * rate, rate);
    const master = ctx.createDynamicsCompressor();
    master.threshold.value = -16; master.ratio.value = 12; master.knee.value = 6; master.attack.value = 0.002;
    const out = ctx.createGain(); out.gain.value = 0.7;
    master.connect(out).connect(ctx.destination);
    const noise = ctx.createBuffer(1, rate * 2, rate);
    const nd = noise.getChannelData(0), rnd = seeded(99);
    for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;

    // A cinematic score: D minor strings, a driving low ostinato, war drums and brass hits.
    const hz = n => 440 * Math.pow(2, (n - 69) / 12);          // MIDI note → frequency
    // Shots follow i – VI – III – VII – iv – VI – VII – i.
    const chords = [[0, 4, [50, 57, 62, 65]], [4, 8, [46, 53, 58, 62]], [8, 12, [41, 53, 57, 60]], [12, 16, [48, 55, 60, 64]],
        [16, 19.5, [43, 55, 58, 62]], [19.5, 23, [46, 53, 58, 65]], [23, 27, [48, 55, 60, 67]], [27, 31, [38, 50, 57, 62, 65, 69]]];

    // Strings: several detuned saws with slow bows and a gentle vibrato.
    const vibrato = ctx.createOscillator(), depth = ctx.createGain();
    vibrato.frequency.value = 5; depth.gain.value = 6; vibrato.connect(depth); vibrato.start(0);
    for (const [a, b, notes] of chords) {
        const filter = ctx.createBiquadFilter(), g = ctx.createGain(), level = a >= 27 ? 0.075 : a >= 23 ? 0.065 : 0.05;
        filter.type = 'lowpass'; filter.Q.value = 0.7;
        filter.frequency.setValueAtTime(900, a); filter.frequency.linearRampToValueAtTime(a >= 23 ? 3200 : 2000, b);
        g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(level, a + (a === 0 ? 1.5 : 0.35));
        g.gain.setValueAtTime(level, b - 0.15); g.gain.linearRampToValueAtTime(0, b + (a === 27 ? 0 : 0.25));
        filter.connect(g).connect(master);
        for (const n of notes) for (const detune of [-7, 0, 7]) {
            const o = ctx.createOscillator();
            o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = detune;
            depth.connect(o.detune);
            o.connect(filter); o.start(a); o.stop(b + 0.3);
        }
    }

    // Low ostinato: short bowed eighths on the root, from the Rally onwards (≈ 100 bpm, 0.3 s eighths).
    const eighth = 0.3;
    for (const [a, b, notes] of chords.slice(2, 7)) {
        for (let at = a; at < b - 0.05; at += eighth) {
            const beat = Math.round((at - a) / eighth) % 8, n = notes[0] - 12 + (beat === 6 ? 7 : beat === 7 ? 3 : 0);
            const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
            o.type = 'sawtooth'; o.frequency.value = hz(n + 12);
            f.type = 'lowpass'; f.frequency.setValueAtTime(1400, at); f.frequency.exponentialRampToValueAtTime(300, at + 0.22);
            const accent = beat % 4 === 0 ? 0.2 : 0.12;
            g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(accent, at + 0.015); g.gain.exponentialRampToValueAtTime(0.001, at + 0.26);
            o.connect(f).connect(g).connect(master); o.start(at); o.stop(at + 0.3);
        }
    }

    // War drums: a deep skin with a pitch drop, plus the thud of the stick.
    const drum = (at, level = 0.9, pitch = 80) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(pitch, at); o.frequency.exponentialRampToValueAtTime(pitch * 0.5, at + 0.35);
        g.gain.setValueAtTime(level, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.7);
        o.connect(g).connect(master); o.start(at); o.stop(at + 0.75);
        const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), sg = ctx.createGain();
        s.buffer = noise; f.type = 'lowpass'; f.frequency.value = 700;
        sg.gain.setValueAtTime(level * 0.6, at); sg.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
        s.connect(f).connect(sg).connect(master); s.start(at, (at * 0.37) % 1); s.stop(at + 0.15);
    };
    const boom = (at, level = 1) => {
        drum(at, level, 60);
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(48, at); o.frequency.exponentialRampToValueAtTime(28, at + 1.8);
        g.gain.setValueAtTime(0.6 * level, at); g.gain.exponentialRampToValueAtTime(0.001, at + 2);
        o.connect(g).connect(master); o.start(at); o.stop(at + 2.1);
    };
    // Brass: a bright chord that swells open on every cut.
    const brass = (at, notes, level = 0.07, dur = 0.9) => {
        const f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.Q.value = 2;
        f.frequency.setValueAtTime(400, at); f.frequency.exponentialRampToValueAtTime(3500, at + 0.12); f.frequency.exponentialRampToValueAtTime(900, at + dur);
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + 0.04); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
        f.connect(g).connect(master);
        for (const n of notes) for (const detune of [-5, 5]) {
            const o = ctx.createOscillator();
            o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = detune;
            o.connect(f); o.start(at); o.stop(at + dur + 0.05);
        }
    };

    // The lone ship: slow, heavy drum strokes like a heartbeat.
    for (const at of [0.35, 1.55, 2.75, 3.35, 3.65]) drum(at, 0.6, 70);
    // Then a marching pattern that grows: 1 . . 1 . 1 1 . per bar of eight eighths.
    const pattern = [1, 0, 0, 1, 0, 1, 1, 0];
    for (let at = 4, i = 0; at < 26.95; at += eighth, i++) {
        const step = i % 8, full = at >= 16;
        if (pattern[step] || (full && step === 2) || (at >= 23 && step % 2 === 0)) drum(at, step === 0 ? 0.95 : 0.7, step === 0 ? 72 : 95);
    }
    // Snare-like rolls into the last shots.
    for (let at = 22.2; at < 23; at += 0.075) drum(at, 0.15 + (at - 22.2) * 0.6, 180);
    for (let at = 26.1; at < 27; at += 0.075) drum(at, 0.15 + (at - 26.1) * 0.7, 190);

    for (const [a, , notes] of chords.slice(1, 7)) { boom(a, 0.8); brass(a, notes.map(n => n + 12).slice(1)); }
    // Freeze: a glassy shimmer.
    for (const f of [1175, 1760, 2349]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.08, 16.55); g.gain.exponentialRampToValueAtTime(0.001, 18.4);
        o.connect(g).connect(master); o.start(16.55); o.stop(18.5);
    }
    // A swelling riser into the title, then the final hit with a full brass chord.
    const riser = ctx.createBufferSource(), rf = ctx.createBiquadFilter(), rg = ctx.createGain();
    riser.buffer = noise; riser.loop = true; rf.type = 'bandpass'; rf.Q.value = 2;
    rf.frequency.setValueAtTime(200, 25); rf.frequency.exponentialRampToValueAtTime(3000, 27);
    rg.gain.setValueAtTime(0.0001, 25); rg.gain.exponentialRampToValueAtTime(0.22, 26.95); rg.gain.linearRampToValueAtTime(0, 27);
    riser.connect(rf).connect(rg).connect(master); riser.start(25); riser.stop(27.05);
    boom(27, 1.2);
    brass(27, [50, 57, 62, 65, 69, 74], 0.08, 3.6);

    const audio = await ctx.startRendering();
    const frames = audio.length, data = new DataView(new ArrayBuffer(44 + frames * 4));
    const str = (at, s) => [...s].forEach((c, i) => data.setUint8(at + i, c.charCodeAt(0)));
    str(0, 'RIFF'); data.setUint32(4, 36 + frames * 4, true); str(8, 'WAVEfmt ');
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
    data.setUint32(24, rate, true); data.setUint32(28, rate * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true);
    str(36, 'data'); data.setUint32(40, frames * 4, true);
    const left = audio.getChannelData(0), right = audio.getChannelData(1);
    for (let i = 0; i < frames; i++) {
        data.setInt16(44 + i * 4, clamp(left[i], -1, 1) * 32767, true);
        data.setInt16(46 + i * 4, clamp(right[i], -1, 1) * 32767, true);
    }
    const bytes = new Uint8Array(data.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
};
