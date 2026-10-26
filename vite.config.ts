import { defineConfig } from 'vitest/config';
import { offlineBuild } from './scripts/offline-build.ts';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

const root = (file: string) => fileURLToPath(new URL(file, import.meta.url));

const chrome69Prelude = `(${function installChrome69Builtins(root: typeof globalThis) {
    if (!root.globalThis) Object.defineProperty(root, 'globalThis', { value: root, configurable: true });
    if (!Object.fromEntries) Object.defineProperty(Object, 'fromEntries', {
        configurable: true,
        writable: true,
        value(entries: Iterable<readonly [PropertyKey, unknown]>) {
            const result: Record<PropertyKey, unknown> = {};
            for (const [key, value] of entries) Object.defineProperty(result, key, {
                value, writable: true, enumerable: true, configurable: true,
            });
            return result;
        },
    });
    if (!root.queueMicrotask) Object.defineProperty(root, 'queueMicrotask', {
        configurable: true,
        writable: true,
        value(callback: VoidFunction) {
            Promise.resolve().then(callback).catch(error => setTimeout(() => { throw error; }));
        },
    });
    if (!String.prototype.replaceAll) Object.defineProperty(String.prototype, 'replaceAll', {
        configurable: true,
        writable: true,
        value(search: string | RegExp, replacement: string | ((substring: string, ...args: unknown[]) => string)) {
            const input = String(this);
            if (search instanceof RegExp) {
                if (!search.global) throw new TypeError('replaceAll requires a global RegExp');
                return input.replace(search, replacement as string);
            }
            const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return input.replace(new RegExp(escaped, 'g'), replacement as string);
        },
    });
}.toString()})(typeof self !== 'undefined' ? self : window);`;

export default defineConfig({
    plugins: [svelte(), offlineBuild()],
    build: {
        // Android 8's bundled WebView 69 is the minimum installed runtime.
        // Keep production syntax parseable there; API 26 alone does not imply
        // that users have already updated their WebView provider.
        target: 'chrome69',
        rollupOptions: {
            input: { main: root('index.html'), connect: root('connect.html') },
            output: { banner: chrome69Prelude },
        },
    },
    worker: { format: 'es', rollupOptions: { output: { banner: chrome69Prelude } } },
    // `npm start` (server.ts) serves the Jev proxy on :4173; `npm run dev` forwards /api to it.
    server: { proxy: { '/api': 'http://127.0.0.1:4173' } },
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        testTimeout: 120_000,
    },
});
