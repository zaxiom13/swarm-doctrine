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
    // Controlled reproduction of the probe's weak predicate, not the native
    // failure's exact font/scroll state. No CSS, click or runtime override.
    const diagnostic=await page.evaluate(()=>{
      const s=document.querySelector('#settings-screen'),e=document.querySelector('#setting-sound');
      const h=s.querySelector('.page-head').getBoundingClientRect(),r=e.getBoundingClientRect();
      s.scrollTop+=r.y+r.height/2-(h.y+h.height/2);
      const t=e.getBoundingClientRect(),x=t.x+t.width/2,y=t.y+t.height/2,hit=document.elementFromPoint(x,y);
      return {x,y,bounds:t.toJSON(),scroll:s.scrollTop,header:h.toJSON(),
        boundingPredicate:t.width>0&&t.height>0&&t.x>=0&&t.right<=innerWidth&&t.y>=0&&t.bottom<=innerHeight,
        inputOwnsHit:hit===e||e.contains(hit),hitTag:hit?.tagName,hitClass:hit?.className};
    });
    assert.equal(diagnostic.boundingPredicate,true);assert.equal(diagnostic.inputOwnsHit,false);
    await page.touchscreen.tap(diagnostic.x,diagnostic.y);
    assert.equal(await page.locator('#setting-sound').isChecked(),before);
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(__dirname,'settings-hit-test.json'),JSON.stringify({browser:browser.version(),viewport:[732,364],diagnostic,occludedTapLeavesChoiceUnchanged:true,pageErrors:errors,limitation:'Controlled browser probe weakness; not exact native fontScale/scroll reproduction or proof of the native failure root cause.'},null,2)+'\n');
    console.log('Bounding-only visibility accepts an occluded Sound control; real tap does not toggle it');
  }finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
