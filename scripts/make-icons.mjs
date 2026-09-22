// Renders the app icon to PNG without dependencies: node scripts/make-icons.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';

const BACKGROUND = [9, 15, 17];
// Same shapes as icons/icon.svg, in a 64-unit square: [points, rgb, alpha].
const SHAPES = [
    [[[46, 32], [22, 21], [28, 32], [22, 43]], [184, 237, 203], 1],
    [[[24, 16], [14, 12], [17, 16], [14, 20]], [184, 237, 203], 0.7],
    [[[24, 52], [14, 48], [17, 52], [14, 56]], [184, 237, 203], 0.7],
    [[[52, 16], [42, 12], [45, 16], [42, 20]], [168, 239, 213], 0.5],
];

function inside(x, y, points) {
    let hit = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
}

function render(size) {
    const rows = [];
    const samples = 4;
    for (let py = 0; py < size; py++) {
        const row = Buffer.alloc(1 + size * 4);
        for (let px = 0; px < size; px++) {
            let [r, g, b] = [0, 0, 0];
            for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
                const x = (px + (sx + 0.5) / samples) * 64 / size, y = (py + (sy + 0.5) / samples) * 64 / size;
                let color = BACKGROUND;
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
const crc = buffer => { let c = 0xffffffff; for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
}
function png(size, raw) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
    header.set([8, 6, 0, 0, 0], 8);
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const out = new URL('../icons/', import.meta.url);
fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
    fs.writeFileSync(new URL(name, out), render(size));
    console.log(`icons/${name} ${size}×${size}`);
}
