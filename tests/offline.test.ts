import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function worker() {
    const listeners: Record<string, Function> = {}, waits: Promise<any>[] = [];
    const index = new Response('<html>game</html>', { headers: { 'Content-Type': 'text/html' } });
    const cache = { match: async (request: any) => String(request?.url ?? request) === 'https://game.test/game/index.html' ? index.clone() : undefined };
    vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), {
        self: { registration: { scope: 'https://game.test/game/' }, addEventListener: (kind: string, fn: Function) => listeners[kind] = fn },
        location: { origin: 'https://game.test' }, URL, Response,
        fetch: async () => { throw new Error('offline'); },
        caches: { open: async () => cache, match: async () => new Response('wrong old cache') },
    });
    return async (path: string, mode: string) => {
        let response: Promise<Response>;
        listeners.fetch({ request: { url: `https://game.test${path}`, method: 'GET', mode },
            respondWith: (value: Promise<Response>) => response = value,
            waitUntil: (value: Promise<any>) => waits.push(value) });
        return response;
    };
}
test('only navigation falls back to the current scoped shell', async () => {
    const fetch = worker();
    const navigation = await fetch('/game/unknown-page', 'navigate');
    assert.equal(navigation.status, 200);
    assert.equal(await navigation.text(), '<html>game</html>');
    for (const path of ['/game/assets/missing.js', '/game/assets/missing.css', '/game/models/missing.json']) {
        const response = await fetch(path, 'cors');
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('Content-Type'), 'text/plain');
        assert.equal(await response.text(), 'Unavailable offline');
    }
});

test('public precache accepts only an Origin-only variant mismatch', async () => {
    const listeners: Record<string, Function> = {};
    let source = readFileSync('public/sw.js', 'utf8');
    source = source.replace(/^const SHELL = .*;$/m, "const SHELL = ['/game/assets/main.js', '/game/assets/style.css'];");
    const entries = new Map([
        ['/game/assets/main.js', new Response('game script', { headers: { Vary: 'Origin', 'Content-Type': 'text/javascript' } })],
        ['/game/assets/style.css', new Response('body{}', { headers: { Vary: 'origin', 'Content-Type': 'text/css' } })],
        ['/game/assets/private.js', new Response('private', { headers: { Vary: 'Origin' } })],
    ]);
    let vary = 'Origin';
    const cache = { match: async (request: any, options?: any) => {
        if (!options?.ignoreVary) return undefined;
        const response = entries.get(new URL(request.url).pathname);
        if (!response) return undefined;
        const headers = new Headers(response.headers);
        if (request.url.endsWith('/main.js')) headers.set('Vary', vary);
        return new Response(await response.clone().text(), { headers });
    } };
    vm.runInNewContext(source, {
        self: { registration: { scope: 'https://game.test/game/' }, addEventListener: (kind: string, fn: Function) => listeners[kind] = fn },
        location: { origin: 'https://game.test' }, URL, Response,
        fetch: async () => { throw new Error('offline'); }, caches: { open: async () => cache },
    });
    const read = (path: string) => {
        let response: Promise<Response>;
        listeners.fetch({ request: { url: `https://game.test${path}`, method: 'GET', mode: 'cors' },
            respondWith: (value: Promise<Response>) => response = value, waitUntil() {} });
        return response!;
    };
    assert.equal(await (await read('/game/assets/main.js')).text(), 'game script');
    assert.equal(await (await read('/game/assets/style.css')).text(), 'body{}');
    assert.equal((await read('/game/assets/private.js')).status, 503);
    assert.equal((await read('/game/assets/main.js?variant=1')).status, 503);
    for (vary of ['Cookie', 'Origin, Cookie', '*']) assert.equal((await read('/game/assets/main.js')).status, 503);
});
