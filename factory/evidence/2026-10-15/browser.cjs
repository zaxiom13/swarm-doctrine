const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(process.env.SWARM_ROOT || path.join(__dirname, '../../..'));
(async () => {
    const { preview } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
    const server = await preview({ root, preview: { host: '127.0.0.1', port: 4184, strictPort: true } });
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
    const errors = [], controls = [], duels = [], offlineRivals = [];
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
        // BroadcastChannel needs the same storage partition: two tabs, not two
        // isolated browser profiles. This never exercises Firebase or WebRTC.
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(String(e)));
        await page.goto('http://127.0.0.1:4184');
        await page.waitForFunction(() => !!window.game);
        await page.evaluate(() => { game.showTeamSelect('conquest'); game.selectTeam('dragon'); });
        for (const [width, height] of [[390,844], [844,390], [1280,720]]) {
            await page.setViewportSize({ width, height });
            await page.evaluate(() => { game.resume(); game.ui.setDetailsOpen(true); document.activeElement?.blur(); });
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => game.gameState), 'playing');
            await page.evaluate(() => { game.ui.handleBack(); game.ui.pauseSettings(); game.ui.handleBack(); });
            assert.deepEqual(await page.evaluate(() => [game.ui.screen, game.gameState, game.ui.overlays['pause-overlay']]), ['game-screen','paused',true]);
            await page.evaluate(() => game.ui.handleBack());
            assert.equal(await page.evaluate(() => game.gameState), 'playing');
            // Actual pointer near an edge, rotation while held, then release.
            await page.mouse.move(12, height * .55);
            await page.mouse.down();
            assert.equal(await page.evaluate(() => game.player.rallying), true);
            await page.setViewportSize({ width: height, height: width });
            await page.waitForFunction(() => game.input.pointerId === null && !game.player.rallying);
            await page.mouse.up();
            await page.setViewportSize({ width, height });
            await page.evaluate(() => { game.input.isTouch = true; game.input.pressFreeze(); });
            await page.touchscreen.tap(width * .5, height * .6);
            assert.equal(await page.evaluate(() => game.input.freezeAiming), false);
            await page.evaluate(() => { game.pause(); game.restart(); });
            assert.equal(await page.evaluate(() => game.gameState), 'playing');
            const overflow = await page.evaluate(() => [...document.querySelectorAll('#game-screen button')].filter(e => e.getClientRects().length).filter(e => { const r=e.getBoundingClientRect(); return r.left<-.5 || r.top<-.5 || r.right>innerWidth+.5 || r.bottom>innerHeight+.5; }).map(e=>e.id));
            assert.deepEqual(overflow, []);
            controls.push({ width, height, backSettings: true, escape: true, rotationRelease: true, freezeTap: true, restart: true, overflow });
        }
        // Optional reproduction for the combined-run offline timeout. The
        // isolated cold-start check below uses a fresh service-worker client.
        const offlineContext = process.env.OFFLINE_AFTER_CONTROLS ? context : await browser.newContext({ hasTouch:true });
        const offlinePage = process.env.OFFLINE_AFTER_CONTROLS ? page : await offlineContext.newPage();
        if (offlinePage !== page) {
            offlinePage.on('pageerror', e => errors.push(String(e)));
            await offlinePage.goto('http://127.0.0.1:4184');
            await offlinePage.waitForFunction(() => !!window.game);
        }
        await offlinePage.evaluate(() => navigator.serviceWorker.ready);
        if (!process.env.SKIP_CONTROLLED_WARMUP || !await offlinePage.evaluate(() => !!navigator.serviceWorker.controller)) await offlinePage.reload();
        await offlinePage.waitForFunction(() => !!navigator.serviceWorker.controller && !!window.game);
        await offlineContext.setOffline(true);
        await offlinePage.reload();
        try { await offlinePage.waitForFunction(() => !!window.game, {}, { timeout: 5000 }); }
        catch (e) {
            console.log('offline diagnostic', await offlinePage.evaluate(async () => ({ url:location.href, body:document.body.innerText.slice(0,300), scripts:[...document.scripts].map(s=>s.src), caches:await caches.keys(), controller:!!navigator.serviceWorker.controller })), errors);
            throw e;
        }
        for (const kind of ['duel-local', 'duel-tactician']) {
            await offlinePage.evaluate(kind => game.startDuelMode(kind), kind);
            await offlinePage.waitForFunction(() => game.gameState === 'playing' && game.sim.time > 1);
            assert.equal(await offlinePage.evaluate(() => game.sim.boids.every(b => Number.isFinite(b.pos.x) && Number.isFinite(b.pos.y))), true);
            offlineRivals.push(kind);
            await offlinePage.evaluate(() => game.quitToMenu());
        }
        const missing = await offlinePage.evaluate(async () => { const r=await fetch('/assets/never-existed.js'); return { status:r.status, type:r.headers.get('content-type') }; });
        assert.equal(missing.status, 503); assert.ok(missing.type.startsWith('text/plain'));
        await offlineContext.setOffline(false);
        if (offlineContext !== context) await offlineContext.close();
        await page.close();
        const players = [await context.newPage(), await context.newPage()];
        for (let i=0; i<2; i++) {
            players[i].on('pageerror', e => errors.push(String(e)));
            await players[i].goto('http://127.0.0.1:4184/?net=local');
            await players[i].waitForFunction(() => !!window.game);
            await players[i].evaluate(async i => { game.saveOnlineProfile({ name: `Check ${i}`, region:'eu' }); await game.openLobby(); }, i);
        }
        for (let round=0; round<2; round++) {
            const host = players[round], guest = players[1-round];
            for(const p of players) await p.waitForFunction(() => game.lobby.peers.size === 1);
            await host.evaluate(() => game.lobby.invite([...game.lobby.peers.keys()][0]));
            await guest.waitForFunction(() => !!game.lobby.incoming);
            await guest.evaluate(() => game.lobby.answer(true));
            await host.waitForFunction(() => game.online?.role === 'host');
            await guest.waitForFunction(() => game.online?.role === 'guest' && game.online.got && game.sim.boids.length > 0);
            await guest.mouse.move(40, 450); await guest.mouse.down();
            await host.waitForFunction(() => game.sim.commander(game.opponentTeam).rallying);
            await guest.setViewportSize({ width:844, height:390 });
            await guest.waitForFunction(() => !game.online.holding && game.input.pointerId===null);
            await host.waitForFunction(() => !game.sim.commander(game.opponentTeam).rallying);
            await guest.mouse.up();
            await guest.evaluate(() => { game.input.isTouch=true; game.input.pressFreeze(); });
            await guest.touchscreen.tap(420,250);
            await host.waitForFunction(() => game.sim.commander(game.opponentTeam).freezeWait > 0);
            for (const p of players) assert.equal(await p.evaluate(() => game.sim.boids.every(b => Number.isFinite(b.pos.x) && Number.isFinite(b.pos.y))), true);
            await guest.evaluate(() => game.backToLobby());
            await host.waitForFunction(() => game.online?.ended && game.gameState==='victory');
            await host.evaluate(() => game.backToLobby());
            for (const p of players) assert.equal(await p.evaluate(() => game.online===null && game.lobby.busy===false), true);
            duels.push({ hostTab: round, guestSnapshot: true, rotationRelease: true, freezeInput: true, finite: true, disconnectVictory: true, rematchCleanup: true });
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(__dirname, 'browser.json'), JSON.stringify({ browser:browser.version(), controls, offline:{coldReload:true, context:process.env.OFFLINE_AFTER_CONTROLS?'after-controls':'fresh', controlledOnlineWarmup:!process.env.SKIP_CONTROLLED_WARMUP, rivals:offlineRivals, missingAsset:missing}, localDuels:duels, pageErrors:errors, limitation:'Two same-partition tabs; BroadcastChannel only, no Firebase/WebRTC or Android WebView.' }, null, 2)+'\n');
        console.log('Controls, cold offline rivals and two local-duel role rounds passed');
    } finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode=1; });
