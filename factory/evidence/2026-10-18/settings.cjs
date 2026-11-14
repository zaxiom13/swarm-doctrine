const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(process.env.SWARM_ROOT||path.join(__dirname,'../../..'));
(async()=>{
  const {preview}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
  const server=await preview({root,preview:{host:'127.0.0.1',port:4187,strictPort:true}});
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  const results=[],errors=[];
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:4187');await page.waitForFunction(()=>!!window.game);
    await page.getByRole('button',{name:'Settings',exact:true}).tap();
    await page.locator('#setting-sound').uncheck();
    await page.reload();await page.waitForFunction(()=>!!window.game);
    await page.getByRole('button',{name:'Settings',exact:true}).tap();
    assert.equal(await page.locator('#setting-sound').isChecked(),false);
    for(const [width,height] of [[390,844],[844,390],[320,568],[568,320],[1280,720]]){
      await page.setViewportSize({width,height});
      await page.locator('#settings-screen').evaluate(e=>e.scrollTop=0);
      await page.waitForFunction(()=>{
        const s=document.querySelector('#settings-screen'),h=document.querySelector('#settings-title');
        const r=s.getBoundingClientRect(),t=h.getBoundingClientRect();
        return game.ui.screen==='settings-screen'&&!s.classList.contains('hidden')&&getComputedStyle(s).display!=='none'
          &&Math.abs(r.width-innerWidth)<1&&Math.abs(r.height-innerHeight)<1&&t.width>0&&t.x>=0
          &&t.right<=innerWidth&&t.y>=0&&t.bottom<=innerHeight&&document.fonts.status==='loaded'
          &&!s.getAnimations({subtree:true}).some(a=>a.playState==='running');
      });
      const heading=await page.locator('#settings-title').boundingBox();
      const bottom=page.locator('#btn-reset-progress');await bottom.scrollIntoViewIfNeeded();
      const bounds=await bottom.boundingBox();assert.ok(bounds);
      assert.ok(bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1);
      // Merely inspect Clear progress; never activate a destructive action.
      assert.equal(await page.locator('#setting-sound').isChecked(),false);
      results.push({width,height,visibleSettledSettings:true,heading,bottomActionReachable:true,soundChoiceRetained:true});
    }
    // The arrow-only PageHead's accessible name can include generated glyphs.
    // Use its scoped control rather than assume an exact text-only name.
    await page.locator('#settings-screen .btn-back').tap();
    assert.equal(await page.evaluate(()=>game.ui.screen),'main-menu');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(__dirname,'settings.json'),JSON.stringify({browser:browser.version(),results,actualSettingChangeAndReload:true,doneReturnsHome:true,pageErrors:errors,limitation:'Browser menus/DOM only, not Android frame/window/compositor proof.'},null,2)+'\n');
    console.log('Settings real navigation/toggle/reload, five viewport bounds and scroll reachability passed');
  }finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});

