// One real browser journey. The only injected UI is a noninteractive visible cursor.
const {chromium}=require('../../../frontend/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
const OUT=path.resolve(process.env.CAPTURE_OUTPUT||'demo/v2/recordings/take02');
fs.mkdirSync(OUT,{recursive:true});
const API=process.env.CAPTURE_API||'http://127.0.0.1:8004';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:800},recordVideo:{dir:OUT,size:{width:1600,height:800}}});
 await context.route('http://127.0.0.1:8000/**',r=>r.continue({url:r.request().url().replace('http://127.0.0.1:8000',API)}));
 await context.addInitScript(()=>{
   localStorage.setItem('protocolpulse.demoActor','ACT-COORD-01');
   document.addEventListener('DOMContentLoaded',()=>{
     const style=document.createElement('style');style.textContent='*{cursor:none!important}html{scroll-behavior:auto}';document.head.appendChild(style);
     const pointer=document.createElement('div');pointer.id='demo-pointer';
     pointer.style.cssText='position:fixed;left:800px;top:400px;width:28px;height:34px;pointer-events:none;z-index:2147483647;filter:drop-shadow(0 2px 3px #0007)';
     pointer.innerHTML='<svg viewBox="0 0 28 34"><path d="M2 1L24 20L14 21L10 31L5 29L9 19L1 22Z" fill="#fff" stroke="#08383e" stroke-width="2" stroke-linejoin="round"/></svg>';
     document.body.appendChild(pointer);
     window.addEventListener('mousemove',e=>{pointer.style.left=e.clientX+'px';pointer.style.top=e.clientY+'px'});
     window.addEventListener('mousedown',e=>{
       const ring=document.createElement('div');ring.style.cssText=`position:fixed;left:${e.clientX-16}px;top:${e.clientY-16}px;width:32px;height:32px;border:3px solid #15b79b;border-radius:100%;pointer-events:none;z-index:2147483646;background:#55ebbc44`;
       document.body.appendChild(ring);ring.animate([{transform:'scale(.45)',opacity:1},{transform:'scale(1.8)',opacity:0}],{duration:550,easing:'ease-out'}).onfinish=()=>ring.remove();
     });
   });
 });
 const page=await context.newPage();page.setDefaultTimeout(45000);
 const t0=Date.now();let mx=800,my=400;
 const proof={api:API,synthetic:true,mocked:false,viewport:[1600,800],marks:[],actions:[],mutations:[],pageErrors:[],errors:[]};
 page.on('pageerror',e=>proof.pageErrors.push(e.message));
 page.on('response',async r=>{if(r.url().includes('/api/v1/')&&r.request().method()!=='GET'){try{proof.mutations.push({time:(Date.now()-t0)/1000,url:r.url(),status:r.status(),body:await r.json()})}catch{}}});
 const time=()=> (Date.now()-t0)/1000;
 async function mark(name,hold=0){proof.marks.push({name,time:time()});await page.screenshot({path:`${OUT}/${name}.png`});if(hold)await sleep(hold);}
 async function scrollTo(locator,block='center'){
   await locator.waitFor({state:'visible'});
   const target=await locator.evaluate((el,block)=>{const r=el.getBoundingClientRect();return Math.max(0,window.scrollY+r.top-(block==='start'?100:(innerHeight-r.height)/2));},block);
   const from=await page.evaluate(()=>scrollY);
   const delta=target-from;
   if(Math.abs(delta)>10){
     for(let i=1;i<=30;i++){const p=i/30;const ease=p*p*(3-2*p);await page.evaluate(y=>scrollTo(0,y),from+delta*ease);await sleep(16);}
   }
 }
 async function top(){const from=await page.evaluate(()=>scrollY);for(let i=1;i<=25;i++){const p=i/25;await page.evaluate(y=>scrollTo(0,y),from*(1-p*p*(3-2*p)));await sleep(15)}}
 async function move(x,y){const sx=mx,sy=my;for(let i=1;i<=30;i++){const t=i/30;const e=t*t*(3-2*t);await page.mouse.move(sx+(x-sx)*e,sy+(y-sy)*e-12*Math.sin(Math.PI*t));await sleep(12)}mx=x;my=y;}
 async function click(locator,label){
   await scrollTo(locator);
   const b=await locator.boundingBox();await move(b.x+b.width*.52,b.y+b.height*.55);
   proof.actions.push({type:'click',label,time:time(),x:mx,y:my});await page.mouse.down();await sleep(85);await page.mouse.up();await sleep(240);
 }
 async function type(locator,value,label){await click(locator,label);await locator.press('Control+A');await page.keyboard.type(value,{delay:48});proof.actions.push({type:'typing',label,value,time:time()});await sleep(180);}
 async function role(value){const locator=page.locator('header select');await top();await click(locator,'Switch workspace');await locator.selectOption(value);await sleep(450);}
 async function nav(name){await top();await click(page.getByRole('navigation',{name:'Study workflow'}).getByRole('link',{name,exact:true}),`Navigate: ${name}`);await sleep(350);}
 try{
   await page.goto('http://localhost:3000/trials/TR-PX104/protocol');await page.waitForLoadState('networkidle');await page.mouse.move(mx,my);
   await mark('start');
   await page.locator('#pdf-file').setInputFiles('fixtures/protocols/px104-v1/PX-104-v1.0-fictional.pdf');
   await type(page.locator('#version-label'),'Launch 1.0','Name protocol version');
   await click(page.getByRole('checkbox').first(),'Declare synthetic protocol');
   await click(page.getByRole('button',{name:'Upload PDF',exact:true}),'Upload protocol PDF');
   await page.getByRole('button',{name:'Read rules from protocol',exact:true}).waitFor();
   await click(page.getByRole('button',{name:'Read rules from protocol',exact:true}),'Start AI protocol extraction');
   await mark('extract-wait');
   await page.getByRole('heading',{name:'Extracted rules (8)',exact:true}).waitFor({timeout:90000});
   await mark('extract-ready');
   await scrollTo(page.getByRole('heading',{name:'Extracted rules (8)',exact:true}),'start');
   await mark('rules',1200);
   await click(page.locator('summary').filter({hasText:/View source text for restricted medication/}).first(),'Expand protocol source clause');
   await mark('source',1300);
   await role('ACT-INV-01');
   await click(page.getByRole('button',{name:'Approve rules',exact:true}),'Review and approve protocol');
   await click(page.getByRole('dialog').getByRole('checkbox'),'Attest source review');
   await type(page.locator('#decision-reason'),'Source clauses and coverage reviewed.','Approval rationale');
   await mark('approve-protocol',350);
   await click(page.getByRole('button',{name:'Approve and put into use',exact:true}),'Activate reviewed rules');
   await page.getByText('All rules are approved by the Clinical Lead.',{exact:false}).waitFor();
   await mark('protocol-complete');
   await nav('Screen patients');
   await page.locator('#screen-date').fill('2026-10-31');
   await click(page.getByRole('button',{name:'Run screening',exact:true}),'Screen cohort');
   await mark('screen-wait');
   await page.getByText('30 patients screened for',{exact:false}).waitFor({timeout:90000});
   await mark('screen-ready');
   await click(page.getByRole('tab',{name:/All patients/}),'Show all screening outcomes');
   await page.getByRole('link',{name:'P-083',exact:true}).waitFor();
   await scrollTo(page.getByRole('tab',{name:/All patients/}),'start');
   await mark('cohort',1500);
   proof.runId=new URL(page.url()).searchParams.get('run');
   await click(page.getByRole('link',{name:'P-083',exact:true}),'Review uncertain medication evidence');
   await page.getByRole('heading',{name:'Patient P-083',exact:true}).waitFor();
   await scrollTo(page.getByRole('heading',{name:'Patient P-083',exact:true}),'start');
   await mark('uncertainty',1600);
   await click(page.getByRole('link',{name:'← All candidates',exact:true}),'Return to candidate cohort');
   await click(page.getByRole('tab',{name:/Potential match/}),'Show potential matches');
   await click(page.getByRole('link',{name:'P-042',exact:true}),'Open potential match P-042');
   await page.getByRole('heading',{name:'Patient P-042',exact:true}).waitFor();
   await mark('participation-start');
   await click(page.getByRole('button',{name:'Approve',exact:true}),'Record external participation');
   await click(page.getByRole('button',{name:'Confirm approval',exact:true}),'Confirm human participation decision');
   await page.getByText('P-042 approved: now participating.',{exact:true}).waitFor();
   await mark('participation-complete',500);
   await nav('Safety');
   await click(page.getByRole('button',{name:'Simulate new record',exact:true}),'Add a synthetic clinical record');
   await mark('event-form',1200);
   await click(page.getByRole('button',{name:'Add record',exact:true}),'Submit restricted medication administration');
   await mark('event-wait');
   await page.getByRole('link',{name:'Open case for patient P-042',exact:true}).waitFor({timeout:60000});
   await mark('event-ready');
   await scrollTo(page.getByRole('link',{name:'Open case for patient P-042',exact:true}));
   await mark('finding',1000);
   await click(page.getByRole('link',{name:'Open case for patient P-042',exact:true}),'Open resulting safety case');
   await page.locator('#next-status').waitFor();
   await mark('ai-wait');
   const cases=await page.request.get(API+'/api/v1/trials/TR-PX104/cases',{headers:{'X-Demo-Actor-Id':'ACT-INV-01'}}).then(r=>r.json());
   proof.caseId=cases.data.items[0].case_id;
   for(let i=0;i<45;i++){
     const c=await page.request.get(API+'/api/v1/cases/'+proof.caseId,{headers:{'X-Demo-Actor-Id':'ACT-INV-01'}}).then(r=>r.json());
     if(c.data.agent_execution_id){const e=await page.request.get(API+'/api/v1/agent-executions/'+c.data.agent_execution_id,{headers:{'X-Demo-Actor-Id':'ACT-INV-01'}}).then(r=>r.json());if(['SUCCEEDED','PARTIAL','FAILED'].includes(e.data.status)){proof.monitoringExecution=e.data;break}}
     await sleep(1000);
   }
   await mark('ai-ready');
   await click(page.getByRole('button',{name:'Refresh',exact:true}),'Refresh case evidence');
   await sleep(800);
   await scrollTo(page.getByRole('heading',{name:'Patient P-042',exact:true}),'start');
   await mark('case',1100);
   await click(page.getByRole('button',{name:'Open medication source record',exact:true}),'Inspect original medication record');
   await mark('case-evidence',1000);
   await scrollTo(page.locator('#next-status'));
   await click(page.locator('#next-status'),'Choose review status');await page.locator('#next-status').selectOption('ACKNOWLEDGED');
   await click(page.locator('#assignee'),'Assign clinical lead');await page.locator('#assignee').selectOption('ACT-INV-01');
   await type(page.locator('#disposition'),'Review required','Record decision');
   await type(page.locator('#rationale'),'Review restricted use against the cited protocol.','Record clinical rationale');
   await click(page.locator('form').getByRole('checkbox').first(),'Cite medication evidence');
   await mark('review',600);
   await click(page.getByRole('button',{name:'Review and submit',exact:true}),'Review human decision');
   await click(page.getByRole('button',{name:'Submit decision',exact:true}),'Submit clinical lead acknowledgement');
   await page.getByText('Case moved to Acknowledged by the clinical lead.',{exact:false}).waitFor();
   await sleep(600);
   await scrollTo(page.getByRole('heading',{name:'Patient P-042',exact:true}),'start');
   await mark('done',1800);
 }catch(e){proof.errors.push(e.message);await page.screenshot({path:OUT+'/error.png'});fs.writeFileSync(OUT+'/error.txt',await page.locator('body').innerText());throw e}
 finally{await context.close();proof.video=await page.video().path();proof.duration=time();fs.writeFileSync(OUT+'/journey.json',JSON.stringify(proof,null,2));await browser.close()}
 console.log(JSON.stringify({marks:proof.marks,errors:proof.errors,pageErrors:proof.pageErrors}));
})().catch(e=>{console.error(e);process.exitCode=1});
