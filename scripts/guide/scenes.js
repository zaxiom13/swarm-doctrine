// Field-guide scenes. Each one builds a real Simulation, steps it into a
// telling moment, draws it with the game's own Renderer and then adds
// callouts. scripts/make-guide.mjs loads this page in Chromium once per device
// (capture.html?device=desktop|phone) and saves every scene to
// guide/<device>/<id>.webp, so the pictures always show the current rules and
// the controls that device actually has.
import { Simulation } from '../../js/simulation.js';
import { createRules } from '../../js/rules.js';
import { Renderer } from '../../js/renderer.js';
import { TEAMS, NEUTRAL_LOOK, DUEL_LOOK } from '../../js/catalog.js';

const DEVICE = new URLSearchParams(location.search).get('device') === 'phone' ? 'phone' : 'desktop';
const PHONE = DEVICE === 'phone';
const pick = (desktop, phone) => (PHONE ? phone : desktop);

const canvas = document.getElementById('stage');
const renderer = new Renderer(canvas);
renderer.resize();
if (PHONE) {
    // The capture page is 720 world units wide like a real phone, but drawn 1:1.
    // Match the ship and label sizes a 390px-wide phone would use.
    const realScale = 390 / 720;
    renderer.shipScale = Math.max(1, 0.75 / realScale);
    renderer.textScale = 1 / realScale;
}
// Callouts are sized to stay readable at the width each device shows them.
const TEXT_SCALE = pick(1.3, 1.75);
const STROKE = pick(1, 1.5);

