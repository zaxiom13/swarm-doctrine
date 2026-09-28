// Renders the field-guide pictures (guide/*.webp) from scripts/guide/scenes.js
// with the real simulation and renderer. Needs Playwright and Chromium:
//   node scripts/make-guide.ts [scene-id ...]
import { createServer as createViteServer } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

declare const game: any; // exists in the page, not in this script
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').catch(() => require('playwright'));

// The pages import the game's TypeScript modules, so they are served by Vite.
const server = await createViteServer({ root, logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false } });
await server.listen();

const base = `${server.resolvedUrls!.local[0].replace(/\/$/, '')}`;

// Each device gets its own pictures: the arena shape, gesture and buttons it really has.
const DEVICES = {
    desktop: { scene: { width: 1280, height: 720 }, hud: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } },
    // A 3:4 portrait arena, 720 world units wide like a real phone, so a picture fits on screen with its caption.
    phone: { scene: { width: 720, height: 960 }, hud: { viewport: { width: 390, height: 520 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
};
const save = async (device, id, url) => {
    const data = Buffer.from(url.split(',')[1], 'base64');
    await writeFile(join(root, 'public', 'guide', device, `${id}.webp`), data);
    console.log(`guide/${device}/${id}.webp  ${Math.round(data.length / 1024)} KB`);
};

/** Plays a real Zen match for a moment on the device, then labels the HUD. */
async function captureHud(device, capturePage) {
    const { hud } = DEVICES[device];
    const context = await browser.newContext(hud);
    const page = await context.newPage();
    await page.goto(`${base}/index.html`);
    await page.waitForFunction(() => globalThis.game);
    await page.evaluate(() => { game.showTeamSelect('zen'); game.selectTeam('dragon'); game.sim.time = game.rules.freezeLockout + 1; });
    if (device === 'desktop') await page.mouse.move(700, 380);
    await page.waitForTimeout(1500);
    await page.evaluate(() => game.ui.hideOverlays());
    await page.waitForTimeout(300);
    const rects = await page.evaluate(() => Object.fromEntries(Object.entries({ pause: 'btn-pause', timer: 'hud-timer', guide: 'btn-guide', details: 'btn-details', freeze: 'slot-freeze' })
        .map(([key, id]) => { const r = document.getElementById(id).getBoundingClientRect(); return [key, { x: r.x, y: r.y, width: r.width, height: r.height }]; })));
    const shot = `data:image/png;base64,${(await page.screenshot()).toString('base64')}`;
    await context.close();
    await save(device, 'hud', await capturePage.evaluate(([shot, rects, scale]) => globalThis.annotateHud(shot, rects, scale), [shot, rects, hud.deviceScaleFactor]));
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
    const picked = process.argv.slice(2);
    for (const device of Object.keys(DEVICES)) {
        const page = await browser.newPage({ viewport: DEVICES[device].scene, deviceScaleFactor: 1 });
        page.on('pageerror', error => console.error(error));
        await page.goto(`${base}/scripts/guide/capture.html?device=${device}`);
        await page.waitForFunction(() => globalThis.sceneIds);
        const all = await page.evaluate(() => globalThis.sceneIds);
        await mkdir(join(root, 'public', 'guide', device), { recursive: true });
        for (const id of picked.length ? all.filter(id => picked.includes(id)) : all) await save(device, id, await page.evaluate(id => globalThis.renderScene(id), id));
        if (!picked.length || picked.includes('hud')) await captureHud(device, page);
        await page.close();
    }
} finally {
    await browser.close();
    await server.close();
}
