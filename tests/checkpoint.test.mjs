import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { POLICY_VERSION, PARAMETERS, LEGACY_PARAMETERS, migrateLegacyVector } from '../js/ai/local-policy.js';

const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function verify(dir) {
    return spawnSync(process.execPath, ['scripts/train-local.mjs', '--directory', dir, '--verify-checkpoint'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
}
function withCheckpoints(files, check) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-checkpoint-'));
    try {
        fs.mkdirSync(path.join(dir, 'checkpoints'));
        for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'checkpoints', name), text);
        check(dir);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('resume preserves weights and Adam state; a corrupt newest checkpoint falls back', () => {
    const model = { version: POLICY_VERSION, weights: Array(PARAMETERS).fill(0.123) };
    const state = { model, bestModel: model, episodes: 17, adamStep: 17, m: Array(PARAMETERS).fill(0.2), v: Array(PARAMETERS).fill(0.3), baseline: 0.4 };
    const saved = JSON.stringify({ sha256: sha(state), state });
    withCheckpoints({ '00000017-good.json': saved, '00000018-broken.json': '{' }, dir => {
        const run = verify(dir);
        assert.equal(run.status, 0, run.stderr);
        const result = JSON.parse(run.stdout);
        assert.equal(result.episodes, 17);
        assert.equal(result.adamStep, 17);
        assert.equal(result.weightsHash, sha(model.weights));
        assert.equal(fs.readFileSync(path.join(dir, 'checkpoints', '00000017-good.json'), 'utf8'), saved, 'checkpoints are immutable');
        assert.match(run.stderr, /Skipped invalid/);
    });
});

test('v1 checkpoints (weights and optimizer moments) migrate on resume', () => {
    const model = { version: 'swarm-linear-v1', weights: Array.from({ length: LEGACY_PARAMETERS }, (_, i) => (i % 13) / 13) };
    const state = { model, bestModel: model, episodes: 5, adamStep: 5, m: Array(LEGACY_PARAMETERS).fill(0.01), v: Array(LEGACY_PARAMETERS).fill(0.02), baseline: 0 };
    withCheckpoints({ '00000005-legacy.json': JSON.stringify({ sha256: sha(state), state }) }, dir => {
        const run = verify(dir);
        assert.equal(run.status, 0, run.stderr);
        assert.equal(JSON.parse(run.stdout).weightsHash, sha(migrateLegacyVector(model.weights)));
    });
});
