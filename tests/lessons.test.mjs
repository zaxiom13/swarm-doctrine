import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { LESSONS, freshLessonProgress, lessonComplete, lessonReadyToConvert } from '../js/lessons.js';

// Parse every module as a browser ES module (including files not imported below).
for (const file of fs.readdirSync(new URL('../js/', import.meta.url)).filter(f => f.endsWith('.js'))) {
    new vm.SourceTextModule(fs.readFileSync(new URL('../js/' + file, import.meta.url), 'utf8'));
}
let randomSeed = 314159;
Math.random = () => { randomSeed = (Math.imul(1664525, randomSeed) + 1013904223) >>> 0; return randomSeed / 4294967296; };
const elements = new Map();
function element(id = '') {
    const classes = new Set();
    const listeners = {};
    const el = { id, children: [], style: { setProperty() {} }, dataset: {}, textContent: '', innerHTML: '', value: '', disabled: false,
        classList: { add: (...xs) => xs.forEach(x => classes.add(x)), remove: (...xs) => xs.forEach(x => classes.delete(x)), contains: x => classes.has(x), toggle: (x, force) => { const add = force ?? !classes.has(x); add ? classes.add(x) : classes.delete(x); return add; } },
        addEventListener: (type, fn) => { listeners[type] = fn; },
        click: () => listeners.click?.({ target: el }),
        emit: (type, event) => listeners[type]?.({target:el,preventDefault(){},...event}),
        setAttribute() {}, removeAttribute() {},
        appendChild: x => el.children.push(x), replaceChildren: (...xs) => { el.children = xs; },
        querySelector: sel => get(id + sel), querySelectorAll: () => [],
        getContext: () => new Proxy({}, {get: (_,key) => key.startsWith('create') ? () => ({addColorStop(){}}) : () => {}}), getBoundingClientRect: () => ({ left: 0, top: 0, width: el.width || 1280, height: el.height || 720 }),
        closest: () => null
    };
    return el;
}
const get = id => { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); };
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
globalThis.document = { getElementById: get, querySelector: get, querySelectorAll: () => [], addEventListener() {}, createElement: () => element(), documentElement: element() };
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, matchMedia: () => ({ matches: false }) };
globalThis.requestAnimationFrame = () => {};
globalThis.matchMedia = () => ({ matches: false });
const { Game } = await import('../js/game.js');
const { TutorialMode } = await import('../js/tutorial.js');
const game = new Game();
game.audio = new Proxy({}, { get: () => () => {} });
const tutorial = new TutorialMode(game);
window.tutorial = tutorial;


const { CONFIG, DOCTRINES_CATALOG } = await import('../js/config.js');
const { levelRules, buildWorld, validCheckpoint } = await import('../js/worlds.js');
const { Obstacle } = await import('../js/obstacles.js');
const advance = seconds => {
    for(let tick=0;tick<seconds*60&&game.gameState==='playing';tick++) game.update(1/60);
};
const begin = index => { tutorial.start(index); get('btn-lesson-begin').click(); };
const terrainSnapshot = () => game.obstacles.obstacles.map(o=>({type:o.type,x:o.pos.x,y:o.pos.y,r:o.radius,pull:o.pullRadius,life:o.lifetime}));
assert.equal(LESSONS.length,14);
assert.equal(CONFIG.empDuration,10); assert.equal(CONFIG.empCooldown,10); assert.equal(CONFIG.empRadius,360);
assert.equal(typeof game.triggerShockwave,'undefined'); assert.equal(typeof game.triggerOverdrive,'undefined');
assert.ok(DOCTRINES_CATALOG.every(d=>!['kinetic_resonance','overdrive_booster'].includes(d.id)));
for(let index=0;index<LESSONS.length;index++) {
    const lesson=LESSONS[index];
    assert.equal(lessonComplete(lesson,freshLessonProgress()),false,lesson.id+' requires action');
    tutorial.start(index);
    assert.equal(game.gameState,'lesson-intro');
    assert.equal(game.boids.length,lesson.playerCount+lesson.enemies.reduce((s,e)=>s+e.count,0));
    assert.equal(get('slot-emp').disabled,!lesson.abilities.includes('emp'));
    assert.equal(game.empCooldown,0);
    get('btn-lesson-begin').click();game.update(1/60);
    assert.equal(game.gameState,'playing',lesson.id+' must not auto-complete');
}
console.log('PASS: 14 exercise setups, gated abilities and module syntax.');

