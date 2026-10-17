async(page)=>{
 const checks=[],errors=[],unexpected=[],calls=[],screenshots=[],layouts=[];let currentPlan='free';const check=(v,n)=>{if(!v)throw Error(n);checks.push(n)};
 page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.route('**/*',async route=>{const req=route.request(),p=req.url().replace(/^https?:\/\/[^/]+/,'').split('?')[0];
  if(p==='/__paid')return route.fulfill({path:'work/paid-plan-ui/fixture.html',contentType:'text/html'});
  if(p==='/__paid.js')return route.fulfill({path:'work/paid-plan-ui/fixture.js',contentType:'text/javascript'});
  if(p==='/__paid.css')return route.fulfill({path:'work/paid-plan-ui/fixture.css',contentType:'text/css'});
  if(p==='/api/billing/catalog'||p==='/api/billing'){
   calls.push({method:req.method(),path:p});const catalog=await page.evaluate(()=>{const definitions={free:{modes:['quick','tutor'],kinds:['text'],voice:false,maxVideoSeconds:600},plus:{modes:['quick','tutor','think'],kinds:['text','image','pdf'],voice:false,maxVideoSeconds:600}};return{plans:['free','plus','premium','pro'].map(id=>{const paid=['premium','pro'].includes(id),config=paid?window.__policyDefaults(id):null;return{id,name:id[0].toUpperCase()+id.slice(1),monthlyPriceMinor:id==='free'?0:null,yearlyPriceMinor:id==='free'?0:null,credits:id==='free'?200:null,creditsPeriod:id==='free'?'one_time_trial':'month',checkoutAvailable:false,entitlements:paid?{modes:config.allowedModes,kinds:config.allowedKinds,voice:config.voice,maxVideoSeconds:config.maxVideoSeconds}:definitions[id],...(paid?{paidPolicy:{planId:id,revision:0,config}}:{})}}),packs:[],rates:{tasks:{chat:2,summary:8,cards:6,quiz:6,speech:5,transcription:8,index:4},modes:{quick:0,tutor:1,think:3,deep:6},kinds:{text:0,image:4,pdf:3,audio:4,video:8},videoPerMinute:2},trialCredits:200}});
   return route.fulfill({json:p.endsWith('catalog')?catalog:{catalog,account:{userId:'qa-paid-user',planId:currentPlan,planName:currentPlan==='pro'?'Pro':'Premium',planSource:'sandbox',balance:200,reserved:0,periodEnd:null,cancelAtPeriodEnd:false,nextPlanId:null},history:[],sandbox:false}});
  }
  unexpected.push(req.url());return route.fulfill({status:409,body:'FIXTURE_NETWORK_BLOCKED'});
 });
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://paid.fixture.test/__paid');await page.locator('.lm-plan').first().waitFor();
 check(await page.locator('.lm-plan').count()===4,'Actual BillingPanel preserves four cards');
 const cards=page.locator('.lm-plan');check((await cards.nth(0).innerText()).includes('200')&&(await cards.nth(1).innerText()).includes('59.000'),'Free200/Plus59000 authored preview remains');
 check((await cards.nth(2).innerText()).includes('129.000')&&(await cards.nth(3).innerText()).includes('249.000'),'Paid cards show centralized proposal prices');
 check(!(await cards.nth(2).innerText()).includes('Phân tích chuyên sâu')&&(await cards.nth(3).innerText()).includes('Phân tích chuyên sâu'),'Premium and Pro expose distinct configured mode access');
 await cards.nth(2).getByRole('button').click();await page.locator('[data-paid-plan-details=premium]').waitFor();
 const details=page.locator('[data-paid-plan-details=premium]');check((await details.innerText()).includes('30.000')&&(await details.innerText()).includes('quyền giáo viên'),'Source and separate teaching authority limits are visible');
 await details.locator('summary').focus();await details.locator('summary').press('Enter');await details.getByLabel('Số ký tự nguồn',{exact:true}).fill('12001');check((await details.locator('output').innerText()).includes('4 credits'),'Paid calculator uses source chunks and shared server policy arithmetic');
 await details.getByLabel('Chế độ',{exact:true}).selectOption('think');check((await details.locator('output').innerText()).includes('16 credits'),'Configured mode factor changes quote');
 await details.getByLabel('Số ký tự nguồn',{exact:true}).fill('30001');check((await details.locator('output').innerText()).includes('vượt chính sách'),'Over-policy input is rejected without payment/provider action');
 await details.getByLabel('Số ký tự nguồn',{exact:true}).fill('0');
 for(const theme of ['light','dark'])for(const width of [1440,768,390,320]){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);const l=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,dialog:[...document.querySelectorAll('[role=dialog]')].map(e=>({scroll:e.scrollWidth,client:e.clientWidth})),controls:[...document.querySelectorAll('[data-paid-plan-details] input,[data-paid-plan-details] select')].map(e=>e.getBoundingClientRect().height)}));layouts.push({theme,width,...l});check(l.scroll<=l.client+1&&l.dialog.every(d=>d.scroll<=d.client+1),theme+' paid dialog remains within'+width);check(l.controls.every(h=>h>=43),theme+' paid controls retain44px targets at'+width);if(width===1440||width===390){const shot='docs/next/reports/paid-plans/'+theme+'-'+width+'.png';await page.screenshot({path:shot,fullPage:true});screenshots.push(shot)}}
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 currentPlan='premium';await page.evaluate(()=>window.__billingMount('vi',true));await page.locator('.lm-billing-wallet strong').first().waitFor();await page.locator('[data-paid-plan-details=premium]').waitFor();
 check(await page.locator('.lm-credit-calculator').count()===0,'Paid account sees policy calculator instead of obsolete legacy estimator');
 check((await page.locator('.lm-billing-wallet').innerText()).includes('200'),'Reading paid proposal never simulates credit deposits');
 for(const locale of ['en','zh-CN','ja','ko']){await page.evaluate(locale=>window.__billingMount(locale,true),locale);await page.locator('[data-paid-plan-details=premium]').waitFor();check(await page.locator('[data-paid-plan-details] summary').count()===1,'Paid detail/calculator available in '+locale)}
 check(calls.every(c=>c.method==='GET'),'All UI requests remain read-only; no checkout or grant request');check(unexpected.length===0,'No unexpected outbound request');check(errors.length===0,'No browser runtime error');
 return{status:'PASS',passed:checks.length,checks,errors,unexpected,calls,screenshots,layouts,realProviderCalls:0,realPayments:0,scope:'Actual BillingPanel/paid details and CSS; authored catalog/wallet with intercepted HTTP only. No real account, payment, merchant or public entitlement sale.'};
 }catch(e){return{status:'FAIL',passed:checks.length,checks,error:e.message,errors,unexpected,snapshot:(await page.locator('body').innerText()).slice(-5000)}}
}
