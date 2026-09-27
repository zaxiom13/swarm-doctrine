// Field-guide scenes. Each one builds a real Simulation, steps it into a
// telling moment, draws it with the game's own Renderer and then adds
// callouts. scripts/make-guide.mjs loads this page in Chromium and saves every
// scene to guide/<id>.webp, so the pictures always show the current rules.
import { Simulation } from '../../js/simulation.js';
import { createRules } from '../../js/rules.js';
import { Renderer } from '../../js/renderer.js';
import { TEAMS, NEUTRAL_LOOK, DUEL_LOOK } from '../../js/catalog.js';

const canvas = document.getElementById('stage');
const renderer = new Renderer(canvas);
renderer.resize();

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

function point(sim, fx, fy) { return { x: sim.width * fx, y: sim.height * fy }; }
function centre(sim, team) {
    let x = 0, y = 0, n = 0;
    for (const b of sim.boids) if (b.team === team) { x += b.pos.x; y += b.pos.y; n++; }
    return n ? { x: x / n, y: y / n } : null;
}
function still(sim, team) { for (const b of sim.boids) if (!team || b.team === team) { b.vel.x *= 0.2; b.vel.y *= 0.2; } }

// Annotation layer, in world coordinates -------------------------------------

const ctx = renderer.ctx;
const INK = '#fff7d6';
// Callouts are sized to stay readable when the picture is shown at phone width.
const TEXT_SCALE = 1.3;
function begin() {
    // The game's backdrop is CSS; paint it under the frame so the picture stands alone.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    const { width, height } = canvas, sky = ctx.createRadialGradient(width * 0.5, height * 1.1, 0, width * 0.5, height * 1.1, width * 0.8);
    sky.addColorStop(0, '#2a1a70'); sky.addColorStop(1, '#0d0826');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    ctx.restore();
    ctx.save(); ctx.setTransform(renderer.viewScale, 0, 0, renderer.viewScale, 0, 0);
}
function end() { ctx.restore(); }

