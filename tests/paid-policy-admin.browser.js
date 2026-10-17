async(page)=>{
 const checks=[],errors=[],calls=[],unexpected=[],shots=[];let server=null,postMode='ok',hold=null;
 const check=(v,n)=>{if(!v)throw Error(n);checks.push(n)};const copy=v=>JSON.parse(JSON.stringify(v));
 page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.route('**/*',async route=>{const req=route.request(),u={pathname:req.url().replace(/^https?:\/\/[^/]+/,'').split('?')[0]};
 if(u.pathname==='/__paid')return route.fulfill({path:'work/paid-policy-admin-ui/fixture.html',contentType:'text/html'});
 if(u.pathname==='/__v7-usage-ui.css')return route.fulfill({path:'work/paid-policy-admin-ui/fixture.css',contentType:'text/css'});
 if(u.pathname==='/__v7-usage-ui.js')return route.fulfill({path:'work/paid-policy-admin-ui/fixture.js',contentType:'text/javascript'});
 if(u.pathname==='/defaults'){return route.fulfill({path:'work/paid-policy-admin-ui/defaults.json',contentType:'application/json'})}
 if(u.pathname==='/api/billing/paid-policy'){
  const entry={method:req.method(),account:req.headers()['x-lumio-account'],body:req.method()==='POST'?req.postDataJSON():null};calls.push(entry);
  if(req.method()==='POST'){
   if(postMode==='conflict')return route.fulfill({status:409,json:{error:'PAID_POLICY_CONFLICT'}});
   if(postMode==='unknown')return route.fulfill({status:503,json:{error:'DATABASE_WRITE_OUTCOME_UNKNOWN'}});
   const p=server.plans.find(x=>x.planId===entry.body.planId);p.config=entry.body.config;p.revision++;return route.fulfill({json:copy(server)});
  }
  if(entry.account==='qa-late')return new Promise(resolve=>{hold=async()=>{await route.fulfill({json:{...copy(server),configuredAliases:[{mode:'OLD-ACCOUNT-MARKER',configuredProviders:1}]}});resolve()}});
  return route.fulfill({json:copy(server)});
 }
 if(u.pathname.includes('/fonts/'))return route.fulfill({status:404,body:''});unexpected.push(req.url());return route.fulfill({status:409,body:'FIXTURE_BLOCKED'});
 });
 await page.goto('http://paid.fixture.test/__paid');server=await page.evaluate(async()=>await(await fetch('/defaults')).json());
 check(calls.length===0,'No network configuration write or load happens on mount');
 await page.getByRole('button',{name:'Tải cấu hình',exact:true}).click();await page.getByLabel('Giá đề xuất theo tháng (VNĐ)',{exact:true}).waitFor();
 check(calls.length===1&&calls[0].method==='GET'&&calls[0].account==='qa-usage-a','Explicit read binds the displayed canonical account');
 check(await page.getByLabel('Giá đề xuất theo tháng (VNĐ)',{exact:true}).inputValue()==='129000','Premium initial value is the authored server config');
 check((await page.locator('main').innerText()).includes('chưa mở thanh toán')&&(await page.locator('main').innerText()).includes('không thuộc biểu mẫu'),'No sale or Free/Plus edit control is implied');
 await page.getByLabel('Giá đề xuất theo tháng (VNĐ)',{exact:true}).fill('130000');await page.getByLabel('Gói cần điều chỉnh',{exact:true}).selectOption('pro');await page.getByLabel('Gói cần điều chỉnh',{exact:true}).selectOption('premium');
 check(await page.getByLabel('Giá đề xuất theo tháng (VNĐ)',{exact:true}).inputValue()==='130000','Switching plan preserves its unsaved draft');
 check(await page.getByRole('button',{name:'Lưu cấu hình Premium',exact:true}).isDisabled(),'Save requires an audit reason');
 await page.getByLabel('Gói cần điều chỉnh',{exact:true}).selectOption('pro');await page.getByLabel('Giá đề xuất theo tháng (VNĐ)',{exact:true}).fill('250000');await page.getByLabel('Gói cần điều chỉnh',{exact:true}).selectOption('premium');
 await page.getByLabel('Lý do thay đổi (8–300 ký tự)',{exact:true}).fill('Kiểm thử cấu hình có lý do');await page.getByRole('button',{name:'Lưu cấu hình Premium',exact:true}).click();await page.getByRole('status').filter({hasText:'Máy chủ đã xác nhận'}).waitFor();
 let posted=calls.find(x=>x.method==='POST');check(posted.body.planId==='premium'&&posted.body.expectedRevision===0&&posted.body.config.monthlyPriceMinor===130000,'Save sends only selected paid plan and its captured server revision');
 check(server.plans[0].revision===1&&(await page.locator('main').innerText()).includes('Phiên bản máy chủ: 1'),'Only acknowledged server config advances visible revision');
 await page.getByLabel('Gói cần điều chỉnh',{exact:true}).selectOption('pro');check(await page.getByLabel('Giá đề xuất theo tháng (VNĐ)',{exact:true}).inputValue()==='250000','Saving Premium preserves the separate unsaved Pro draft');await page.getByLabel('Gói cần điều chỉnh',{exact:true}).selectOption('premium');
 await page.getByLabel('Giá đề xuất theo tháng (VNĐ)',{exact:true}).fill('131000');await page.getByLabel('Lý do thay đổi (8–300 ký tự)',{exact:true}).fill('Kiểm thử xung đột phiên bản');postMode='conflict';await page.getByRole('button',{name:'Lưu cấu hình Premium',exact:true}).click();await page.getByRole('alert').waitFor();
 check(await page.getByLabel('Giá đề xuất theo tháng (VNĐ)',{exact:true}).inputValue()==='131000','Conflict preserves typed draft rather than claiming it was saved');
 check((await page.getByRole('alert').innerText()).includes('đối chiếu'),'Conflict explains the required readback');
 postMode='unknown';await page.getByRole('button',{name:'Lưu cấu hình Premium',exact:true}).click();await page.getByRole('alert').filter({hasText:'Chưa xác nhận'}).waitFor();check(await page.getByLabel('Giá đề xuất theo tháng (VNĐ)',{exact:true}).inputValue()==='131000','Unknown write keeps draft and no false success');
 await page.getByRole('button',{name:'Tải lại và bỏ bản chưa lưu',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã đọc'}).waitFor();
 check(await page.getByLabel('Giá đề xuất theo tháng (VNĐ)',{exact:true}).inputValue()==='130000','Explicit discard/readback returns authoritative server state');
 await page.getByText('Quyền, tác vụ và hệ số nâng cao',{exact:true}).click();await page.getByLabel('Cấu hình Premium/Pro (JSON)',{exact:true}).fill('{broken');
 check(await page.getByRole('button',{name:'Lưu cấu hình Premium',exact:true}).isDisabled(),'Malformed JSON cannot submit');
 await page.getByRole('button',{name:'Tải lại và bỏ bản chưa lưu',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã đọc'}).waitFor();
 for(const theme of ['light','dark'])for(const width of [1440,768,390,320]){await page.evaluate(v=>document.documentElement.dataset.theme=v,theme);await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);const l=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,controls:[...document.querySelectorAll('.ad-paid-policy input,.ad-paid-policy textarea,.ad-paid-policy select,.ad-paid-policy button')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().right)}));check(l.scroll<=l.client+1&&l.controls.every(r=>r<=width+1),theme+' controls remain inside viewport at'+width);if(width===1440||width===390){const p='docs/next/reports/paid-policy-admin-ui/'+theme+'-'+width+'.png';await page.screenshot({path:p,fullPage:true});shots.push(p)}}
 await page.evaluate(()=>window.__mountPaid('qa-readonly',true,false));await page.getByRole('button',{name:'Tải cấu hình',exact:true}).click();await page.getByLabel('Giá đề xuất theo tháng (VNĐ)',{exact:true}).waitFor();check(await page.getByLabel('Giá đề xuất theo tháng (VNĐ)',{exact:true}).isDisabled(),'Read-only admin has no editable paid fields');
 await page.evaluate(()=>window.__mountPaid('qa-late',false));await page.getByRole('button',{name:'Tải cấu hình',exact:true}).click();await page.waitForTimeout(100);await page.evaluate(()=>window.__mountPaid('qa-current',false));if(hold)await hold();await page.waitForTimeout(100);check(!(await page.locator('main').innerText()).includes('OLD-ACCOUNT-MARKER'),'Late prior-account result cannot render after an account switch');await page.getByRole('button',{name:'Tải cấu hình',exact:true}).click();await page.getByLabel('Giá đề xuất theo tháng (VNĐ)',{exact:true}).waitFor();check(calls.at(-1).account==='qa-current','Reload after switch captures only the current account');
 check(errors.length===0,'No uncaught browser error');check(unexpected.length===0,'Every test HTTP request was intercepted');
 return{status:'PASS',passed:checks.length,checks,errors,unexpected,requests:calls.map(c=>({method:c.method,account:c.account})),screenshots:shots,actualPaymentRequests:0};
 }catch(e){await page.screenshot({path:'work/paid-policy-admin-ui/debug.png',fullPage:true});return{status:'FAIL',passed:checks.length,checks,errors,error:e.message,snapshot:(await page.locator('body').innerText()).slice(-5000)}}
}