function seeded(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A minimal stand-in for Game: just what the renderer reads. */
function world({ seed = 1, teams = ['dragon', 'salamander'], duel = false, time = 0 } = {}) {
    Math.random = seeded(seed * 7919);
    const sim = new Simulation({ width: renderer.width, height: renderer.height, rules: createRules(), random: seeded(seed) });
    sim.setTeams(teams);
    sim.time = time;
    sim.commander('dragon');
    const game = {
        sim, gameState: 'playing', playerTeam: 'dragon', gameMode: duel ? 'duel' : 'levels', practice: false, tutorial: null,
        input: { pointer: { x: -999, y: -999 }, freezeAiming: false },
        rivalName: () => 'Rival',
        palette(team) {
            if (team === 'neutral') return NEUTRAL_LOOK;
            if (duel) return team === 'dragon' ? DUEL_LOOK.you : DUEL_LOOK.rival;
            return TEAMS[team] || NEUTRAL_LOOK;
        },
    };
    renderer.clearEffects();
    return game;
}

/** Steps the world, drawing every frame so trails, pulses and effects advance. */
function run(game, seconds, each) {
    const ticks = Math.round(seconds * 60);
    for (let i = 0; i < ticks; i++) {
        each?.(i);
        game.sim.step();
        for (const event of game.sim.drainEvents()) {
            if (event.type === 'destroyed') renderer.burst(event.x, event.y, '255, 120, 200');
            if (event.type === 'freeze') renderer.addShockwave(event.x, event.y, event.radius, '#b6edff');
            if (event.type === 'convert') game.converted = (game.converted || 0) + 1;
        }
        renderer.render(game, 1 / 60);
    }
}

/** A point at a fraction of the arena, chosen per device: at(sim, [dx, dy], [px, py]). */
function at(sim, desktop, phone = desktop) {
    const [fx, fy] = pick(desktop, phone);
    return { x: sim.width * fx, y: sim.height * fy };
}
function cluster(sim, team, count, p, radius) { sim.spawnCluster(team, count, p.x, p.y, radius); }
function centre(sim, team) {
    let x = 0, y = 0, n = 0;
    for (const b of sim.boids) if (b.team === team) { x += b.pos.x; y += b.pos.y; n++; }
    return n ? { x: x / n, y: y / n } : null;
}
function still(sim) { for (const b of sim.boids) { b.vel.x *= 0.2; b.vel.y *= 0.2; } }

// Annotation layer, in world coordinates -------------------------------------

const ctx = renderer.ctx;
const INK = '#fff7d6';
const DARK = 'rgba(18,10,51,0.9)';

function begin() {
    // The game's backdrop is CSS; paint it under the frame so the picture stands alone.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    const { width, height } = canvas, sky = ctx.createRadialGradient(width * 0.5, height * 1.1, 0, width * 0.5, height * 1.1, Math.max(width, height) * 0.8);
    sky.addColorStop(0, '#2a1a70'); sky.addColorStop(1, '#0d0826');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    ctx.restore();
    ctx.save(); ctx.setTransform(renderer.viewScale, 0, 0, renderer.viewScale, 0, 0);
}
function end() { ctx.restore(); }

/** Word-wraps text to a width; explicit newlines are kept. */
function wrap(text, maxWidth) {
    const lines = [];
    for (const paragraph of String(text).split('\n')) {
        let line = '';
        for (const word of paragraph.split(' ')) {
            const next = line ? `${line} ${word}` : word;
            if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next;
        }
        lines.push(line);
    }
    return lines;
}

/** A rounded callout. Returns its rectangle so arrows can start at its edge. */
function tag(text, x, y, { color = '#ffd23f', ink = '#120a33', size = 20, align = 'center', maxWidth = null, scale = TEXT_SCALE } = {}) {
    size *= scale;
    ctx.save();
    ctx.font = `700 ${size}px Fredoka, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    const limit = maxWidth ?? renderer.width * pick(0.5, 0.86);
    const lines = wrap(text, limit - size * 1.1);
    const w = Math.max(...lines.map(line => ctx.measureText(line).width)) + size * 1.1, lh = size * 1.25, h = lines.length * lh + size * 0.55;
    let left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    left = Math.max(8, Math.min(renderer.width - w - 8, left));
    const top = Math.max(8, Math.min(renderer.height - h - 8, y - h / 2));
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(left, top, w, h, Math.min(h / 2, 16 * scale / 1.3)); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = ink; ctx.textAlign = 'center';
    lines.forEach((line, i) => ctx.fillText(line, left + w / 2, top + size * 0.3 + lh * (i + 0.5)));
    ctx.restore();
    return { left, right: left + w, top, bottom: top + h };
}

function arrow(x1, y1, x2, y2, { color = INK, bend = 0.2, width = 4, dash = null, head = true } = {}) {
    width *= STROKE;
    const mx = (x1 + x2) / 2 - (y2 - y1) * bend, my = (y1 + y2) / 2 + (x2 - x1) * bend;
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
    if (dash) ctx.setLineDash(dash.map(d => d * STROKE));
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
    ctx.setLineDash([]);
    if (head) {
        const a = Math.atan2(y2 - my, x2 - mx), s = 8 + width * 2.5;
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - Math.cos(a - 0.45) * s, y2 - Math.sin(a - 0.45) * s);
        ctx.lineTo(x2 - Math.cos(a + 0.45) * s, y2 - Math.sin(a + 0.45) * s);
        ctx.closePath(); ctx.fill();
    }
    ctx.restore();
}

/** A callout placed at an offset from a target, with an arrow to the target. */
function note(text, target, offset, { color = '#ffd23f', ink, size, gap = 26, bend = 0.15, ...rest } = {}) {
    const [dx, dy] = pick(...offset);
    const box = tag(text, target.x + dx, target.y + dy, { color, ink, size, ...rest });
    const sx = Math.max(box.left + 12, Math.min(box.right - 12, target.x)), sy = Math.max(box.top, Math.min(box.bottom, target.y));
    const d = Math.hypot(target.x - sx, target.y - sy);
    if (d > gap + 20) arrow(sx, sy, target.x - (target.x - sx) / d * gap, target.y - (target.y - sy) / d * gap, { color, bend });
    return box;
}

function ring(x, y, r, { color = INK, dash = [10, 8], width = 3 } = {}) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = width * STROKE; ctx.setLineDash(dash); ctx.stroke();
    ctx.restore();
}

/** A measured distance with a label, like a ruler. */
function span(x, y, r, angle, text, color = INK) {
    const x2 = x + Math.cos(angle) * r, y2 = y + Math.sin(angle) * r;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5 * STROKE;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    for (const [px, py] of [[x, y], [x2, y2]]) { ctx.beginPath(); ctx.arc(px, py, 4 * STROKE, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
    ctx.restore();
    tag(text, (x + x2) / 2, (y + y2) / 2 - 20 * STROKE, { color: DARK, ink: color, size: 16 });
}

/** A numbered step marker. */
function badge(n, x, y, color = '#ff6bd6') {
    const r = 20 * STROKE;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = `800 ${22 * STROKE}px Fredoka, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#120a33'; ctx.fillText(n, x, y + 1);
    ctx.restore();
}

/** Numbered steps stacked in a corner. */
function steps(list, x, y) {
    const gapY = 60 * STROKE;
    list.forEach(([text, color], i) => { badge(i + 1, x + 20 * STROKE, y + i * gapY); tag(text, x + 48 * STROKE, y + i * gapY, { color, align: 'left', size: 19 }); });
}

/** A mouse cursor on desktop, a fingertip with a touch ripple on phones. */
function pointer(x, y, { pressed = true } = {}) {
    ctx.save();
    ctx.translate(x, y);
    if (PHONE) {
        if (pressed) for (const [r, a] of [[46, 0.12], [30, 0.25]]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill(); }
        // A fingertip coming in from below.
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffd9c2'; ctx.strokeStyle = '#120a33'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-22, 110); ctx.lineTo(-22, 8); ctx.arc(0, 8, 22, Math.PI, 0); ctx.lineTo(22, 110); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff3ea'; ctx.beginPath(); ctx.ellipse(0, 6, 12, 14, 0, 0, Math.PI * 2); ctx.fill();
    } else {
        if (pressed) { ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill(); }
        ctx.rotate(-0.35);
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#120a33'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.lineTo(8, 23); ctx.lineTo(14, 36); ctx.lineTo(20, 33); ctx.lineTo(14, 21); ctx.lineTo(24, 20); ctx.closePath();
        ctx.fill(); ctx.stroke();
    }
    ctx.restore();
}

/** A small key-cap, e.g. for Space. */
function key(text, x, y) {
    ctx.save();
    ctx.font = '700 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 30;
    ctx.fillStyle = '#e9e4ff'; ctx.strokeStyle = '#120a33'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 21, w, 42, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(18,10,51,0.25)'; ctx.fillRect(x - w / 2 + 3, y + 13, w - 6, 5);
    ctx.fillStyle = '#120a33'; ctx.fillText(text, x, y - 1);
    ctx.restore();
    return w;
}

/** A mouse with one button highlighted. */
function mouse(x, y, button = 'left') {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#e9e4ff'; ctx.strokeStyle = '#120a33'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-24, -34, 48, 72, 24); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    if (button === 'left') { ctx.moveTo(0, -34); ctx.arcTo(-24, -34, -24, -8, 22); ctx.lineTo(-24, -6); ctx.lineTo(0, -6); }
    else { ctx.moveTo(0, -34); ctx.arcTo(24, -34, 24, -8, 22); ctx.lineTo(24, -6); ctx.lineTo(0, -6); }
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-24, -6); ctx.lineTo(24, -6); ctx.moveTo(0, -34); ctx.lineTo(0, -6); ctx.stroke();
    ctx.restore();
}

