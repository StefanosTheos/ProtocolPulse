const {chromium}=require('../../../frontend/node_modules/playwright');
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
 await page.goto(pathToFileURL(path.resolve('demo/v2/final_demo.mp4')).href);const video=page.locator('video');await video.waitFor();
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
 const result=await video.evaluate(async v=>{v.muted=true;v.playbackRate=8;await v.play();await new Promise((ok,fail)=>{v.onended=ok;v.onerror=()=>fail(new Error('Decode error'));setTimeout(()=>fail(new Error('Playback timeout')),20000)});return {duration:v.duration,width:v.videoWidth,height:v.videoHeight,ended:v.ended,error:v.error,frames:v.getVideoPlaybackQuality().totalVideoFrames}});
 fs.writeFileSync('demo/v2/assets/qa/browser-playback.json',JSON.stringify(result,null,2));console.log(result);await browser.close();if(result.duration!==60||!result.ended||result.error)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
