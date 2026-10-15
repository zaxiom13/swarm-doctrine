const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(process.env.SWARM_ROOT||path.join(__dirname,'../../..'));
(async()=>{
  const {preview}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
  const server=await preview({root,preview:{host:'127.0.0.1',port:4185,strictPort:true}});
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  const results=[];
  try{
    for(const name of process.env.FIRST_VISIT_ONLY ? ['first-visit'] : ['first-visit','match-restart','rotation-restart','rotation-warm-reload']){
      const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
      const page=await context.newPage(),events=[],errors=[];
      let phase='online';
      page.on('request',r=>{if(phase==='offline')events.push({type:'request',url:r.url()});});
      page.on('response',r=>{if(phase==='offline')events.push({type:'response',url:r.url(),status:r.status(),worker:r.fromServiceWorker()});});
      page.on('requestfailed',r=>{if(phase==='offline')events.push({type:'failed',url:r.url(),error:r.failure()});});
      page.on('pageerror',e=>errors.push(String(e)));
      await page.goto('http://127.0.0.1:4185');await page.waitForFunction(()=>!!window.game);
      if(name!=='first-visit'){
        await page.evaluate(()=>{game.showTeamSelect('conquest');game.selectTeam('dragon');});
        if(name.startsWith('rotation')){
          for(const [width,height] of [[390,844],[844,390],[1280,720]]){
            await page.setViewportSize({width,height});
            await page.evaluate(()=>{game.ui.setDetailsOpen(true);document.activeElement?.blur();});
            await page.keyboard.press('Escape');
            await page.evaluate(()=>{game.ui.handleBack();game.ui.pauseSettings();game.ui.handleBack();game.ui.handleBack();});
            await page.mouse.move(12,height*.55);await page.mouse.down();
            await page.setViewportSize({width:height,height:width});await page.mouse.up();
            await page.setViewportSize({width,height});
            await page.evaluate(()=>{game.input.isTouch=true;game.input.pressFreeze();});
            await page.touchscreen.tap(width*.5,height*.6);
            await page.evaluate(()=>{game.pause();game.restart();});
          }
        }else await page.evaluate(()=>game.restart());
      }
      await page.evaluate(()=>navigator.serviceWorker.ready);
      await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
      if(name.endsWith('warm-reload')){await page.reload();await page.waitForFunction(()=>!!window.game);}
      const cached=await page.evaluate(async()=>{
        const cache=await caches.open((await caches.keys())[0]);
        const files=(await cache.keys()).filter(r=>/\.(js|css)$/.test(new URL(r.url).pathname));
        return Promise.all(files.map(async r=>{const response=await cache.match(r);return {url:r.url,type:response.headers.get('content-type'),bytes:(await response.arrayBuffer()).byteLength};}));
      });
      phase='offline';await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
      let passed=true;
      try{await page.waitForFunction(()=>!!window.game,{}, {timeout:5000,polling:100});}catch{passed=false;}
      const state=await page.evaluate(()=>({game:!!window.game,body:document.body.innerText.slice(0,150),controller:!!navigator.serviceWorker.controller,ready:document.readyState,hidden:document.hidden}));
      results.push({name,passed,state,cached,events,errors});console.log(name,passed,JSON.stringify(state));
      await context.close();
    }
    fs.writeFileSync(path.join(__dirname,process.env.RESULT_FILE||'offline.json'),JSON.stringify({browser:browser.version(),root:path.basename(root),results},null,2)+'\n');
  }finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