// A freeze catches the wide boundary, skips allies, costs nothing on a miss, and respects pause.
begin(2);game.boids=[];
const ally=game.addBoid(640,350,'dragon');
const near=game.addBoid(640+360,350,'salamander');
const outside=game.addBoid(640+361,350,'salamander');
game.input.mousePos.x=640;game.input.mousePos.y=350;
game.setBeaconActive(true); game.triggerEmp();
assert.equal(near.frozen,true);assert.equal(outside.frozen,false);assert.equal(ally.frozen,false);
assert.equal(near.freezeRemaining,10);assert.equal(game.empCooldown,10);assert.equal(game.beaconActive,false);
game.pause();game.update(5);assert.equal(near.freezeRemaining,10);assert.equal(game.empCooldown,10);game.resume();
// Keep the lesson open while its timers run.
tutorial.update=()=>{};
advance(1);assert.ok(near.freezeRemaining>8.99&&near.freezeRemaining<9.01);
const frozenPosition={x:near.pos.x,y:near.pos.y};advance(2);
assert.deepEqual({x:near.pos.x,y:near.pos.y},frozenPosition,'Frozen targets do not drift');
advance(7.1);assert.equal(game.empCooldown,0);assert.equal(near.frozen,false);
delete tutorial.update;
game.boids=[ally];game.triggerEmp();assert.equal(game.empCooldown,0,'Empty casts keep charge');
near.stun(10);near.convert('dragon');assert.equal(near.frozen,false,'Recruited ships immediately join the swarm');
console.log('PASS: wide Freeze, boundary targeting, pause-safe duration, recharge, no wasted charge and allied immunity.');

// Touch input: two-step aim, no accidental rally, multi-touch isolation, pointer cancellation.
begin(3);game.input.isMobile=true;
get('slot-emp').click();assert.equal(game.input.freezeAiming,true);
get('game-canvas').emit('pointerdown',{pointerType:'touch',pointerId:1,button:0,clientX:870,clientY:317});
assert.equal(game.input.freezeAiming,false);assert.equal(game.beaconActive,false);assert.equal(game.empCooldown,10);
get('game-canvas').emit('pointerdown',{pointerType:'touch',pointerId:2,button:0,clientX:300,clientY:300});
assert.equal(game.beaconActive,true);
get('game-canvas').emit('pointerdown',{pointerType:'touch',pointerId:3,button:0,clientX:900,clientY:500});
assert.equal(game.input.mousePos.x,300,'Second finger must not steal the Rally target');
get('game-canvas').emit('pointercancel',{pointerId:2});assert.equal(game.beaconActive,false);assert.equal(game.input.pointerId,null);
game.input.isMobile=false;
console.log('PASS: touch targeting, multi-touch isolation and cancelled gestures.');

// Competition terrain must not mutate with time or fleet size, including black holes.
game.showTeamSelect('conquest');game.selectTeam('dragon');
const original=terrainSnapshot(), originalSeed=game.world.seed;
for(let i=0;i<200;i++) game.obstacles.update(1,[]);
assert.deepEqual(terrainSnapshot(),original);
game.startGame();assert.equal(game.world.seed,originalSeed);assert.deepEqual(terrainSnapshot(),original);
const hole=new Obstacle(300,300,'blackHole',100);
const doomed=game.addBoid(300,300,'dragon');assert.equal(hole.affectBoid(doomed),true);
assert.ok(Number.isFinite(doomed.acc.x)&&Number.isFinite(doomed.acc.y),'Core contact must not produce NaN');
const cloud=new Obstacle(300,300,'slowZone');const slow=game.addBoid(310,300,'dragon');cloud.affectBoid(slow);assert.equal(slow.slowMultiplier,.4);
const rocks=new Obstacle(300,300,'asteroid');rocks.affectBoid(slow);assert.ok(Math.hypot(slow.acc.x,slow.acc.y)>0);
console.log('PASS: fixed maps, seeded retries and all three hazard effects.');

// Difficulty has a real upper bound; fresh sectors change maps, retry and resume do not.
assert.deepEqual(levelRules(10),levelRules(10000));
assert.deepEqual(buildWorld(42,5),buildWorld(42,5));
for(const width of [320,390,768,1280]) {
    const world=buildWorld(2,10,width,720);
    assert.ok(world.terrain.length<=7);
    for(const t of world.terrain) assert.ok(t.x>=0&&t.x<=width&&t.y>=0&&t.y<=720&&Number.isFinite(t.radius));
}
game.showTeamSelect('levels');game.selectTeam('phoenix');
assert.equal(game.gameState,'sector-intro');assert.equal(game.level,1);
const sectorOne=game.world.seed; get('btn-sector-begin').click();game.update(1/60);
assert.equal(game.gameState,'playing','No immediate upgrade popup');
game.victory();get('btn-play-again').click();assert.equal(game.level,2);assert.notEqual(game.world.seed,sectorOne);
const sectorTwo=game.world.seed;game.startGame();assert.equal(game.world.seed,sectorTwo);
game.quitToMenu();assert.equal(game.resumeExpedition(),true);assert.equal(game.level,2);assert.equal(game.world.seed,sectorTwo);assert.equal(game.playerTeam,'phoenix');
assert.equal(validCheckpoint({level:-3,seed:1,team:'dragon'}),false);
console.log('PASS: bounded difficulty, seeded map generation, level advancement, retry and checkpoint resume.');