function tag(text, x, y, { color = '#ffd23f', ink = '#120a33', size = 20, align = 'center' } = {}) {
    size *= TEXT_SCALE;
    ctx.save();
    ctx.font = `700 ${size}px Fredoka, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    const lines = String(text).split('\n');
    const w = Math.max(...lines.map(line => ctx.measureText(line).width)) + size * 1.1, lh = size * 1.25, h = lines.length * lh + size * 0.55;
    const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(left, y - h / 2, w, h, Math.min(h / 2, 16)); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = ink; ctx.textAlign = 'center';
    lines.forEach((line, i) => ctx.fillText(line, left + w / 2, y - h / 2 + size * 0.3 + lh * (i + 0.5)));
    ctx.restore();
    return { left, right: left + w, top: y - h / 2, bottom: y + h / 2 };
}

function arrow(x1, y1, x2, y2, { color = INK, bend = 0.2, width = 4, dash = null, head = true } = {}) {
    const mx = (x1 + x2) / 2 - (y2 - y1) * bend, my = (y1 + y2) / 2 + (x2 - x1) * bend;
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
    if (dash) ctx.setLineDash(dash);
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

function ring(x, y, r, { color = INK, dash = [10, 8], width = 3, fill = null } = {}) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke();
    ctx.restore();
}

/** A measured distance with a label, like a ruler. */
function span(x, y, r, angle, text, color = INK) {
    const x2 = x + Math.cos(angle) * r, y2 = y + Math.sin(angle) * r;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    for (const [px, py] of [[x, y], [x2, y2]]) { ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
    ctx.restore();
    tag(text, (x + x2) / 2, (y + y2) / 2 - 18, { color: 'rgba(18,10,51,0.88)', ink: color, size: 16 });
}

/** A numbered step marker. */
function badge(n, x, y, color = '#ff6bd6') {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '800 22px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#120a33'; ctx.fillText(n, x, y + 1);
    ctx.restore();
}

/** A pointer/finger glyph showing where the player is pressing. */
function finger(x, y, { pressed = true } = {}) {
    ctx.save();
    ctx.translate(x, y);
    if (pressed) { ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill(); }
    ctx.rotate(-0.35);
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#120a33'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.lineTo(8, 23); ctx.lineTo(14, 36); ctx.lineTo(20, 33); ctx.lineTo(14, 21); ctx.lineTo(24, 20); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
}

/** A small key-cap, e.g. for Space. */
function key(text, x, y) {
    ctx.save();
    ctx.font = '700 17px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 26;
    ctx.fillStyle = '#e9e4ff'; ctx.strokeStyle = '#120a33'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 17, w, 34, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(18,10,51,0.25)'; ctx.fillRect(x - w / 2 + 3, y + 10, w - 6, 4);
    ctx.fillStyle = '#120a33'; ctx.fillText(text, x, y - 1);
    ctx.restore();
}

/** Counts in a corner: "You 30 · Coral 8". */
function scoreboard(game, entries) {
    const text = entries.map(([team, name]) => `${name} ${game.sim.count(team)}`).join('   ·   ');
    tag(text, game.sim.width - 24, 34, { color: 'rgba(18,10,51,0.85)', ink: '#fff', size: 18, align: 'right' });
}

// Scenes -----------------------------------------------------------------

export const SCENES = {
    // 1. Who is who.
    fleets(game = world({ seed: 3, teams: ['dragon', 'salamander', 'phoenix'] })) {
        const { sim } = game;
        sim.spawnCluster('dragon', 30, ...Object.values(point(sim, 0.25, 0.55)), 90);
        sim.spawnCluster('salamander', 14, ...Object.values(point(sim, 0.7, 0.3)), 60);
        sim.spawnCluster('phoenix', 12, ...Object.values(point(sim, 0.76, 0.72)), 55);
        sim.spawnCluster('neutral', 9, ...Object.values(point(sim, 0.5, 0.78)), 55);
        still(sim);
        run(game, 0.5);
        begin();
        const you = centre(sim, 'dragon'), red = centre(sim, 'salamander'), orange = centre(sim, 'phoenix'), gray = centre(sim, 'neutral');
        tag('Your fleet\nall one colour, marked YOU', you.x + 20, you.y - 150, { color: TEAMS.dragon.color });
        tag('Rival fleet', red.x - 190, red.y - 20, { color: TEAMS.salamander.color, ink: '#fff' });
        arrow(red.x - 120, red.y - 10, red.x - 60, red.y, { color: TEAMS.salamander.color });
        tag('Another rival', orange.x + 20, orange.y - 105, { color: TEAMS.phoenix.color });
        tag('Gray ships\nbelong to nobody', gray.x - 250, gray.y + 20, { color: NEUTRAL_LOOK.color });
        arrow(gray.x - 150, gray.y + 20, gray.x - 60, gray.y, { color: NEUTRAL_LOOK.color });
        end();
    },

    // 2. Hold and drag.
    'rally-hold'(game = world({ seed: 5 })) {
        const { sim } = game, player = sim.commander('dragon');
        sim.spawnCluster('dragon', 32, ...Object.values(point(sim, 0.2, 0.62)), 110);
        const from = point(sim, 0.3, 0.6), to = point(sim, 0.66, 0.4);
        run(game, 0.3);
        run(game, 1.25, i => {
            const t = Math.min(1, i / 40);
            const p = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
            game.input.pointer = p;
            player.rally(p.x, p.y);
        });
        begin();
        arrow(from.x, from.y, to.x - 30, to.y + 20, { dash: [2, 12], bend: 0.15, color: '#ffffffaa', width: 5 });
        finger(to.x + 6, to.y + 6);
        tag('Hold & drag', to.x + 20, to.y - 220, { color: '#ffaa00' });
        arrow(to.x + 20, to.y - 195, to.x + 6, to.y - 60, { color: '#ffaa00', bend: -0.1 });
        tag('Ships inside the orange ring\nstream toward your finger', to.x - 60, to.y + 250, { color: '#ffaa00' });
        tag('Mouse: hold left button\nTouch: hold a finger down', from.x - 90, from.y + 170, { color: 'rgba(18,10,51,0.88)', ink: '#fff', size: 17 });
        end();
    },

    // 3. Rallying disarms you.
    'rally-disarmed'(game = world({ seed: 8 })) {
        const { sim } = game, player = sim.commander('dragon');
        sim.spawnCluster('dragon', 32, ...Object.values(point(sim, 0.52, 0.5)), 70);
        sim.spawnCluster('salamander', 9, ...Object.values(point(sim, 0.66, 0.5)), 40);
        const target = point(sim, 0.58, 0.5);
        game.input.pointer = target;
        still(sim);
        run(game, 0.7, () => player.rally(target.x, target.y));
        begin();
        const red = centre(sim, 'salamander');
        tag('While you hold, your ships\ncannot recruit anything', target.x - 250, target.y - 220, { color: '#ffaa00' });
        tag('Rivals nearby are even\npushed out of the way', red.x - 40, red.y + 230, { color: TEAMS.salamander.color, ink: '#fff' });
        arrow(red.x - 20, red.y + 190, red.x + 10, red.y + 40, { color: TEAMS.salamander.color, bend: 0.2 });
        end();
    },

    // 4. Release: the knot blooms into a ring.
    release(game = world({ seed: 11 })) {
        const { sim } = game, player = sim.commander('dragon');
        sim.spawnCluster('dragon', 34, ...Object.values(point(sim, 0.48, 0.5)), 45);
        sim.spawnCluster('salamander', 9, ...Object.values(point(sim, 0.6, 0.5)), 38);
        const target = point(sim, 0.52, 0.5);
        game.input.pointer = target;
        run(game, 1, () => player.rally(target.x, target.y));
        player.release();
        run(game, 0.22);
        begin();
        finger(target.x + 4, target.y + 4, { pressed: false });
        tag('Let go ➜ your fleet spreads out', target.x, target.y - 240, { color: '#ff6b6b', ink: '#fff' });
        tag(`Red ring = ${sim.rules.rallyCoolOff}s cool-off,\nthen recruiting switches on`, target.x - 280, target.y + 230, { color: 'rgba(18,10,51,0.9)', ink: '#ffb3b3', size: 17 });
        end();
    },

    // 5. Recruiting in progress.
    recruit(game = world({ seed: 13 })) {
        const { sim } = game;
        const at = point(sim, 0.55, 0.5);
        sim.spawnCluster('salamander', 8, at.x, at.y, 30);
        for (let i = 0; i < 30; i++) {
            const a = i / 30 * Math.PI * 2, r = 48 + (i % 3) * 16;
            sim.addBoid(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, 'dragon');
        }
        sim.canMove = () => false;
        run(game, 0.42);
        begin();
        ring(at.x, at.y, sim.rules.conversionRadius, { color: '#ffffffbb', dash: [4, 6], width: 2 });
        span(at.x, at.y, sim.rules.conversionRadius, -2.5, `${sim.rules.conversionRadius}px`);
        tag('Lines = recruit pressure\nbuilding on a rival', at.x + 250, at.y - 170, { color: TEAMS.dragon.color });
        arrow(at.x + 190, at.y - 130, at.x + 40, at.y - 30, { color: TEAMS.dragon.color });
        tag('White halo fills up\nuntil the ship turns', at.x + 250, at.y + 170, { color: '#ffffff' });
        arrow(at.x + 190, at.y + 130, at.x + 30, at.y + 20, { color: '#ffffff', bend: -0.2 });
        tag(`Recruit when ${sim.rules.conversionThreshold}+ of your ships are near\nand they outnumber the defenders`, at.x - 290, at.y - 240, { color: '#ffd23f', size: 18 });
        scoreboard(game, [['dragon', 'You'], ['salamander', 'Coral']]);
        end();
    },

    // 6. Recruited.
    recruited(game = world({ seed: 13 })) {
        const { sim } = game;
        const at = point(sim, 0.55, 0.5);
        sim.spawnCluster('salamander', 8, at.x, at.y, 30);
        for (let i = 0; i < 30; i++) {
            const a = i / 30 * Math.PI * 2, r = 48 + (i % 3) * 16;
            sim.addBoid(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, 'dragon');
        }
        sim.canMove = () => false;
        run(game, 1.3);
        for (const b of sim.boids) b.justConverted = false;
        renderer.render(game, 0);
        begin();
        tag(`+${game.converted || 0} ships — they fly for you now`, at.x, at.y - 230, { color: TEAMS.dragon.color });
        tag('Recruits join instantly and\ncan recruit the next group', at.x - 300, at.y + 220, { color: 'rgba(18,10,51,0.9)', ink: '#fff', size: 17 });
        scoreboard(game, [['dragon', 'You'], ['salamander', 'Coral']]);
        end();
    },

    // 7. Outnumbered: it works both ways.
    outnumbered(game = world({ seed: 17 })) {
        const { sim } = game;
        const at = point(sim, 0.5, 0.5);
        sim.spawnCluster('salamander', 26, at.x + 30, at.y, 70);
        sim.spawnCluster('dragon', 6, at.x - 50, at.y + 10, 26);
        sim.canMove = () => false;
        run(game, 0.45);
        begin();
        const you = centre(sim, 'dragon') || at;
        tag('Too few! Their bigger group is\nrecruiting YOUR ships', you.x - 180, you.y - 210, { color: TEAMS.salamander.color, ink: '#fff' });
        arrow(you.x - 150, you.y - 170, you.x - 10, you.y - 20, { color: TEAMS.salamander.color });
        tag('Never park a small group\nnext to a big one', at.x + 260, at.y + 220, { color: '#ffd23f', size: 18 });
        scoreboard(game, [['dragon', 'You'], ['salamander', 'Coral']]);
        end();
    },

    // 8. Aim Freeze.
    'freeze-aim'(game = world({ seed: 19, time: 30 })) {
        const { sim } = game;
        sim.spawnCluster('dragon', 32, ...Object.values(point(sim, 0.22, 0.55)), 90);
        const at = point(sim, 0.62, 0.48);
        sim.spawnCluster('salamander', 16, at.x, at.y, 110);
        run(game, 0.6);
        game.input.pointer = at; game.input.freezeAiming = true;
        run(game, 0.1);
        begin();
        span(at.x, at.y, sim.commander('dragon').freezeRadius, 0.35, `${sim.rules.freezeRadius}px`, '#b6edff');
        tag('Point at a rival group', at.x, at.y - sim.rules.freezeRadius - 12 + 40, { color: '#b6edff' });
        key('Space', at.x - 330, at.y + 250); tag('or right-click', at.x - 180, at.y + 250, { color: 'rgba(18,10,51,0.9)', ink: '#fff', size: 16 });
        tag('Touch: tap ❄ Freeze, then the arena', at.x - 250, at.y + 305, { color: 'rgba(18,10,51,0.9)', ink: '#fff', size: 16 });
        end();
    },

    // 9. Freeze landed.
    'freeze-hit'(game = world({ seed: 19, time: 30 })) {
        const { sim } = game, player = sim.commander('dragon');
        sim.spawnCluster('dragon', 32, ...Object.values(point(sim, 0.22, 0.55)), 90);
        const at = point(sim, 0.62, 0.48);
        sim.spawnCluster('salamander', 16, at.x, at.y, 110);
        run(game, 0.6);
        player.freeze(at.x, at.y);
        run(game, 0.18);
        begin();
        const frozen = sim.boids.filter(b => b.frozen);
        const f = frozen.sort((a, b) => a.pos.x - b.pos.x)[0];
        tag(`Half the rivals in range stop\nfor ${sim.rules.freezeDuration} seconds`, at.x + 10, at.y - 250, { color: '#b6edff' });
        if (f) { tag('Gray hull + crosshair\n= frozen', f.pos.x - 250, f.pos.y + 150, { color: '#b6edff' }); arrow(f.pos.x - 200, f.pos.y + 110, f.pos.x - 16, f.pos.y + 12, { color: '#b6edff', bend: -0.15 }); }
        tag('Frozen ships cannot recruit\nor help defend', at.x + 260, at.y + 250, { color: 'rgba(18,10,51,0.9)', ink: '#fff', size: 17 });
        end();
    },

    // 10. Freeze then recruit.
    'freeze-recruit'(game = world({ seed: 23, time: 30, teams: ['dragon', 'phoenix'] })) {
        const { sim } = game, player = sim.commander('dragon');
        const at = point(sim, 0.6, 0.5);
        sim.spawnCluster('phoenix', 16, at.x, at.y, 60);
        sim.spawnCluster('dragon', 30, at.x - 260, at.y + 20, 70);
        still(sim);
        run(game, 0.1);
        player.freeze(at.x, at.y);
        run(game, 0.9, () => player.rally(at.x - 20, at.y));
        player.release();
        run(game, 0.75);
        begin();
        [['Freeze the group', '#b6edff'], ['Rally onto the frozen ships', '#ffaa00'], ['Release: recruit them', TEAMS.dragon.color]].forEach(([text, color], i) => {
            badge(i + 1, 60, 70 + i * 58); tag(text, 92, 70 + i * 58, { color, align: 'left', size: 19 });
        });
        tag('Frozen ships are the easiest\ntargets on the map', at.x + 230, at.y + 220, { color: '#ffd23f', size: 18 });
        scoreboard(game, [['dragon', 'You'], ['phoenix', 'Amber']]);
        end();
    },

    // 11. Asteroids.
    asteroids(game = world({ seed: 29 })) {
        const { sim } = game, player = sim.commander('dragon');
        sim.setTerrain([{ type: 'asteroid', ...point(sim, 0.5, 0.45), radius: 110 }]);
        sim.spawnCluster('dragon', 30, ...Object.values(point(sim, 0.2, 0.45)), 70);
        const target = point(sim, 0.82, 0.45);
        game.input.pointer = target;
        run(game, 1.45, () => player.rally(target.x, target.y));
        begin();
        const rock = sim.terrain[0];
        tag('Asteroids knock ships off course\n(no losses, just scattering)', rock.x, rock.y - rock.radius - 70, { color: '#c9c9c9' });
        tag('Route around them to\nkeep the fleet together', rock.x, rock.y + rock.radius + 90, { color: 'rgba(18,10,51,0.9)', ink: '#fff', size: 17 });
        arrow(sim.width * 0.22, sim.height * 0.7, sim.width * 0.78, sim.height * 0.66, { dash: [3, 12], color: '#4cf0a8', bend: 0.18 });
        tag('Better route', sim.width * 0.5, sim.height * 0.92, { color: '#4cf0a8' });
        end();
    },

    // 12. Nebula.
    nebula(game = world({ seed: 31 })) {
        const { sim } = game, player = sim.commander('dragon');
        sim.setTerrain([{ type: 'slowZone', ...point(sim, 0.48, 0.48), radius: 150 }]);
        sim.spawnCluster('dragon', 32, ...Object.values(point(sim, 0.16, 0.48)), 70);
        const target = point(sim, 0.86, 0.48);
        game.input.pointer = target;
        run(game, 2.7, () => player.rally(target.x, target.y));
        begin();
        const cloud = sim.terrain[0];
        tag('Blue nebula: ships crawl inside', cloud.x, cloud.y - cloud.radius - 45, { color: '#6aa8ff' });
        tag('Fast again once\nthey are out', target.x - 60, target.y + 150, { color: TEAMS.dragon.color });
        tag('Your fleet stretches out —\nkeep holding so stragglers catch up', cloud.x, cloud.y + cloud.radius + 70, { color: 'rgba(18,10,51,0.9)', ink: '#fff', size: 17 });
        end();
    },

    // 13. Black hole.
    'black-hole'(game = world({ seed: 37 })) {
        const { sim } = game, player = sim.commander('dragon');
        sim.setTerrain([{ type: 'blackHole', ...point(sim, 0.5, 0.42), radius: 34 }]);
        sim.spawnCluster('dragon', 34, ...Object.values(point(sim, 0.18, 0.44)), 70);
        const target = point(sim, 0.84, 0.42);
        game.input.pointer = target;
        let lost = 0;
        run(game, 1.55, () => player.rally(target.x, target.y));
        lost = 34 - sim.count('dragon');
        begin();
        const hole = sim.terrain[0];
        ring(hole.x, hole.y, hole.reach, { color: '#ff6bd6', dash: [6, 8], width: 2 });
        tag('Glow = pull zone', hole.x + hole.reach + 10, hole.y - hole.reach + 10, { color: '#ff6bd6', align: 'left', size: 18 });
        tag('Dark core destroys ships', hole.x - 40, hole.y - hole.reach - 60, { color: '#ffffff' });
        arrow(hole.x - 40, hole.y - hole.reach - 35, hole.x - 4, hole.y - 12, { color: '#ffffff', bend: 0.25 });
        tag(`Straight through: ${lost} ship${lost === 1 ? '' : 's'} lost`, sim.width * 0.5, sim.height * 0.9, { color: '#ff6b6b', ink: '#fff' });
        tag('Freeze does not stop terrain', 30, sim.height * 0.1, { color: 'rgba(18,10,51,0.9)', ink: '#fff', size: 16, align: 'left' });
        end();
    },

    // 14. Gray ships.
    neutrals(game = world({ seed: 41 })) {
        const { sim } = game;
        const at = point(sim, 0.58, 0.5);
        sim.spawnCluster('neutral', 12, at.x, at.y, 60);
        for (let i = 0; i < 16; i++) {
            const a = Math.PI * 0.55 + i / 16 * Math.PI * 0.9, r = 95 + (i % 2) * 18;
            sim.addBoid(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, 'dragon');
        }
        sim.canMove = () => false;
        run(game, 0.5);
        begin();
        const n = sim.boids.find(b => b.team === 'neutral' && b.pos.x > at.x + 20) || sim.boids.find(b => b.team === 'neutral');
        tag('Gray diamond = unclaimed', n.pos.x + 150, n.pos.y - 170, { color: NEUTRAL_LOOK.color });
        arrow(n.pos.x + 120, n.pos.y - 145, n.pos.x + 12, n.pos.y - 10, { color: NEUTRAL_LOOK.color });
        tag('They never fight back.\nWhoever reaches them first gets them', at.x - 120, at.y + 240, { color: '#ffd23f', size: 18 });
        tag('If two fleets tie over one,\nnobody gets it', at.x + 330, at.y + 150, { color: 'rgba(18,10,51,0.9)', ink: '#fff', size: 16 });
        end();
    },

    // 15. Duel.
    duel(game = world({ seed: 43, duel: true, time: 30 })) {
        const { sim } = game, rival = sim.commander('salamander'), player = sim.commander('dragon');
        sim.spawnCluster('dragon', 40, ...Object.values(point(sim, 0.2, 0.3)), 100);
        sim.spawnCluster('salamander', 40, ...Object.values(point(sim, 0.8, 0.7)), 100);
        sim.spawnCluster('neutral', 14, ...Object.values(point(sim, 0.5, 0.5)), 90);
        const r = point(sim, 0.6, 0.55), p = point(sim, 0.4, 0.42);
        game.input.pointer = p;
        run(game, 1.6, () => { rival.rally(r.x, r.y); player.rally(p.x, p.y); });
        begin();
        const you = centre(sim, 'dragon'), them = centre(sim, 'salamander');
        tag('You (blue)', you.x - 150, you.y - 110, { color: DUEL_LOOK.you.color });
        tag('Rival (orange)', them.x + 120, them.y + 120, { color: DUEL_LOOK.rival.color });
        tag('The rival’s Rally point\nis shown — read its plan', r.x + 150, r.y - 150, { color: '#ffad7d' });
        arrow(r.x + 120, r.y - 115, r.x + 22, r.y - 22, { color: '#ffad7d' });
        tag(`Race for the gray ships — ${sim.rules.duelNeutralWave} more\narrive every ${sim.rules.duelNeutralInterval}s`, sim.width * 0.5, sim.height * 0.9, { color: NEUTRAL_LOOK.color, size: 18 });
        end();
    },

    // Survival: waves from the edges.
    survival(game = world({ seed: 53, teams: ['dragon', 'salamander', 'phoenix'] })) {
        const { sim } = game;
        sim.spawnBlob('dragon', 26, sim.width / 2, sim.height / 2, 120);
        const edges = [['salamander', 0.05, 0.5, 1, 0], ['phoenix', 0.95, 0.5, -1, 0]];
        for (const [team, ex, ey, dx, dy] of edges) {
            for (let i = 0; i < 12; i++) {
                const b = sim.addBoid((ex + (sim.random() - 0.5) * 0.12) * sim.width, (ey + (sim.random() - 0.5) * 0.3) * sim.height, team);
                b.vel.set(dx * sim.rules.maxSpeed * 0.6, dy * sim.rules.maxSpeed * 0.6);
            }
        }
        run(game, 0.9);
        begin();
        const red = centre(sim, 'salamander'), orange = centre(sim, 'phoenix');
        tag('Wave 2', sim.width / 2, 60, { color: '#ff4444', ink: '#fff', size: 26 });
        arrow(red.x + 40, red.y, red.x + 170, red.y, { color: TEAMS.salamander.color, bend: 0 });
        arrow(orange.x - 40, orange.y, orange.x - 170, orange.y, { color: TEAMS.phoenix.color, bend: 0 });
        tag('Rivals pour in from the edges', sim.width / 2, sim.height - 110, { color: '#ffd23f' });
        tag('Keep your fleet in one piece and\nmeet each wave head-on. Upgrade every 2 waves', sim.width / 2, sim.height - 50, { color: 'rgba(18,10,51,0.9)', ink: '#fff', size: 16 });
        end();
    },

    // 16. Victory.
    victory(game = world({ seed: 47, teams: ['dragon', 'salamander'] })) {
        const { sim } = game;
        sim.spawnCluster('dragon', 70, ...Object.values(point(sim, 0.5, 0.5)), 190);
        const c = point(sim, 0.5, 0.52);
        run(game, 2.5, () => sim.commander('dragon').rally(c.x, c.y));
        begin();
        tag('Every ship in your colour = victory', sim.width / 2, 70, { color: TEAMS.dragon.color, size: 24 });
        scoreboard(game, [['dragon', 'You'], ['salamander', 'Coral']]);
        end();
    },
};

/** Annotates a screenshot of the real HUD with the rectangles of its controls. */
globalThis.annotateHud = async (url, rects, type = 'image/webp', quality = 0.86) => {
    await document.fonts?.ready;
    const image = new Image();
    image.src = url;
    await image.decode();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const outline = r => { ctx.save(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.roundRect(r.x - 5, r.y - 5, r.width + 10, r.height + 10, 12); ctx.stroke(); ctx.restore(); };
    const mid = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    const notes = [
        ['pause', 'Pause · Esc or P', 0, 110, 'left'],
        ['timer', 'Match time & score', 0, 120],
        ['guide', 'Hints', -170, 100],
        ['details', 'Share of the arena\n& fleet sizes', 10, 190, 'right'],
        ['rally', 'Rally: tap it, then tap\ndestinations (touch)', -40, -120, 'right'],
        ['freeze', 'Freeze: counts down\nuntil it is ready', 40, -120, 'left'],
    ];
    for (const [id, text, dx, dy, align = 'center'] of notes) {
        const r = rects[id];
        if (!r) continue;
        outline(r);
        const m = mid(r), ty = m.y + dy, edge = dy > 0 ? r.y + r.height + 8 : r.y - 8;
        arrow(m.x + dx, ty + (dy > 0 ? -18 : 18), m.x, edge, { color: '#ffd23f', bend: 0.1, width: 3 });
        tag(text, m.x + dx, ty, { color: '#ffd23f', size: 17, align });
    }
    return canvas.toDataURL(type, quality);
};

/** Renders one scene and returns it as a data URL. */
globalThis.renderScene = async (id, type = 'image/webp', quality = 0.86) => {
    await document.fonts?.ready;
    SCENES[id]();
    return canvas.toDataURL(type, quality);
};
globalThis.sceneIds = Object.keys(SCENES);
