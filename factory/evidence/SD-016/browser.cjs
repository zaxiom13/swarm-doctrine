const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
    const { preview } = await import('vite');
    const server = await preview({ root: path.resolve(__dirname, '../../..'), preview: { host: '127.0.0.1', port: 4183, strictPort: true } });
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: JSON.parse(process.env.CHROMIUM_ARGS || '[]') });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
        const errors = []; page.on('pageerror', error => errors.push(String(error)));
        await page.goto('http://127.0.0.1:4183');
        await page.waitForFunction(() => !!window.game);
        await page.evaluate(() => { game.showTeamSelect('conquest'); game.selectTeam('dragon'); });
        for (const [width, height] of [[390, 844], [844, 390], [1280, 720]]) {
            await page.setViewportSize({ width, height });
            await page.evaluate(() => { game.ui.setDetailsOpen(true); document.activeElement?.blur(); });
            await page.keyboard.press('Escape');
            assert.deepEqual(await page.evaluate(() => ({ details: game.ui.detailsOpen, state: game.gameState, pause: game.ui.overlays['pause-overlay'] })), { details: false, state: 'playing', pause: false });
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => game.gameState), 'paused');
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => game.gameState), 'playing');
            const overflow = await page.evaluate(() => [...document.querySelectorAll('#game-screen button')].filter(e => e.getClientRects().length).filter(e => { const r = e.getBoundingClientRect(); return r.left < -.5 || r.top < -.5 || r.right > innerWidth + .5 || r.bottom > innerHeight + .5; }).map(e => e.id));
            assert.deepEqual(overflow, []);
        }
        assert.deepEqual(errors, []);
        console.log('Escape/details/pause/resume and bounds passed in portrait, landscape and desktop');
    } finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
