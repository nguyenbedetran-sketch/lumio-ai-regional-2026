// Real isolated browser, actual TeacherPortal source/CSS, synthetic HTTP only.
async (page) => {
  const passed=[],errors=[],external=[],writes=[],gets=[],unexpected=[],clone=value=>JSON.parse(JSON.stringify(value));
  const check=(value,label)=>{if(!value)throw Error(label);passed.push(label);};
  const A={key:'synthetic-teacher-self-a',name:'QA · NGƯỜI GIẢNG DẠY A'},B={key:'synthetic-teacher-self-b',name:'QA · NGƯỜI GIẢNG DẠY B'};
  const empty=()=>({application:null,credential:{active:false,identityVerified:false,basis:'manual-review-of-declaration',approvedAt:null,revokedAt:null}});
  const states=new Map([[A.key,empty()],[B.key,empty()]]),receipts=new Map();
  let locationGets=0,locationMode='ok',nextGetError=null,nextPostError=null,loseAck=false,applied=0,holdPost=false,releasePost=null;
  page.on('pageerror',e=>errors.push(e.message));
  try {
  page.setDefaultTimeout(10000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/*',async route=>{
    const req=route.request(),url=req.url();
    if(/^https?:/.test(url)&&!/^http:\/\/(?:localhost|127\.0\.0\.1):3000\//.test(url)){external.push(url);return route.abort();}
    if(/\/api\//.test(url)){unexpected.push(req.method()+' '+url);return route.fulfill({status:409,json:{error:'SYNTHETIC_NO_UNEXPECTED_API'}});}
    return route.continue();
  });
  await page.route('**/__teacher-self-fixture',r=>r.fulfill({path:'work/teacher-self-ui/fixture.html',contentType:'text/html'}));
  await page.route('**/__teacher-self-fixture.js',r=>r.fulfill({path:'work/teacher-self-ui/fixture.js',contentType:'text/javascript'}));
  await page.route('**/__teacher-self-fixture.css',r=>r.fulfill({path:'work/teacher-self-ui/fixture.css',contentType:'text/css'}));
  await page.route('**/data/vietnam-locations-v5.2.0.json',async r=>{
    locationGets++;
    if(locationMode==='error')return r.fulfill({status:503,json:{error:'SYNTHETIC_DATA_UNAVAILABLE'}});
    if(locationMode==='malformed')return r.fulfill({json:{provinces:[{code:'01',name:'QA INVALID NO WARDS'}],metadata:{notice:'QA'}}});
    return r.fulfill({path:'public/data/vietnam-locations-v5.2.0.json',contentType:'application/json'});
  });
  await page.route('**/api/teacher-application',async route=>{
    const req=route.request(),key=req.headers()['x-lumio-account'];
    if(!states.has(key))throw Error('MISSING_OR_WRONG_ACCOUNT_HEADER');
    if(req.method()==='GET'){
      gets.push(key);
      if(nextGetError){const error=nextGetError;nextGetError=null;return route.fulfill({status:error.status,json:{error:error.code}});}
      return route.fulfill({json:clone(states.get(key))});
    }
    if(req.method()!=='POST')throw Error('UNEXPECTED_TEACHER_MUTATION');
    const body=req.postDataJSON();writes.push({key,body:clone(body)});
    if(holdPost){holdPost=false;await new Promise(resolve=>{releasePost=resolve;});}
    if(nextPostError){const error=nextPostError;nextPostError=null;if(error.html)return route.fulfill({status:500,contentType:'text/html',body:'<!DOCTYPE html><p>SYNTHETIC_PRIVATE_DIAGNOSTIC</p>'});return route.fulfill({status:error.status,json:{error:error.code,message:'SYNTHETIC_PRIVATE_DIAGNOSTIC'}});}
    const receiptKey=key+':'+body.requestId;
    if(receipts.has(receiptKey)){try{return await route.fulfill({json:receipts.get(receiptKey)});}catch{return;}}
    const current=states.get(key);
    if(body.expectedRevision!==(current.application?.revision||0))return route.fulfill({status:409,json:{error:'TEACHER_CONFLICT'}});
    const application={id:'synthetic-application-'+key,userId:key,applicantName:body.profile.applicantName,profile:clone(body.profile),status:'pending',revision:body.expectedRevision+1,submittedAt:'2026-10-15T12:00:00.000Z',updatedAt:'2026-10-15T12:01:00.000Z',reviewedAt:null,reviewNote:null};
    const result={...empty(),application};states.set(key,result);receipts.set(receiptKey,clone(result));applied++;
    if(loseAck){loseAck=false;return route.abort('failed');}
    try{return await route.fulfill({json:result});}catch{return;}
  });
  const field=name=>page.locator(`[name="${name}"]`),send=()=>page.locator('button[type=submit]');
  async function mount(account=A,providers={google:true,facebook:true},remount=true){await page.evaluate(({account,providers,remount})=>window.__mountTeacherSelf(account,providers,remount),{account,providers,remount});if(account)await field('school').waitFor();}
  async function reload(account=A){await page.reload();await mount(account);}
  async function ready(){await page.waitForFunction(()=>{const x=document.querySelector('[name=school]');return x&&!x.matches(':disabled');});}
  async function fillValid(school='TRƯỜNG QA · KHÔNG PHẢI HỒ SƠ THẬT'){
    await ready();await field('applicantName').fill('KIỂM THỬ GIAO DIỆN · HỒ SƠ TỔNG HỢP');
    await field('countryCode').selectOption('US');await field('provinceCity').fill('QA California');await field('ward').fill('QA School area');
    await field('school').fill(school);await field('teachingLevel').selectOption('preschool');await field('subjects').fill('Toán, Khoa học tự nhiên');
    const boxes=page.locator('.tp-declarations input[type=checkbox]');await boxes.nth(0).check();await boxes.nth(1).check();
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://localhost:3000/__teacher-self-fixture');
  await page.getByRole('button',{name:'Đăng nhập với Google',exact:false}).waitFor();
  check(await page.locator('form').count()===0&&gets.length===0&&writes.length===0,'Guest sees no private form or application request');
  await page.getByRole('button',{name:'Đăng nhập với Google',exact:false}).click();await page.getByRole('button',{name:'Đăng nhập với Facebook',exact:false}).click();
  const signins=await page.evaluate(()=>window.__teacherSignIns);
  check(signins.map(x=>x[0]).join(',')==='google,facebook'&&signins.every(x=>x[1].callbackUrl.endsWith('/__teacher-self-fixture')),'Guest sign-in buttons call the configured provider with return URL, without real OAuth');
  await mount(null,{google:false,facebook:false});await page.getByText('Đăng nhập chưa được cấu hình ở môi trường này.',{exact:true}).waitFor();
  check(await page.locator('.tp-signin button').count()===0,'Unavailable providers show a truthful setup state instead of a fake sign-in');
  await page.setViewportSize({width:390,height:844});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),'Guest teacher landing fits390px without horizontal overflow');
  await mount();await ready();
  check(gets.at(-1)===A.key&&await field('applicantName').inputValue()===A.name,'Signed-in form reads only the canonical account header and declared account name');
  await page.waitForFunction(()=>document.querySelectorAll('[name=provinceCity] option').length===35);
  check(await field('countryCode').locator('option').count()===249,'Country selector contains249 static country/territory labels');
  check(await field('teachingLevel').locator('option').count()===7&&await field('teachingLevel').locator('option[value=preschool]').count()===1,'Teaching levels include preschool through higher education and other');
  await field('provinceCity').selectOption('Thành phố Hà Nội');await field('ward').selectOption('Phường Ba Đình');
  check(await field('ward').inputValue()==='Phường Ba Đình'&&await field('ward').locator('option').count()===127,'Vietnam ward choices are constrained to the selected province from the pinned dataset');
  await field('provinceCity').selectOption('Thành phố Hồ Chí Minh');
  check(await field('ward').inputValue()==='','Changing province clears an old ward rather than keeping an inconsistent address');
  await field('countryCode').selectOption('US');
  check(await field('provinceCity').getAttribute('type')===null&&await field('provinceCity').inputValue()===''&&await field('ward').inputValue()==='','Changing country clears both location declarations and offers equivalent free-text areas');
  await field('provinceCity').fill('QA California');await field('ward').fill('QA School area');const beforeCountryChange=locationGets;
  await field('countryCode').selectOption('VN');
  check(await field('provinceCity').inputValue()===''&&await field('ward').inputValue()===''&&locationGets===beforeCountryChange,'Returning to Vietnam clears foreign location text and reuses local reference data');
  await page.getByRole('button',{name:'Không tìm thấy địa phương? Nhập thủ công',exact:true}).click();
  check(await field('provinceCity').evaluate(x=>x.tagName)==='INPUT','Vietnam has a visible manual declaration fallback');
  await field('provinceCity').fill('Địa phương QA tự khai');await field('ward').fill('Khu vực QA tự khai');
  check(await page.locator('form').evaluate(x=>x.checkValidity())===false,'Empty school/subject/declarations do not pass native required validation');
  await field('school').fill('TRƯỜNG KIỂM THỬ · KHÔNG THẬT');await field('subjects').fill('Toán; Khoa học tự nhiên');await field('applicantName').fill('HỒ SƠ QA · KHÔNG PHẢI GIÁO VIÊN THẬT');await field('teachingLevel').selectOption('preschool');
  const boxes=page.locator('.tp-declarations input[type=checkbox]');await boxes.nth(0).check();await send().click();
  check(writes.length===0,'Teacher declaration alone cannot submit without explicit server-storage consent');
  await boxes.nth(1).check();await field('publicEvidenceUrl').fill('http://example.test/school');
  check(await page.locator('form').evaluate(x=>x.checkValidity())===false,'Optional evidence must use HTTPS when supplied');
  await field('publicEvidenceUrl').fill('https://example.test/qa-school');await send().click();await page.locator('.tp-status-pending').waitFor();await ready();
  const first=writes[0].body;
  check(first.expectedRevision===0&&typeof first.requestId==='string'&&first.requestId.length>=8,'First submission sends revision zero and an idempotency request ID');
  check(first.profile.countryCode==='VN'&&first.profile.country==='Việt Nam'&&first.profile.provinceCity==='Địa phương QA tự khai'&&first.profile.ward==='Khu vực QA tự khai','Submission preserves selected country and self-declared province/ward labels');
  check(first.profile.teachingLevel==='preschool'&&first.profile.subjects.join('|')==='Toán|Khoa học tự nhiên'&&first.profile.teacherDeclaration===true&&first.profile.storageConsent===true,'Submission uses the current teaching-level/subjects and two explicit declaration fields');
  check(!('role'in first)&&!('status'in first)&&!('credential'in first)&&!('adultDeclaration'in first.profile)&&!('consent'in first.profile),'Frontend does not send forged roles, approval, credentials or superseded consent fields');
  check(await page.locator('.tp-status-pending').textContent().then(x=>x.includes('Phiên bản 1'))&&await send().isEnabled(),'Pending status shows the returned revision and permits bounded editing');
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'docs/v3/qa-teacher-self-desktop.png',fullPage:true});
  const beforeReload=writes.length;await reload();await page.locator('.tp-status-pending').waitFor();await ready();
  check(writes.length===beforeReload&&await field('subjects').inputValue()==='Toán, Khoa học tự nhiên','Reload restores pending server profile without resubmitting it');
  await page.getByRole('button',{name:'Không tìm thấy địa phương? Nhập thủ công',exact:true}).click();
  await field('school').fill('TRƯỜNG QA · BẢN SỬA B');loseAck=true;await send().click();await page.getByRole('alert').waitFor();
  check(await field('school').inputValue()==='TRƯỜNG QA · BẢN SỬA B'&&applied===2,'Lost-ACK network error preserves the entered draft while the synthetic server applies once');
  const lost=writes.at(-1).body,appliedBefore=applied;await send().click();await page.locator('.tp-success').waitFor();await ready();
  check(JSON.stringify(writes.at(-1).body)===JSON.stringify(lost)&&applied===appliedBefore,'Unchanged lost-ACK retry reuses the exact request ID/body and does not duplicate submission');
  await field('school').fill('TRƯỜNG QA · BẢN SỬA C');nextPostError={status:409,code:'TEACHER_CONFLICT'};await send().click();await page.getByRole('alert').waitFor();
  check((await page.getByRole('alert').textContent()).includes('Hồ sơ đã thay đổi')&&await field('school').inputValue()==='TRƯỜNG QA · BẢN SỬA C','CAS conflict is actionable and preserves the unsaved draft');
  check((await page.getByRole('alert').textContent()).includes('Tải lại sẽ thay nội dung'),'Refreshing after conflict clearly warns that saved server data replaces the form');
  await page.getByRole('button',{name:'Tải lại trạng thái',exact:true}).click();await ready();
  check(await field('school').inputValue()==='TRƯỜNG QA · BẢN SỬA B','Explicit refresh restores the saved revision after a conflict');
  await field('school').fill('TRƯỜNG QA · GIỮ NHÁP KHI LỖI');nextPostError={status:500,code:'SYNTHETIC_PRIVATE_DIAGNOSTIC'};await send().click();await page.getByRole('alert').waitFor();
  check(!(await page.locator('.tp-panel').textContent()).includes('SYNTHETIC_PRIVATE_DIAGNOSTIC')&&await field('school').inputValue()==='TRƯỜNG QA · GIỮ NHÁP KHI LỖI','Unknown server errors show friendly copy without echoing diagnostics or discarding the draft');
  nextPostError={status:500,html:true};await send().click();await page.getByRole('alert').waitFor();
  check(!(await page.locator('.tp-panel').textContent()).includes('<!DOCTYPE')&&!(await page.locator('.tp-panel').textContent()).includes('SYNTHETIC_PRIVATE_DIAGNOSTIC'),'Non-JSON HTTP errors cannot crash the UI or display raw HTML diagnostics');
  function review(status,revision){const saved=clone(states.get(A.key));saved.application.status=status;saved.application.revision=revision;saved.application.reviewNote='GHI CHÚ QA · CHỈ LÀ DỮ LIỆU TỔNG HỢP';saved.credential.active=status==='approved';states.set(A.key,saved);}
  review('approved',3);await reload();await page.locator('.tp-status-approved').waitFor();
  check(await send().isDisabled()&&await field('school').isDisabled()&&await boxes.nth(0).isDisabled(),'Approved applications cannot be edited or silently resubmitted while active');
  check((await page.locator('.tp-status-approved').textContent()).includes('không phải chứng nhận danh tính')&&(await page.locator('.tp-guide').textContent()).includes('không tự cấp quyền quản trị'),'Approval explicitly remains manual declaration review without admin/student access claims');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/v3/qa-teacher-self-mobile.png',fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),'Signed-in approval, all form fields and declaration copy fit390px');
  review('rejected',4);await reload();await page.locator('.tp-status-rejected').waitFor();await ready();
  check((await page.locator('.tp-status-rejected').textContent()).includes('GHI CHÚ QA')&&await send().isEnabled(),'Rejected profile exposes the review note and allows a new pending revision');
  await page.getByRole('button',{name:'Không tìm thấy địa phương? Nhập thủ công',exact:true}).click();await field('school').fill('TRƯỜNG QA · GỬI LẠI SAU TỪ CHỐI');await send().click();await page.locator('.tp-success').waitFor();
  check(writes.at(-1).body.expectedRevision===4&&states.get(A.key).application.status==='pending','Rejected resubmission uses the current revision and returns pending, never self-approval');
  review('revoked',6);await reload();await page.locator('.tp-status-revoked').waitFor();await ready();
  check((await page.locator('.tp-status-revoked').textContent()).includes('đã thu hồi')&&await send().isEnabled(),'Revocation is distinct from approval and permits a new review request');
  nextGetError={status:401,code:'SIGN_IN_REQUIRED'};await mount(B);await page.getByRole('alert').waitFor();
  check((await page.getByRole('alert').textContent()).includes('Phiên đăng nhập đã hết')&&await send().isDisabled(),'Initial auth failure shows recovery copy and keeps the private form locked');
  await page.getByRole('button',{name:'Tải lại trạng thái',exact:true}).click();await ready();
  check(await field('applicantName').inputValue()===B.name&&await field('school').inputValue()==='','Recovering under another account never restores the prior applicant profile');
  await fillValid();nextPostError={status:401,code:'SESSION_REVOKED'};await send().click();await page.getByRole('alert').waitFor();
  check((await page.getByRole('alert').textContent()).includes('phiên đã thay đổi')&&await send().isDisabled(),'Revoked-auth POST locks further submission and does not claim success');
  locationMode='error';await mount(B);await page.getByRole('button',{name:'Thử tải lại danh mục',exact:true}).waitFor();await ready();
  await page.getByRole('button',{name:'Không tìm thấy địa phương? Nhập thủ công',exact:true}).click();
  check(await field('provinceCity').evaluate(x=>x.tagName)==='INPUT'&&await field('provinceCity').isEnabled(),'Reference-data outage still allows an explicitly self-declared manual location');
  locationMode='malformed';await mount(B);await page.getByRole('button',{name:'Thử tải lại danh mục',exact:true}).waitFor();
  check(await page.getByRole('button',{name:'Không tìm thấy địa phương? Nhập thủ công',exact:true}).isVisible(),'Malformed location structure is rejected into recovery instead of crashing wards rendering');
  locationMode='ok';await page.getByRole('button',{name:'Thử tải lại danh mục',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[name=provinceCity] option').length===35);
  check(await page.getByRole('button',{name:'Thử tải lại danh mục',exact:true}).count()===0,'Location retry can recover using the actual pinned local data');
  // Keep the same outer component key: root must isolate account changes itself.
  await mount(A);await ready();await fillValid('QA · DELAYED ACCOUNT A');holdPost=true;await send().click();await page.waitForFunction(()=>document.querySelector('button[type=submit]').textContent.includes('Đang gửi'));
  await mount(B,{google:true,facebook:true},false);await ready();
  const release=releasePost;if(!release)throw Error('DELAYED_POST_WAS_NOT_CAPTURED');release();
  await page.waitForTimeout(100);
  check(await field('applicantName').inputValue()===B.name&&await field('school').inputValue()===''&&await page.locator('.tp-status').count()===0,'Changing canonical account aborts/discards a delayed old-account submission and clears private draft/state');
  check(errors.length===0,'No runtime errors across guest, form validation, retries, statuses, account changes and malformed data');
  check(external.length===0&&unexpected.length===0,'No real OAuth, teacher application, evidence URL, AI provider or unexpected API request escaped fixtures');
  return {status:'PASS',passed:passed.length,cases:passed,errors,actualTeacherApplications:0,realProviderCalls:0,syntheticPOSTs:writes.length,syntheticApplied:applied,syntheticGETs:gets.length,locationDataReads:locationGets,screenshots:['docs/v3/qa-teacher-self-desktop.png','docs/v3/qa-teacher-self-mobile.png'],scope:'Actual TeacherPortal React/CSS in an explicitly labelled synthetic intercepted page; browser behavior only, not real OAuth/public teacher approval or physical-device evidence'};
  } catch(error) {
    try { await page.screenshot({path:'work/teacher-self-ui/failure.png',fullPage:true}); } catch {}
    return {status:'FAIL',passed:passed.length,cases:passed,error:error.message,errors,syntheticPOSTs:writes.length,syntheticGETs:gets.length,actualTeacherApplications:0,realProviderCalls:0};
  }
}
