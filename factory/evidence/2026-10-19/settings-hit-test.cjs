const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(process.env.SWARM_ROOT||path.join(__dirname,'../../..'));
(async()=>{
  const {preview}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
  const server=await preview({root,preview:{host:'127.0.0.1',port:4188,strictPort:true}});
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport:{width:732,height:364},hasTouch:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:4188');await page.waitForFunction(()=>!!window.game);
    await page.getByRole('button',{name:'Settings',exact:true}).tap();
    await page.waitForFunction(()=>!document.querySelector('#settings-screen').getAnimations({subtree:true}).some(a=>a.playState==='running'));
    const before=await page.locator('#setting-sound').isChecked();
    const place=async occluded=>page.evaluate(occluded=>{
      const s=document.querySelector('#settings-screen'),e=document.querySelector('#setting-sound');
      const h=s.querySelector('.page-head').getBoundingClientRect(),r=e.getBoundingClientRect();
      const target=occluded?h.y+h.height/2:h.bottom+(innerHeight-h.bottom)/2;
      s.scrollTop+=r.y+r.height/2-target;
      const t=e.getBoundingClientRect(),x=t.x+t.width/2,y=t.y+t.height/2,hit=document.elementFromPoint(x,y);
      const bounds=t.width>0&&t.height>0&&t.x>=0&&t.right<=innerWidth&&t.y>=0&&t.bottom<=innerHeight;
      return {x,y,rect:t.toJSON(),scroll:s.scrollTop,oldPredicate:bounds,
        correctedPredicate:bounds&&(hit===e||e.contains(hit)),hitTag:hit?.tagName,hitId:hit?.id};
    },occluded);
    // Controlled scroll fixtures reproduce the probe weakness; native tests
    // must use Android drags. No CSS or click/runtime/preference override here.
    const occluded=await place(true);
    assert.equal(occluded.oldPredicate,true);assert.equal(occluded.correctedPredicate,false);
    await page.touchscreen.tap(occluded.x,occluded.y);
    assert.equal(await page.locator('#setting-sound').isChecked(),before);
    const reachable=await place(false);assert.equal(reachable.correctedPredicate,true);
    await page.touchscreen.tap(reachable.x,reachable.y);
    const state=await page.evaluate(()=>({checked:document.querySelector('#setting-sound').checked,runtime:game.audio.enabled,stored:JSON.parse(localStorage.getItem('swarm-doctrine-settings-v3')).sound}));
    assert.deepEqual(state,{checked:!before,runtime:!before,stored:!before});assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(__dirname,'settings-hit-test.json'),JSON.stringify({browser:browser.version(),viewport:[732,364],occluded,reachable,occludedTapUnchanged:true,reachableTapUpdatesAll:true,state,pageErrors:errors,limitation:'Controlled browser probe regression, not exact native font/scroll reproduction or installed-app proof.'},null,2)+'\n');
    console.log('Corrected hit predicate rejects covered control and accepts a real successful Sound tap');
  }finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
