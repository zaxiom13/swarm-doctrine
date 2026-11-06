const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(process.env.SWARM_ROOT||path.join(__dirname,'../../..'));
(async()=>{
  const {preview}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
  const server=await preview({root,preview:{host:'127.0.0.1',port:4186,strictPort:true}});
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  const results=[];
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:4186');await page.waitForFunction(()=>!!window.game);
    await page.evaluate(()=>{game.showTeamSelect('zen');game.selectTeam('dragon');});
    const arm=async()=>{
      await page.evaluate(()=>{game.sim.time=Math.max(game.sim.time,game.rules.freezeLockout+1);game.player.freezeCooldown=0;});
      await page.waitForFunction(()=>!document.querySelector('#slot-freeze').classList.contains('hidden'));
      await page.locator('#slot-freeze').tap();
      await page.waitForFunction(()=>game.input.freezeAiming&&!game.player.rallying);
    };
    for(const [width,height] of [[390,844],[844,390]]){
      await page.setViewportSize({width,height});
      await arm();await page.evaluate(()=>game.ui.handleBack());
      assert.equal(await page.evaluate(()=>!game.input.freezeAiming&&game.gameState==='playing'),true);
      await arm();await page.setViewportSize({width:height,height:width});
      await page.waitForFunction(()=>!game.input.freezeAiming&&game.player.freezeCooldown===0);
      await page.setViewportSize({width,height});await arm();
      const p=await page.evaluate(()=>{
        const b=game.sim.addBoid(game.sim.width*.5,game.sim.height*.6,game.teamOrder()[1]);b.vel.set(0,0);
        b.conversionCooldown=game.rules.conversionCooldownTicks*60;
        window.__freezeEvents=[];const original=game.sim.emit;
        game.sim.emit=function(e){if(e.type==='freeze'&&e.team===game.playerTeam)window.__freezeEvents.push({...e,cooldown:game.player.freezeCooldown,field:!!game.player.freezeField});return original.call(this,e);};
        const r=game.renderer,c=game.canvas.getBoundingClientRect();
        return {x:c.x+(b.pos.x*r.viewScale+r.offsetX)*c.width/game.canvas.width,y:c.y+(b.pos.y*r.viewScale+r.offsetY)*c.height/game.canvas.height};
      });
      await page.touchscreen.tap(p.x,p.y);
      await page.waitForFunction(()=>!game.input.freezeAiming&&game.player.freezeCooldown>0&&game.player.freezeField!==null);
      const delayed=await page.evaluate(()=>{
        game.pause();for(let i=0;i<Math.ceil((game.player.freezeDuration+1)*60);i++)game.sim.step(1/60);
        const result={fieldExpired:game.player.freezeField===null,durableCast:window.__freezeEvents.some(e=>e.victims>0&&e.cooldown>0&&e.field)};
        game.resume();return result;
      });
      assert.deepEqual(delayed,{fieldExpired:true,durableCast:true});
      results.push({width,height,backCancellation:true,rotationCancellation:true,buttonThenArenaCast:true,delayedObservation:delayed,point:p});
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(__dirname,'freeze.json'),JSON.stringify({browser:browser.version(),results,pageErrors:errors,limitation:'Browser touch only; shared ready-charge and test-rival fixture, no Android lifecycle or font-scale proof.'},null,2)+'\n');
    console.log('Native-fixture-equivalent browser Freeze paths passed');
  }finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});

