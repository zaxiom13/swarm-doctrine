// A lightweight, pointer-responsive orbital swarm sculpture for the title screen.
import { prefersReducedMotion } from '../lib/settings.ts';

interface Ship { angle: number; radius: number; size: number; speed: number; hue: string; rgb: string }

/** Starts the animation and returns a function that stops it. `active` says whether the title screen is showing. */
export function startPreview(canvas: HTMLCanvasElement, host: HTMLElement, active: () => boolean): () => void {
    const ctx = canvas.getContext('2d')!;
    let width = 0, height = 0, last = 0, time = 0, frameId = 0;
    let pointer: { x: number; y: number } | null = null;
    const ships: Ship[] = Array.from({ length: 190 }, (_, i) => {
        const radius = 0.2 + Math.sqrt(i / 190) * 0.78;
        const hue = radius > 0.87 ? '#ffbe3b' : radius < 0.44 ? '#8f7bff' : '#37e2d5';
        const rgb = radius > 0.87 ? '255, 190, 59' : radius < 0.44 ? '143, 123, 255' : '55, 226, 213';
        return {
            angle: i * 2.399963,
            radius,
            size: 1.9 + (i % 5) * 0.45,
            speed: 0.075 + (i % 7) * 0.006,
            hue,
            rgb,
        };
    });
    const positions = new Float32Array(ships.length * 2);

    function draw() {
        ctx.clearRect(0, 0, width, height);
        const cx = width * 0.5, cy = height * 0.48;
        const radius = Math.max(width, height) * 0.46;

        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.15);
        glow.addColorStop(0, 'rgba(55, 226, 213, 0.10)');
        glow.addColorStop(0.45, 'rgba(143, 123, 255, 0.07)');
        glow.addColorStop(1, 'rgba(6, 9, 19, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        // Subtle orbital rings
        ctx.lineWidth = 1;
        for (const r of [0.42, 0.72, 1.04]) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, radius * r, radius * r * 0.85, -0.35, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(148, 214, 255, 0.065)';
            ctx.stroke();
        }

        // Compute orbital positions
        for (let i = 0; i < ships.length; i++) {
            const ship = ships[i];
            const angle = ship.angle + time * ship.speed;
            const orbit = radius * ship.radius * (0.86 + Math.sin(angle * 3 + time * 0.14) * 0.09);
            let x = cx + Math.cos(angle) * orbit;
            let y = cy + Math.sin(angle) * orbit * 0.82;
            if (pointer) {
                const dx = x - pointer.x, dy = y - pointer.y, d = Math.hypot(dx, dy);
                if (d < 150 && d > 0) {
                    const push = (150 - d) * 0.45;
                    x += dx / d * push - dy / d * push * 0.25;
                    y += dy / d * push + dx / d * push * 0.25;
                }
            }
            positions[i * 2] = x;
            positions[i * 2 + 1] = y;
        }

        // Subtle tactical constellation filaments between nearby ships
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(55, 226, 213, 0.08)';
        ctx.beginPath();
        for (let i = 0; i < ships.length; i += 2) {
            const x1 = positions[i * 2], y1 = positions[i * 2 + 1];
            for (let j = i + 1; j < Math.min(ships.length, i + 16); j++) {
                const dx = positions[j * 2] - x1, dy = positions[j * 2 + 1] - y1;
                if (dx * dx + dy * dy < 4900) {
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(positions[j * 2], positions[j * 2 + 1]);
                }
            }
        }
        ctx.stroke();

        // Ships with soft luminous wakes
        for (let i = 0; i < ships.length; i++) {
            const ship = ships[i];
            const x = positions[i * 2], y = positions[i * 2 + 1];
            const angle = ship.angle + time * ship.speed + Math.PI * 0.57;
            const cos = Math.cos(angle), sin = Math.sin(angle);
            const s = ship.size;

            // Soft wake streak
            ctx.beginPath();
            ctx.moveTo(x - cos * s * 0.8, y - sin * s * 0.8);
            ctx.lineTo(x - cos * s * 4.5, y - sin * s * 4.5);
            ctx.strokeStyle = `rgba(${ship.rgb}, 0.22)`;
            ctx.lineWidth = s * 0.55;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Swept chevron ship
            ctx.beginPath();
            ctx.moveTo(x + cos * s * 2.1, y + sin * s * 2.1);
            ctx.lineTo(x - cos * s * 1.1 + sin * s * 0.72, y - sin * s * 1.1 - cos * s * 0.72);
            ctx.lineTo(x - cos * s * 0.45, y - sin * s * 0.45);
            ctx.lineTo(x - cos * s * 1.1 - sin * s * 0.72, y - sin * s * 1.1 + cos * s * 0.72);
            ctx.closePath();
            ctx.fillStyle = ship.hue;
            ctx.globalAlpha = 0.45 + ship.size / 7.5;
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function resize() {
        width = innerWidth; height = innerHeight;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        canvas.width = width * ratio; canvas.height = height * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        draw();
    }

    function frame(now: number) {
        const dt = Math.min((now - last) / 1000, 0.04); last = now;
        if (!document.hidden && active()) {
            if (!prefersReducedMotion()) time += dt;
            draw();
        }
        frameId = requestAnimationFrame(frame);
    }

    const move = (e: PointerEvent) => { pointer = { x: e.clientX, y: e.clientY }; };
    const leave = () => { pointer = null; };
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    window.addEventListener('resize', resize);
    resize();
    frameId = requestAnimationFrame(frame);
    return () => {
        cancelAnimationFrame(frameId);
        host.removeEventListener('pointermove', move);
        host.removeEventListener('pointerleave', leave);
        window.removeEventListener('resize', resize);
    };
}
