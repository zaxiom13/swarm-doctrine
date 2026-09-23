// A lightweight, pointer-responsive swarm sculpture for the title screen.
import { prefersReducedMotion } from './settings.js';

const canvas = document.getElementById('swarm-preview');
const ctx = canvas.getContext('2d');
let width = 0, height = 0, last = 0, time = 0;
let pointer = null;
const ships = Array.from({ length: 210 }, (_, i) => ({
    angle: i * 2.399963, radius: 0.22 + Math.sqrt(i / 210) * 0.76,
    size: 1.8 + (i % 5) * 0.45, speed: 0.08 + (i % 7) * 0.007
}));
function resize() {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = width * ratio; canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
}
document.getElementById('main-menu').addEventListener('pointermove', e => { pointer = { x: e.clientX, y: e.clientY }; });
document.getElementById('main-menu').addEventListener('pointerleave', () => { pointer = null; });
function draw() {
    ctx.clearRect(0, 0, width, height);
    const cx = width * 0.5, cy = height * 0.48;
    const radius = Math.max(width, height) * 0.46;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.2);
    glow.addColorStop(0, '#6a4bff22'); glow.addColorStop(1, '#6a4bff00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    [0.45, 0.75, 1.06].forEach(r => {
        ctx.beginPath(); ctx.ellipse(cx, cy, radius * r, radius * r * 0.86, -0.38, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff10'; ctx.lineWidth = 1; ctx.stroke();
    });
    for (const ship of ships) {
        const angle = ship.angle + time * ship.speed;
        const orbit = radius * ship.radius * (0.86 + Math.sin(angle * 3 + time * 0.13) * 0.1);
        let x = cx + Math.cos(angle) * orbit, y = cy + Math.sin(angle) * orbit * 0.83;
        if (pointer) {
            const dx = x - pointer.x, dy = y - pointer.y, d = Math.hypot(dx, dy);
            if (d < 130 && d > 0) { x += dx / d * (130 - d) * 0.5; y += dy / d * (130 - d) * 0.5; }
        }
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.PI * 0.57);
        ctx.fillStyle = ship.radius > 0.87 ? '#ffd23f' : ship.radius < 0.45 ? '#ff6bd6' : '#37e2d5';
        ctx.globalAlpha = 0.4 + ship.size / 7;
        ctx.beginPath(); ctx.moveTo(ship.size * 2, 0); ctx.lineTo(-ship.size, ship.size * 0.65); ctx.lineTo(-ship.size * 0.5, 0); ctx.lineTo(-ship.size, -ship.size * 0.65); ctx.closePath(); ctx.fill(); ctx.restore();
    }
}
function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.04); last = now;
    if (!document.hidden && !document.getElementById('main-menu').classList.contains('hidden')) {
        if (!prefersReducedMotion()) time += dt;
        draw();
    }
    requestAnimationFrame(frame);
}
window.addEventListener('resize', resize); resize(); requestAnimationFrame(frame);
