import test from 'node:test';
import assert from 'node:assert/strict';
import {averagedDirection,perturb} from '../scripts/es-update.mjs';
test('paired ES moves toward better returns, cancels ties and is sign invariant',()=>{
    const pairs=[{noise:[1,2],plus:3,minus:1},{noise:[-1,1],plus:1,minus:3}];
    const direction=averagedDirection(pairs,.2);
    assert.ok(direction[0]>0);
    assert.deepEqual([...direction],[...averagedDirection(pairs.map(p=>({noise:p.noise.map(x=>-x),plus:p.minus,minus:p.plus})),.2)]);
    assert.deepEqual([...averagedDirection([{noise:[1,2],plus:2,minus:2}],.2)],[0,0]);
    const model={version:'test',weights:[1,2]};const next=perturb(model,direction,.1);
    assert.ok(next.weights[0]>1);assert.deepEqual(model.weights,[1,2]);
});
