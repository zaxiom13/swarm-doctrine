import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Cloudflare production and branch preview configuration stays deployable', () => {
    const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
    assert.equal(config.name, 'swarm-doctrine');
    assert.equal(config.workers_dev, true);
    assert.equal(config.assets.directory, './dist');
    assert.equal(config.build.command, 'npm run build');
    assert.deepEqual(config.previews, {});
});
