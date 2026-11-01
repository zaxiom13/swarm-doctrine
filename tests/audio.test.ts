import { test } from 'vitest';
import assert from 'node:assert/strict';

const listeners: Record<string, Function[]> = {};
const env = globalThis as any;
env.document = {
    hidden: false,
    addEventListener(type: string, listener: Function) {
        (listeners[type] ||= []).push(listener);
    },
};
env.window = env;

const { AudioSystem } = await import('../src/lib/audio.ts');

function visibility(hidden: boolean) {
    env.document.hidden = hidden;
    for (const listener of listeners.visibilitychange || []) listener();
}

test('foreground only resumes audio that visibility itself suspended', () => {
    const calls = { suspend: 0, resume: 0 };
    const context = {
        state: 'running',
        suspend() { calls.suspend++; this.state = 'suspended'; },
        resume() { calls.resume++; this.state = 'running'; },
    };
    const audio = new AudioSystem();
    audio.ctx = context;

    visibility(true);
    assert.equal(context.state, 'suspended');
    visibility(false);
    assert.equal(context.state, 'running');
    assert.deepEqual(calls, { suspend: 1, resume: 1 });

    visibility(true);
    audio.suspend(); // The match pauses while the page is hidden.
    visibility(false);
    assert.equal(context.state, 'suspended', 'foreground must not override an explicit pause');
    assert.deepEqual(calls, { suspend: 2, resume: 1 });
});