// Zen evolves instead of ending; stable modes never take its terrain update path.
game.showTeamSelect('zen');game.selectTeam('dragon');const zenSeed=game.world.seed;
game.updateWorld(40);assert.notEqual(game.world.seed,zenSeed);assert.equal(game.zenShifts,1);
game.boids=[];game.replenishZen();assert.ok(game.boids.some(b=>b.team==='dragon'));assert.ok(game.boids.some(b=>b.team!=='dragon'));
const rescue=game.world.rescue;game.boids=[];
for(let i=0;i<5;i++) game.addBoid(rescue.x+i,rescue.y,'dragon');
game.updateWorld(2);assert.equal(rescue.claimed,true);assert.equal(game.boids.length,11);game.updateWorld(2);assert.equal(game.boids.length,11);
const before=game.obstacles.obstacles.map(o=>({x:o.pos.x/1280,y:o.pos.y/720}));
window.innerWidth=390;window.innerHeight=844;game.resizeWorld();
assert.equal(game.canvas.width,390);assert.equal(game.input.pointerId,null);
game.obstacles.obstacles.forEach((o,i)=>{assert.ok(Math.abs(o.pos.x/390-before[i].x)<1e-10);assert.ok(Math.abs(o.pos.y/844-before[i].y)<1e-10);});
window.innerWidth=1280;window.innerHeight=720;game.resizeWorld();
console.log('PASS: Zen shifts and replenishment, single-use rescues and mobile orientation scaling.');

// Actual simulation: all basic control lessons and the rescue can be completed by player actions.
for(const index of [0,1,2,3,4,8]) {
    begin(index);
    for(let attempt=0;attempt<12&&game.gameState==='playing';attempt++) {
        const lesson=LESSONS[index], target=lesson.target || (lesson.rescue ? {x:.5,y:.5} : null);
        const enemy=game.boids.find(b=>b.team!==game.playerTeam);
        game.input.mousePos.x=target?target.x*game.canvas.width:enemy?.pos.x??870;
        game.input.mousePos.y=target?target.y*game.canvas.height:enemy?.pos.y??317;
        game.setBeaconActive(true);advance(3);
        game.setBeaconActive(false);advance(.5);
        if(lesson.abilities.includes('emp'))game.triggerEmp();
        advance(5);
    }
    assert.equal(game.gameState,'victory',LESSONS[index].id+' must be winnable: '+JSON.stringify(tutorial.progress));
}
assert.ok(JSON.parse(store.get('swarm-lessons-v2')).includes('rescue'));
tutorial.next();assert.equal(tutorial.index,9);assert.equal(tutorial.progress.recruited,0);
tutorial.showLessons();assert.equal(get('lesson-grid').children.length,14);
console.log('PASS: real simulation completion of Rally, conversion, both Freeze lessons, recharge and rescue; progress persists.');

// Upgrade state is run-scoped and rendering paths work with the new modes.
game.showTeamSelect('conquest');game.startGame();const radius=CONFIG.empRadius;
DOCTRINES_CATALOG.find(d=>d.id==='emp_overcharge').apply(game);assert.ok(CONFIG.empRadius>radius);
tutorial.start(0);assert.equal(CONFIG.empRadius,radius);
get('btn-lesson-begin').click();game.gameLoop(performance.now());
game.showTeamSelect('levels');game.selectTeam('dragon');game.gameLoop(performance.now());
game.startSurvivalMode();game.gameLoop(performance.now());
console.log('PASS: upgrade isolation and renderer smoke checks.');
// Navigation exercises must be achievable with steering, not synthetic progress counters.
for (const index of [5,6,7]) {
    begin(index);
    game.setBeaconActive(true);
    for(let tick=0;tick<60*75&&game.gameState==='playing';tick++) {
        const l=LESSONS[index], target=l.route?.[tutorial.progress.waypoints]||l.target;
        if(target){game.input.mousePos.x=target.x*game.canvas.width;game.input.mousePos.y=target.y*game.canvas.height;}
        game.update(1/60);
    }
    assert.equal(game.gameState,'victory',LESSONS[index].id+' route must be navigable: '+JSON.stringify(tutorial.progress));
}
console.log('PASS: real steering completes asteroid, nebula and black-hole navigation exercises.');

// Exercise the two-sector and wave transitions independently of combat luck.
begin(11);const firstTrainingMap=game.world.seed;game.boids=game.boids.filter(b=>b.team===game.playerTeam);tutorial.update();
assert.equal(tutorial.progress.sectors,1);assert.notEqual(game.world.seed,firstTrainingMap);assert.ok(game.boids.some(b=>b.team!==game.playerTeam));
game.boids=game.boids.filter(b=>b.team===game.playerTeam);tutorial.update();assert.equal(game.gameState,'victory');
begin(12);tutorial.progress.recruited=8;tutorial.update();assert.equal(tutorial.progress.waves,2);
const waveSize=game.boids.length;tutorial.update();assert.equal(game.boids.length,waveSize,'Second wave only spawns once');
begin(10);const trainingSeed=game.world.seed;game.updateWorld(15);assert.notEqual(game.world.seed,trainingSeed);assert.equal(game.zenShifts,1);
console.log('PASS: mode lessons transition sectors, add one reinforcement wave, and evolve terrain.');