/**
 * The phone's Rally and Freeze buttons, drawn where the real ability bar sits
 * (104 CSS px circles, 22px apart, 16px from the bottom of a 390px screen).
 */
function phoneButtons(sim, { lit = null, freezeReady = true } = {}) {
    const u = 720 / 390, r = 52 * u, gap = 22 * u, y = sim.height - 16 * u - r;
    const spots = { rally: sim.width / 2 - gap / 2 - r, freeze: sim.width / 2 + gap / 2 + r };
    const draw = (id, x, colors, glyph, label, keyLabel) => {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
        const g = ctx.createRadialGradient(x, y - r * 0.4, 0, x, y, r);
        g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
        ctx.shadowBlur = 0;
        if (id === lit) { ctx.lineWidth = 8; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ring(x, y, r + 18, { color: '#ffffff', dash: [8, 8], width: 3 }); }
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `800 ${10 * u}px system-ui, sans-serif`; ctx.globalAlpha = 0.85; ctx.fillText(keyLabel, x, y - r * 0.62); ctx.globalAlpha = 1;
        ctx.font = `${30 * u}px system-ui, sans-serif`; ctx.fillText(glyph, x, y - r * 0.08);
        ctx.font = `700 ${15 * u}px Fredoka, system-ui, sans-serif`; ctx.fillText(label, x, y + r * 0.45);
        ctx.restore();
    };
    draw('rally', spots.rally, ['#ffb347', '#e0700a'], '◎', 'Rally', 'HOLD');
    if (freezeReady) draw('freeze', spots.freeze, ['#8ff5ee', '#1fb3c0'], '❄', 'Freeze', 'TAP');
    return { rally: { x: spots.rally, y, r }, freeze: { x: spots.freeze, y, r } };
}

/** Counts in a corner: "You 30 · Coral 8". */
function scoreboard(game, entries) {
    const text = entries.map(([team, name]) => `${name} ${game.sim.count(team)}`).join('   ·   ');
    tag(text, game.sim.width - 16, pick(34, 40), { color: DARK, ink: '#fff', size: 18, align: 'right', maxWidth: 9999 });
}

// Scenes -----------------------------------------------------------------

