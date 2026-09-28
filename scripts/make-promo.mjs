// Renders the vertical promo (scripts/promo/) to an MP4 that WhatsApp,
// Instagram and TikTok accept: 1080x1920, 30 fps, H.264 main profile, AAC.
//   FFMPEG=/path/to/ffmpeg node scripts/make-promo.mjs [out.mp4] [--seconds N]
// Needs Playwright with Chromium, and an ffmpeg with libx264 (e.g. `npm i ffmpeg-static`).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ffmpeg = process.env.FFMPEG || (() => { try { return require('ffmpeg-static'); } catch { return 'ffmpeg'; } })();
const args = process.argv.slice(2);
const output = args.find(a => a.endsWith('.mp4')) || join(root, 'swarm-doctrine-promo.mp4');
const secondsFlag = args.indexOf('--seconds');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' };

const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    let body;
    try { body = await readFile(join(root, path)); } catch { return res.writeHead(404).end(); }
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }).end(body);
}).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));

const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => console.error(error));
    await page.goto(`http://127.0.0.1:${server.address().port}/scripts/promo/promo.html`);
    await page.waitForFunction(() => globalThis.renderFrame && globalThis.promoReady);
    await page.evaluate(() => globalThis.promoReady);
    const { fps, duration } = await page.evaluate(async () => { const m = await import('./promo.js'); return { fps: m.FPS, duration: m.DURATION }; });
    const seconds = secondsFlag >= 0 ? Number(args[secondsFlag + 1]) : duration;

    const work = await mkdtemp(join(tmpdir(), 'promo-'));
    const wav = join(work, 'soundtrack.wav');
    await writeFile(wav, Buffer.from(await page.evaluate(() => globalThis.renderSoundtrack()), 'base64'));

    const encoder = spawn(ffmpeg, ['-y', '-loglevel', 'error',
        '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
        '-i', wav,
        '-c:v', 'libx264', '-profile:v', 'main', '-level', '4.1', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '21', '-maxrate', '4M', '-bufsize', '8M',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-shortest', '-movflags', '+faststart', output], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((resolve, reject) => encoder.on('close', code => (code ? reject(new Error(`ffmpeg exited ${code}`)) : resolve())));

    const frames = Math.round(seconds * fps);
    for (let f = 0; f < frames; f++) {
        await page.evaluate(f => globalThis.renderFrame(f), f);
        const jpeg = await page.screenshot({ type: 'jpeg', quality: 93 });
        if (!encoder.stdin.write(jpeg)) await new Promise(resolve => encoder.stdin.once('drain', resolve));
        if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${frames}`);
    }
    encoder.stdin.end();
    await done;
    console.log(`\n${output}`);
} finally {
    await browser.close();
    server.close();
}
