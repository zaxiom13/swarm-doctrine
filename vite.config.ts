import { defineConfig } from 'vitest/config';
import { offlineBuild } from './scripts/offline-build.ts';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

const root = (file: string) => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
    plugins: [svelte(), offlineBuild()],
    build: {
        target: 'es2022',
        rollupOptions: { input: { main: root('index.html'), connect: root('connect.html') } },
    },
    worker: { format: 'es' },
    // `npm start` (server.ts) serves the Jev proxy on :4173; `npm run dev` forwards /api to it.
    server: { proxy: { '/api': 'http://127.0.0.1:4173' } },
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        testTimeout: 120_000,
    },
});
