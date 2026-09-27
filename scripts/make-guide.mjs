// Renders the field-guide pictures (guide/*.webp) from scripts/guide/scenes.js
// with the real simulation and renderer. Needs Playwright and Chromium:
//   node scripts/make-guide.mjs [scene-id ...]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').catch(() => require('playwright'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    let body;
    try { body = await readFile(join(root, path)); } catch { return res.writeHead(404).end(); }
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }).end(body);
}).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

/** Plays a real Zen match for a few seconds, then labels the HUD. */
async function captureHud(capturePage) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await page.goto(`${base}/index.html`);
    await page.waitForFunction(() => globalThis.game);
    await page.evaluate(() => { game.showTeamSelect('zen'); game.selectTeam('dragon'); game.sim.time = game.rules.freezeLockout + 1; });
    await page.mouse.move(700, 380);
    await page.waitForTimeout(1500);
    await page.evaluate(() => game.ui.hideOverlays());
    await page.waitForTimeout(300);
    const rects = await page.evaluate(() => Object.fromEntries(Object.entries({ pause: 'btn-pause', timer: 'hud-timer', guide: 'btn-guide', details: 'btn-details', rally: 'slot-rally', freeze: 'slot-freeze' })
        .map(([key, id]) => { const r = document.getElementById(id).getBoundingClientRect(); return [key, { x: r.x, y: r.y, width: r.width, height: r.height }]; })));
    const shot = `data:image/png;base64,${(await page.screenshot()).toString('base64')}`;
    await page.close();
    const url = await capturePage.evaluate(([shot, rects]) => globalThis.annotateHud(shot, rects), [shot, rects]);
    const data = Buffer.from(url.split(',')[1], 'base64');
    await writeFile(join(root, 'guide', 'hud.webp'), data);
    console.log(`guide/hud.webp  ${Math.round(data.length / 1024)} KB`);
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => console.error(error));
    await page.goto(`${base}/scripts/guide/capture.html`);
    await page.waitForFunction(() => globalThis.sceneIds);
    const all = await page.evaluate(() => globalThis.sceneIds), picked = process.argv.slice(2);
    const ids = picked.length ? all.filter(id => picked.includes(id)) : all;
    await mkdir(join(root, 'guide'), { recursive: true });
    for (const id of ids) {
        const url = await page.evaluate(id => globalThis.renderScene(id), id);
        const data = Buffer.from(url.split(',')[1], 'base64');
        await writeFile(join(root, 'guide', `${id}.webp`), data);
        console.log(`guide/${id}.webp  ${Math.round(data.length / 1024)} KB`);
    }
    if (!process.argv.slice(2).length || process.argv.includes('hud')) await captureHud(page);
} finally {
    await browser.close();
    server.close();
}
