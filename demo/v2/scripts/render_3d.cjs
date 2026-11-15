const {chromium}=require('../../../frontend/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const out=path.resolve('demo/v2/assets/brand/frames3d');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 page.on('pageerror',e=>console.error(e));
 await page.goto('http://127.0.0.1:8006/brand/scene.html');await page.waitForFunction(()=>window.sceneReady===true);
 const preview=process.argv.includes('--preview');
 const sequences=preview?[['intro',2],['outro',2]]:null;
 if(preview){for(const [name,t]of sequences){await page.evaluate(({t,c})=>window.renderFrame(t,c),{t,c:name==='outro'});await page.screenshot({path:path.join(out,name+'-preview.png')})}}
 else{
  for(const [name,count]of [['intro',216],['outro',151]]){
    for(let i=0;i<count;i++){
      await page.evaluate(({t,c})=>window.renderFrame(t,c),{t:i/30,c:name==='outro'});
      await page.screenshot({path:path.join(out,`${name}-${String(i).padStart(4,'0')}.png`)});
      if(i%60===0)console.log(name,i,count);
    }
  }
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
