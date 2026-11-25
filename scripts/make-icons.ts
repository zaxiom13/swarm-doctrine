// Renders the app icon to PNG without dependencies: node scripts/make-icons.ts
import fs from 'node:fs';
import zlib from 'node:zlib';

const BG_EDGE = [6, 9, 19];
const BG_CORE = [24, 42, 84];
// Same 5-chevron V-formation as icons/icon.svg, in a 64-unit square: [points, rgb, alpha].
const SHAPES: [number[][], number[], number][] = [
    [[[32, 13], [39, 29], [32, 25.5], [25, 29]], [55, 226, 213], 1],
    [[[32, 13], [35.5, 21], [32, 19], [28.5, 21]], [216, 255, 251], 1],
    [[[21, 24], [26.5, 37.5], [21, 34.5], [15.5, 37.5]], [55, 226, 213], 0.88],
    [[[43, 24], [48.5, 37.5], [43, 34.5], [37.5, 37.5]], [55, 226, 213], 0.88],
    [[[12, 36], [16.5, 47], [12, 44.5], [7.5, 47]], [143, 123, 255], 0.85],
    [[[52, 36], [56.5, 47], [52, 44.5], [47.5, 47]], [143, 123, 255], 0.85],
];

function inside(x: number, y: number, points: number[][]) {
    let hit = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
}

function render(size: number) {
    const rows = [];
    const samples = 4;
    for (let py = 0; py < size; py++) {
        const row = Buffer.alloc(1 + size * 4);
        for (let px = 0; px < size; px++) {
            let [r, g, b] = [0, 0, 0];
            for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
                const x = (px + (sx + 0.5) / samples) * 64 / size, y = (py + (sy + 0.5) / samples) * 64 / size;
                const d = Math.min(1, Math.hypot(x - 32, y - 27) / 40);
                let color = BG_CORE.map((c, i) => c * (1 - d) + BG_EDGE[i] * d);
                for (const [points, rgb, alpha] of SHAPES) if (inside(x, y, points)) color = color.map((c, i) => c * (1 - alpha) + rgb[i] * alpha);
                r += color[0]; g += color[1]; b += color[2];
            }
            const n = samples * samples;
            row.set([r / n, g / n, b / n, 255], 1 + px * 4);
        }
        rows.push(row);
    }
    return png(size, Buffer.concat(rows));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buffer: Buffer) => { let c = 0xffffffff; for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Buffer) {
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
}
function png(size: number, raw: Buffer) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
    header.set([8, 6, 0, 0, 0], 8);
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const out = new URL('../public/icons/', import.meta.url);
fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]] as [string, number][]) {
    fs.writeFileSync(new URL(name, out), render(size));
    console.log(`public/icons/${name} ${size}×${size}`);
}