const SCENES = {
    fleets(game = world({ seed: 3, teams: ['dragon', 'salamander', 'phoenix'] })) {
        const { sim } = game;
        cluster(sim, 'dragon', 30, at(sim, [0.25, 0.55], [0.5, 0.72]), 90);
        cluster(sim, 'salamander', 14, at(sim, [0.72, 0.3], [0.25, 0.24]), 60);
        cluster(sim, 'phoenix', 12, at(sim, [0.78, 0.72], [0.75, 0.24]), 55);
        cluster(sim, 'neutral', 9, at(sim, [0.5, 0.78], [0.5, 0.47]), 55);
        still(sim);
        run(game, 0.5);
        begin();
        const you = centre(sim, 'dragon'), red = centre(sim, 'salamander'), orange = centre(sim, 'phoenix'), gray = centre(sim, 'neutral');
        note('This is you: one colour, marked YOU', you, [[30, -160], [0, 170]], { color: TEAMS.dragon.color });
        note('Rival fleet', red, [[-230, -10], [0, -130]], { color: TEAMS.salamander.color, ink: '#fff' });
        note('Another rival', orange, [[20, -110], [0, -130]], { color: TEAMS.phoenix.color });
        note('Gray ships belong to nobody', gray, [[-260, 30], [0, -110]], { color: NEUTRAL_LOOK.color });
        end();
    },

    'rally-hold'(game = world({ seed: 5 })) {
        const { sim } = game, player = sim.commander('dragon');
        cluster(sim, 'dragon', 32, at(sim, [0.2, 0.62], [0.3, 0.8]), 100);
        const from = at(sim, [0.3, 0.6], [0.35, 0.75]), to = at(sim, [0.66, 0.4], [0.62, 0.36]);
        run(game, 0.3);
        run(game, 1.25, i => {
            const t = Math.min(1, i / 40);
            const p = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
            game.input.pointer = p;
            player.rally(p.x, p.y);
        });
        begin();
        arrow(from.x, from.y, to.x - 30, to.y + 20, { dash: [2, 12], bend: 0.15, color: '#ffffffaa', width: 5 });
        pointer(to.x + 6, to.y + 6);
        tag(pick('Hold the left mouse button and drag', 'Hold a finger down and drag'), sim.width / 2, pick(60, 70), { color: '#ffaa00', maxWidth: pick(9999, 660) });
        note('Ships inside the orange ring follow', { x: to.x - 120, y: to.y + 110 }, [[-40, 170], [-60, 250]], { color: '#ffaa00' });
        if (!PHONE) { mouse(sim.width * 0.1, sim.height * 0.86, 'left'); tag('Left button', sim.width * 0.1 + 40, sim.height * 0.86, { color: DARK, ink: '#fff', size: 16, align: 'left' }); }
        end();
    },

    // Phones only: the latched Rally button.
    'tap-rally'(game = world({ seed: 7 })) {
        const { sim } = game, player = sim.commander('dragon');
        cluster(sim, 'dragon', 30, at(sim, [0.3, 0.6], [0.3, 0.5]), 90);
        const to = at(sim, [0.7, 0.4], [0.62, 0.26]);
        game.input.pointer = to;
        run(game, 1.1, () => player.rally(to.x, to.y));
        begin();
        const buttons = phoneButtons(sim, { lit: 'rally', freezeReady: false });
        badge(1, buttons.rally.x - buttons.rally.r - 40, buttons.rally.y - buttons.rally.r);
        note('Tap Rally: it stays on until you tap it again', { x: buttons.rally.x, y: buttons.rally.y - buttons.rally.r }, [[0, -160], [60, -170]], { color: '#ffaa00' });
        pointer(to.x + 6, to.y + 6);
        badge(2, to.x - 70, to.y - 70);
        tag('Tap where to go. Tap again to steer', sim.width / 2, 60, { color: '#ffaa00', maxWidth: 660 });
        end();
    },

    'rally-disarmed'(game = world({ seed: 8 })) {
        const { sim } = game, player = sim.commander('dragon');
        const target = at(sim, [0.55, 0.5], [0.45, 0.5]);
        cluster(sim, 'dragon', 32, target, 70);
        cluster(sim, 'salamander', 9, at(sim, [0.68, 0.5], [0.72, 0.5]), 40);
        game.input.pointer = target;
        still(sim);
        run(game, 0.7, () => player.rally(target.x, target.y));
        begin();
        pointer(target.x + 6, target.y + 6);
        tag('While you hold, your ships cannot recruit', sim.width / 2, pick(70, 70), { color: '#ffaa00', maxWidth: pick(9999, 660) });
        note('Nearby rivals get pushed away', centre(sim, 'salamander'), [[-60, 220], [-120, 280]], { color: TEAMS.salamander.color, ink: '#fff' });
        tag('Rally to get into position, then let go', sim.width / 2, sim.height - pick(60, 70), { color: DARK, ink: '#fff', size: 17 });
        end();
    },

    release(game = world({ seed: 11 })) {
        const { sim } = game, player = sim.commander('dragon');
        const target = at(sim, [0.52, 0.5], [0.45, 0.5]);
        cluster(sim, 'dragon', 34, { x: target.x - 20, y: target.y }, 45);
        cluster(sim, 'salamander', 9, at(sim, [0.62, 0.5], [0.66, 0.5]), 38);
        game.input.pointer = target;
        run(game, 1, () => player.rally(target.x, target.y));
        player.release();
        run(game, 0.22);
        begin();
        tag(pick('Let go of the mouse button', 'Lift your finger'), sim.width / 2, pick(70, 70), { color: '#ff6b6b', ink: '#fff' });
        tag('Your fleet blooms outward and surrounds what is nearby', sim.width / 2, pick(150, 170), { color: DARK, ink: '#fff', size: 17, maxWidth: pick(700, 660) });
        tag(`The red ring is a ${sim.rules.rallyCoolOff}s pause, then recruiting starts`, sim.width / 2, sim.height - pick(60, 90), { color: DARK, ink: '#ffb3b3', size: 17, maxWidth: pick(700, 660) });
        end();
    },

    recruit(game = world({ seed: 13 })) {
        recruitSetup(game);
        run(game, 0.42);
        const { sim } = game, c = game.recruitAt;
        begin();
        ring(c.x, c.y, sim.rules.conversionRadius, { color: '#ffffffbb', dash: [4, 6], width: 2 });
        span(c.x, c.y, sim.rules.conversionRadius, -2.5, `${sim.rules.conversionRadius}px`);
        tag(`${sim.rules.conversionThreshold}+ of your ships close by, outnumbering the defenders`, sim.width / 2, pick(110, 135), { color: '#ffd23f', maxWidth: pick(760, 660) });
        note('Lines show pressure building', { x: c.x + 20, y: c.y - 20 }, [[260, -130], [120, -170]], { color: TEAMS.dragon.color });
        note('The white halo fills, then the ship turns', { x: c.x + 15, y: c.y + 15 }, [[260, 170], [0, 260]], { color: '#ffffff' });
        scoreboard(game, [['dragon', 'You'], ['salamander', 'Coral']]);
        end();
    },

    recruited(game = world({ seed: 13 })) {
        recruitSetup(game);
        run(game, 1.3);
        const { sim } = game, c = game.recruitAt;
        for (const b of sim.boids) b.justConverted = false;
        renderer.render(game, 0);
        begin();
        tag(`+${game.converted || 0} ships. They fly for you now`, sim.width / 2, pick(110, 135), { color: TEAMS.dragon.color });
        note('Recruits can help take the next group', c, [[-280, 200], [0, 260]], { color: DARK, ink: '#fff', size: 17 });
        scoreboard(game, [['dragon', 'You'], ['salamander', 'Coral']]);
        end();
    },

    outnumbered(game = world({ seed: 17 })) {
        const { sim } = game;
        const c = at(sim, [0.5, 0.5], [0.5, 0.52]);
        cluster(sim, 'salamander', 26, { x: c.x + 30, y: c.y }, 70);
        cluster(sim, 'dragon', 6, { x: c.x - 50, y: c.y + 10 }, 26);
        sim.canMove = () => false;
        run(game, 0.45);
        begin();
        note('Too few! The bigger group recruits YOUR ships', centre(sim, 'dragon') || c, [[-200, -210], [0, -280]], { color: TEAMS.salamander.color, ink: '#fff' });
        tag('Keep your fleet together. Only attack groups you outnumber', sim.width / 2, sim.height - pick(70, 110), { color: '#ffd23f', size: 18, maxWidth: pick(760, 660) });
        scoreboard(game, [['dragon', 'You'], ['salamander', 'Coral']]);
        end();
    },

    'freeze-aim'(game = world({ seed: 19, time: 30 })) {
        const { sim } = game;
        freezeSetup(game);
        const c = game.freezeAt;
        game.input.pointer = c; game.input.freezeAiming = true;
        run(game, 0.1);
        begin();
        span(c.x, c.y, sim.commander('dragon').freezeRadius, pick(0.35, 0.6), `${sim.rules.freezeRadius}px`, '#b6edff');
        if (PHONE) {
            const buttons = phoneButtons(sim, { lit: 'freeze' });
            badge(1, buttons.freeze.x + buttons.freeze.r + 34, buttons.freeze.y - buttons.freeze.r);
            tag('Tap ❄ Freeze', buttons.freeze.x, buttons.freeze.y - buttons.freeze.r - 60, { color: '#b6edff' });
            pointer(c.x + 4, c.y + 4);
            badge(2, c.x - 60, c.y - 60);
            tag('Then tap the rival group', sim.width / 2, 60, { color: '#b6edff' });
        } else {
            pointer(c.x + 4, c.y + 4, { pressed: false });
            tag('Point at a rival group', c.x, 70, { color: '#b6edff' });
            const y = sim.height - 70, w = key('Space', sim.width * 0.2, y);
            tag('or', sim.width * 0.2 + w / 2 + 30, y, { color: DARK, ink: '#fff', size: 16 });
            mouse(sim.width * 0.2 + w / 2 + 90, y, 'right');
            tag('right-click', sim.width * 0.2 + w / 2 + 125, y, { color: DARK, ink: '#fff', size: 16, align: 'left' });
        }
        end();
    },

    'freeze-hit'(game = world({ seed: 19, time: 30 })) {
        const { sim } = game;
        freezeSetup(game);
        const c = game.freezeAt;
        sim.commander('dragon').freeze(c.x, c.y);
        run(game, 0.18);
        begin();
        const f = sim.boids.filter(b => b.frozen).sort((a, b) => a.pos.y - b.pos.y)[0];
        tag(`Half the rivals in range stop for ${sim.rules.freezeDuration} seconds`, sim.width / 2, pick(80, 80), { color: '#b6edff', maxWidth: pick(9999, 660) });
        if (f) note('Gray hull + crosshair = frozen', f.pos, [[-260, 170], [0, 200]], { color: '#b6edff' });
        tag('Frozen ships cannot move, recruit or defend', sim.width / 2, sim.height - pick(60, 80), { color: DARK, ink: '#fff', size: 17, maxWidth: pick(9999, 660) });
        end();
    },

    'freeze-recruit'(game = world({ seed: 23, time: 30, teams: ['dragon', 'phoenix'] })) {
        const { sim } = game, player = sim.commander('dragon');
        const c = at(sim, [0.6, 0.5], [0.5, 0.42]);
        cluster(sim, 'phoenix', 16, c, 60);
        cluster(sim, 'dragon', 30, { x: c.x + pick(-260, 0), y: c.y + pick(20, 220) }, 70);
        still(sim);
        run(game, 0.1);
        player.freeze(c.x, c.y);
        run(game, pick(0.9, 1.2), () => player.rally(c.x + pick(-20, 0), c.y + pick(0, 20)));
        player.release();
        run(game, 0.75);
        begin();
        steps([['Freeze the group', '#b6edff'], [pick('Hold and drag onto it', 'Drag your fleet onto it'), '#ffaa00'], ['Let go to recruit', TEAMS.dragon.color]], 24, pick(70, sim.height - 230));
        scoreboard(game, [['dragon', 'You'], ['phoenix', 'Amber']]);
        end();
    },

    asteroids(game = world({ seed: 29 })) {
        const { sim } = game, player = sim.commander('dragon');
        const rock = at(sim, [0.5, 0.45], [0.5, 0.45]);
        sim.setTerrain([{ type: 'asteroid', ...rock, radius: 110 }]);
        cluster(sim, 'dragon', 30, at(sim, [0.2, 0.45], [0.5, 0.88]), 70);
        const target = at(sim, [0.82, 0.45], [0.5, 0.08]);
        game.input.pointer = target;
        run(game, pick(1.45, 1.6), () => player.rally(target.x, target.y));
        begin();
        tag('Asteroids knock ships off course. No losses, just scattering', sim.width / 2, pick(90, sim.height * 0.22), { color: '#c9c9c9', maxWidth: pick(700, 660) });
        tag('Steer around to keep your fleet together', sim.width / 2, sim.height - pick(60, 70), { color: DARK, ink: '#fff', size: 17, maxWidth: pick(9999, 660) });
        end();
    },

    nebula(game = world({ seed: 31 })) {
        const { sim } = game, player = sim.commander('dragon');
        const cloud = at(sim, [0.48, 0.48], [0.5, 0.5]);
        sim.setTerrain([{ type: 'slowZone', ...cloud, radius: 150 }]);
        cluster(sim, 'dragon', 32, at(sim, [0.16, 0.48], [0.5, 0.9]), 70);
        const target = at(sim, [0.86, 0.48], [0.5, 0.08]);
        game.input.pointer = target;
        run(game, pick(2.7, 2.4), () => player.rally(target.x, target.y));
        begin();
        tag('Blue nebulae slow every ship inside', sim.width / 2, pick(70, sim.height * 0.24), { color: '#6aa8ff' });
        tag('Keep holding so the stragglers catch up', sim.width / 2, sim.height - pick(60, 70), { color: DARK, ink: '#fff', size: 17, maxWidth: pick(9999, 660) });
        end();
    },

    'black-hole'(game = world({ seed: 37 })) {
        const { sim } = game, player = sim.commander('dragon');
        const hole = at(sim, [0.5, 0.42], [0.5, 0.45]);
        sim.setTerrain([{ type: 'blackHole', ...hole, radius: 34 }]);
        cluster(sim, 'dragon', 34, at(sim, [0.18, 0.44], [0.5, 0.88]), 70);
        const target = at(sim, [0.84, 0.42], [0.5, 0.05]);
        game.input.pointer = target;
        run(game, pick(1.55, 1.75), () => player.rally(target.x, target.y));
        const lost = 34 - sim.count('dragon');
        begin();
        const field = sim.terrain[0];
        ring(field.x, field.y, field.reach, { color: '#ff6bd6', dash: [6, 8], width: 2 });
        note('The glow pulls ships in. The dark core destroys them', { x: field.x, y: field.y - field.reach }, [[0, -120], [0, -150]], { color: '#ff6bd6' });
        tag(`Flying straight through cost ${lost} ship${lost === 1 ? '' : 's'}`, sim.width / 2, sim.height - pick(60, 70), { color: '#ff6b6b', ink: '#fff' });
        end();
    },

    neutrals(game = world({ seed: 41 })) {
        const { sim } = game;
        const c = at(sim, [0.58, 0.5], [0.55, 0.45]);
        cluster(sim, 'neutral', 12, c, 60);
        for (let i = 0; i < 16; i++) {
            const a = Math.PI * 0.55 + i / 16 * Math.PI * 0.9, r = 95 + (i % 2) * 18;
            sim.addBoid(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, 'dragon');
        }
        sim.canMove = () => false;
        run(game, 0.5);
        begin();
        const n = sim.boids.filter(b => b.team === 'neutral').sort((a, b) => b.pos.x - a.pos.x)[0];
        note('Gray diamond = nobody’s ship', n.pos, [[150, -170], [-60, -250]], { color: NEUTRAL_LOOK.color });
        tag('They never fight back. Whoever surrounds them first gets them', sim.width / 2, sim.height - pick(80, 120), { color: '#ffd23f', size: 18, maxWidth: pick(760, 660) });
        end();
    },

    duel(game = world({ seed: 43, duel: true, time: 30 })) {
        const { sim } = game, rival = sim.commander('salamander'), player = sim.commander('dragon');
        cluster(sim, 'dragon', 40, at(sim, [0.2, 0.3], [0.3, 0.85]), 100);
        cluster(sim, 'salamander', 40, at(sim, [0.8, 0.7], [0.7, 0.15]), 100);
        cluster(sim, 'neutral', 14, at(sim, [0.5, 0.5], [0.5, 0.5]), 90);
        const r = at(sim, [0.6, 0.55], [0.6, 0.38]), p = at(sim, [0.4, 0.42], [0.4, 0.64]);
        game.input.pointer = p;
        run(game, 1.6, () => { rival.rally(r.x, r.y); player.rally(p.x, p.y); });
        begin();
        note('You are blue', centre(sim, 'dragon'), [[-150, -120], [-150, 150]], { color: DUEL_LOOK.you.color });
        note('The rival is orange. Its Rally point shows its plan', r, [[190, -150], [60, -230]], { color: '#ffad7d' });
        tag(`Race for the gray ships: ${sim.rules.duelNeutralWave} more every ${sim.rules.duelNeutralInterval}s`, sim.width / 2, sim.height - 60, { color: NEUTRAL_LOOK.color, size: 18, maxWidth: pick(9999, 660) });
        end();
    },

    survival(game = world({ seed: 53, teams: ['dragon', 'salamander', 'phoenix'] })) {
        const { sim } = game;
        sim.spawnBlob('dragon', 26, sim.width / 2, sim.height / 2, 120);
        const edges = PHONE ? [['salamander', 0.5, 0.06, 0, 1], ['phoenix', 0.5, 0.94, 0, -1]] : [['salamander', 0.05, 0.5, 1, 0], ['phoenix', 0.95, 0.5, -1, 0]];
        for (const [team, ex, ey, dx, dy] of edges) {
            for (let i = 0; i < 12; i++) {
                const spreadX = dx ? 0.12 : 0.3, spreadY = dy ? 0.12 : 0.3;
                const b = sim.addBoid((ex + (sim.random() - 0.5) * spreadX) * sim.width, (ey + (sim.random() - 0.5) * spreadY) * sim.height, team);
                b.vel.set(dx * sim.rules.maxSpeed * 0.6, dy * sim.rules.maxSpeed * 0.6);
            }
        }
        run(game, 0.9);
        begin();
        for (const [team, , , dx, dy] of edges) {
            const c = centre(sim, team);
            arrow(c.x + dx * 50, c.y + dy * 50, c.x + dx * 170, c.y + dy * 170, { color: TEAMS[team].color, bend: 0 });
        }
        tag('Wave 2', pick(sim.width / 2, sim.width * 0.2), pick(60, sim.height / 2), { color: '#ff4444', ink: '#fff', size: 24 });
        tag('Rivals pour in from the edges. Upgrade every 2 waves', pick(sim.width / 2, sim.width * 0.62), pick(sim.height - 70, sim.height * 0.36), { color: '#ffd23f', size: 18, maxWidth: pick(9999, 420) });
        end();
    },

    victory(game = world({ seed: 47 })) {
        const { sim } = game;
        const c = at(sim, [0.5, 0.52], [0.5, 0.52]);
        cluster(sim, 'dragon', 70, c, 190);
        run(game, 2.5, () => sim.commander('dragon').rally(c.x, c.y));
        begin();
        tag('Every ship in your colour: you win', sim.width / 2, pick(70, 110), { color: TEAMS.dragon.color, size: 24 });
        scoreboard(game, [['dragon', 'You'], ['salamander', 'Coral']]);
        end();
    },
};

