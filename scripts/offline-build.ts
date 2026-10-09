import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

/** Precache every built chunk (including lazy rivals/workers) and packaged public asset. */
export function offlineBuild(): Plugin {
    let config: ResolvedConfig;
    return {
        name: 'swarm-offline-build',
        apply: 'build',
        configResolved(value) { config = value; },
        async writeBundle(_options, bundle) {
            const publicFiles = (await readdir(config.publicDir, { recursive: true, withFileTypes: true }))
                .filter(file => file.isFile())
                .map(file => path.relative(config.publicDir, path.join(file.parentPath, file.name)).split(path.sep).join('/'))
                .filter(file => file !== 'sw.js' && file !== '_headers');
            const files = [...new Set([...Object.keys(bundle), ...publicFiles])].sort();
            const hash = createHash('sha256');
            for (const file of files) {
                hash.update(file);
                hash.update(await readFile(path.resolve(config.root, config.build.outDir, file)));
            }
            let worker = await readFile(path.join(config.publicDir, 'sw.js'), 'utf8');
            // Include worker behavior in the version as well as all precached bytes.
            hash.update(worker);
            const urls = files.map(file => config.base + file);
            worker = worker.replace(/^const CACHE = .*;$/m, `const CACHE = 'swarm-doctrine-${hash.digest('hex').slice(0, 16)}';`)
                .replace(/^const SHELL = .*;$/m, `const SHELL = ${JSON.stringify(urls)};`);
            await writeFile(path.resolve(config.root, config.build.outDir, 'sw.js'), worker);
        },
    };
}
