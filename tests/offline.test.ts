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