function recruitSetup(game) {
    const { sim } = game;
    const c = game.recruitAt = at(sim, [0.55, 0.5], [0.5, 0.5]);
    sim.spawnCluster('salamander', 8, c.x, c.y, 30);
    for (let i = 0; i < 30; i++) {
        const a = i / 30 * Math.PI * 2, r = 48 + (i % 3) * 16;
        sim.addBoid(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, 'dragon');
    }
    sim.canMove = () => false;
}

function freezeSetup(game) {
    const { sim } = game;
    cluster(sim, 'dragon', 32, at(sim, [0.22, 0.55], [0.5, 0.86]), 90);
    const c = game.freezeAt = at(sim, [0.62, 0.48], [0.5, 0.36]);
    cluster(sim, 'salamander', 16, c, 110);
    run(game, 0.6);
}

/** Scenes that only make sense on one kind of device. */
const ONLY = { 'tap-rally': 'phone' };
const IDS = Object.keys(SCENES).filter(id => !ONLY[id] || ONLY[id] === DEVICE);

/** Annotates a screenshot of the real HUD with the rectangles of its controls. */
globalThis.annotateHud = async (url, rects, scale, type = 'image/webp', quality = 0.86) => {
    await document.fonts?.ready;
    const image = new Image();
    image.src = url;
    await image.decode();
    canvas.width = image.width; canvas.height = image.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(image, 0, 0);
    ctx.scale(scale, scale);
    const k = pick(1, 1.1);
    const box = r => { ctx.save(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.roundRect(r.x - 4, r.y - 4, r.width + 8, r.height + 8, 12); ctx.stroke(); ctx.restore(); };
    const mid = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    const notes = PHONE ? [
        ['pause', 'Pause', 0, 150, 'left'],
        ['timer', 'Time & score', 0, 100],
        ['details', 'Arena share', -10, 150, 'right'],
        ['rally', 'Tap Rally, then tap where to go', 60, -110],
        ['freeze', 'Tap Freeze, then tap rivals', -60, -190],
    ] : [
        ['pause', 'Pause · Esc or P', 0, 110, 'left'],
        ['timer', 'Match time & score', 0, 120],
        ['guide', 'Hints', -170, 100],
        ['details', 'Share of the arena & fleet sizes', 10, 190, 'right'],
        ['rally', 'Rally (mainly for touch)', -40, -120, 'right'],
        ['freeze', 'Freeze · Space counts down until ready', 40, -120, 'left'],
    ];
    const W = image.width / scale;
    for (const [id, text, dx, dy, align = 'center'] of notes) {
        const r = rects[id];
        if (!r) continue;
        box(r);
        const m = mid(r), ty = m.y + dy, edge = dy > 0 ? r.y + r.height + 8 : r.y - 8;
        arrow(m.x + dx * 0.5, ty + (dy > 0 ? -14 : 14), m.x, edge, { color: '#ffd23f', bend: 0.1, width: 3 / STROKE });
        const size = 17 * k;
        ctx.save();
        ctx.font = `700 ${size}px Fredoka, system-ui, sans-serif`;
        const w = ctx.measureText(text).width + size * 1.1, h = size * 1.8;
        let left = align === 'left' ? m.x + dx : align === 'right' ? m.x + dx - w : m.x + dx - w / 2;
        left = Math.max(6, Math.min(W - w - 6, left));
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.roundRect(left, ty - h / 2, w, h, h / 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#120a33'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
        ctx.fillText(text, left + w / 2, ty + 1);
        ctx.restore();
    }
    return canvas.toDataURL(type, quality);
};

/** Renders one scene and returns it as a data URL. */
globalThis.renderScene = async (id, type = 'image/webp', quality = 0.86) => {
    await document.fonts?.ready;
    SCENES[id]();
    return canvas.toDataURL(type, quality);
};
globalThis.sceneIds = IDS;
globalThis.device = DEVICE;
