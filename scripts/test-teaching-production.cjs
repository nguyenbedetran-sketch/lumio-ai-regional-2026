// Black-box checks against a compiled Next server and an isolated SQLite file.
// Only signed synthetic sessions are used. No user env, OAuth or AI provider calls.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {DatabaseSync} = require('node:sqlite');
const {encode} = require('next-auth/jwt');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/teacher-workspace/production-http-report.json');
const checks = [];
const report = {status:'RUNNING', checkedAt:new Date().toISOString(), scope:'Compiled next start, actual HTTP handlers and separate SQLite; manually authored school content, synthetic sessions/accounts. No mock business handlers. Not Google OAuth, real teacher identity, real students, provider or physical device testing.', providerCalls:0, phases:{}, checks};
let server, db, scratch;
function save(){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
async function check(phase,name,fn){await fn();checks.push({phase,name,status:'PASS'});console.log('PASS '+name);save();}
async function freePort(){const s=net.createServer();await new Promise((r,j)=>s.once('error',j).listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
async function main(){
  assert.ok(fs.existsSync(path.join(root,'.next/BUILD_ID')),'Run pnpm build first.');
  // Dotenv files would reintroduce real credentials: use a clean release checkout.
  assert.ok(!['.env','.env.local','.env.production','.env.production.local'].some(f=>fs.existsSync(path.join(root,f))),'Use a clean source checkout without private .env files.');
  scratch=fs.mkdtempSync(path.join(os.tmpdir(),'lumio-teaching-compiled-'));
  const secret=crypto.randomBytes(48).toString('hex'), origin='http://127.0.0.1:'+await freePort(), dbPath=path.join(scratch,'fixture.sqlite');
  const env={};
  for(const k of ['SystemRoot','SYSTEMROOT','WINDIR','PATH','Path','TEMP','TMP','COMSPEC','ComSpec','PATHEXT'])if(process.env[k])env[k]=process.env[k];
  Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',NEXTAUTH_URL:origin,NEXTAUTH_SECRET:secret,GOOGLE_CLIENT_ID:'synthetic-compiled-client.invalid',GOOGLE_CLIENT_SECRET:'synthetic-not-provider-credential',LUMIO_DB_PATH:dbPath,LUMIO_ALLOW_LOCAL_DB_PRODUCTION:'true',LUMIO_AI_ENABLED:'false'});
  let log='';
  server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',new URL(origin).port],{cwd:root,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  server.stdout.on('data',b=>{log=(log+b).slice(-16000);});server.stderr.on('data',b=>{log=(log+b).slice(-16000);});
  let started=false;
  for(let i=0;i<100;i++){
    if(server.exitCode!==null)throw Error('COMPILED_SERVER_EXITED');
    try{const r=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(1500)});if(r.status===200){started=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(started,'Compiled server readiness');
  db=new DatabaseSync(dbPath);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const users={};
  for(const name of ['owner','teacher','otherTeacher','student','otherStudent','outsider']){
    const id=crypto.randomUUID(), key='synthetic-teaching:'+id, stamp=new Date().toISOString();
    db.prepare('INSERT INTO users(id,storage_key,name,email,role,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)').run(id,key,'SYNTHETIC '+name,null,name==='owner'?'SUPER_ADMIN':'USER',stamp,stamp);
    const token=await encode({secret,token:{userId:id,accountKey:key,sessionVersion:1,authenticatedAt:Date.now()},maxAge:1800});
    users[name]={id,key,cookie:'next-auth.session-token='+token};
  }
  function headers(u,extra={}){return {origin,'content-type':'application/json',...(u?{cookie:u.cookie,'x-lumio-account':u.key}:{}),...extra};}
  async function get(u,orgId,endpoint='/api/teaching'){
    const r=await fetch(origin+endpoint+(orgId?'?orgId='+encodeURIComponent(orgId):''),{headers:headers(u)});return {r,v:await r.json()};
  }
  async function mutate(u,body,status=200,extra={}){
    const r=await fetch(origin+'/api/teaching',{method:'POST',headers:headers(u,extra),body:JSON.stringify({requestId:crypto.randomUUID(),...body})});
    const v=await r.json();assert.equal(r.status,status,v.error||'Unexpected teaching status');assert.match(r.headers.get('cache-control'),/no-store/);return v;
  }
  async function approve(u){
    const p={applicantName:'SYNTHETIC '+u.id,countryCode:'VN',country:'Việt Nam',provinceCity:'Địa phương thử nghiệm',ward:'Phường thử nghiệm',school:'Cơ sở thử nghiệm không có thật',teachingLevel:'lower_secondary',subjects:['Toán'],teacherDeclaration:true,storageConsent:true};
    const r=await fetch(origin+'/api/teacher-application',{method:'POST',headers:headers(u),body:JSON.stringify({requestId:crypto.randomUUID(),expectedRevision:0,profile:p})});
    assert.equal(r.status,200);const app=(await r.json()).application;
    const reviewed=await fetch(origin+'/api/admin/teachers',{method:'PATCH',headers:headers(users.owner),body:JSON.stringify({requestId:crypto.randomUUID(),applicationId:app.id,expectedRevision:app.revision,action:'approve',note:'Synthetic isolated test only; not real identity verification.'})});
    assert.equal(reviewed.status,200);assert.equal((await reviewed.json()).credential.active,true);
  }
  let orgA,orgB,classA,classB,invite,question,assignment,submission;
  await check(1,'Compiled endpoints deny anonymous, cross-origin and forged account binding',async()=>{
    assert.equal((await get(null)).r.status,401);
    await mutate(users.student,{action:'org.create',name:'Forbidden'},403);
    await mutate(users.owner,{action:'org.create',name:'Wrong origin'},403,{origin:'https://evil.invalid'});
    await mutate(users.owner,{action:'org.create',name:'Wrong account'},401,{'x-lumio-account':'not-this-account'});
  });
  await check(1,'Teacher credential approval and explicit organization/class creation use persisted handlers',async()=>{
    await approve(users.teacher);await approve(users.otherTeacher);
    orgA=(await mutate(users.teacher,{action:'org.create',name:'SYNTHETIC TEACHING A'})).result.orgId;
    orgB=(await mutate(users.otherTeacher,{action:'org.create',name:'SYNTHETIC TEACHING B'})).result.orgId;
    assert.ok(orgA&&orgB&&orgA!==orgB);
    const a=await mutate(users.teacher,{action:'class.create',orgId:orgA,name:'Lớp kiểm thử 8',subject:'Toán',grade:'8',description:'Dữ liệu do kiểm thử nhập, không phải lớp thật.'});classA=a.state.classes[0];
    const b=await mutate(users.otherTeacher,{action:'class.create',orgId:orgB,name:'Lớp tổ chức B',subject:'Toán',grade:'8',description:''});classB=b.state.classes[0];
    assert.equal(a.state.dashboard.classes,1);assert.equal(a.state.dashboard.students,0);
    assert.equal((await get(users.owner,orgA)).r.status,403,'Super admin is not automatic classroom member.');
  });
  await check(1,'Hashed invite joins the intended class; replay is idempotent and tenant reads are isolated',async()=>{
    const a=await mutate(users.teacher,{action:'invite.create',orgId:orgA,classId:classA.id,expectedRevision:classA.revision,expiresInDays:1,maxUses:2});invite=a.result.inviteCode;assert.ok(invite);
    const req={action:'class.join',code:invite,requestId:crypto.randomUUID()};
    await mutate(users.student,req);const repeat=await mutate(users.student,req);assert.equal(repeat.replayed,true);
    await mutate(users.otherStudent,{action:'class.join',code:invite});
    assert.equal((await get(users.student,orgA)).v.classes[0].id,classA.id);
    assert.equal((await get(users.student,orgB)).r.status,403);
    assert.equal((await get(users.otherTeacher,orgA)).r.status,403);
  });
  await check(2,'Manual question draft requires teacher review and cannot be assigned unreviewed',async()=>{
    const draft={classId:classA.id,prompt:'Giải phương trình 3x - 6 = 9. Giá trị x bằng bao nhiêu?',kind:'mcq',choices:['5','6','7','8'],correctIndex:0,explanation:'3x = 15 nên x = 5.',maxPoints:10,topic:'Phương trình bậc nhất',difficulty:'basic',references:[]};
    const made=await mutate(users.teacher,{action:'question.create',orgId:orgA,draft});question=made.state.questions[0];assert.equal(question.status,'draft');
    const aDraft={classId:classA.id,title:'Bài kiểm thử phương trình',instructions:'Chọn một đáp án.',questionIds:[question.id],target:{kind:'class',ids:[]},dueAt:new Date(Date.now()+86400000).toISOString()};
    await mutate(users.teacher,{action:'assignment.create',orgId:orgA,draft:aDraft},409);
    const reviewed=await mutate(users.teacher,{action:'question.review',orgId:orgA,id:question.id,expectedRevision:question.revision});question=reviewed.state.questions[0];assert.equal(question.status,'reviewed');
    const created=await mutate(users.teacher,{action:'assignment.create',orgId:orgA,draft:aDraft});assignment=created.state.assignments[0];
    const review=await mutate(users.teacher,{action:'assignment.review',orgId:orgA,id:assignment.id,expectedRevision:assignment.revision});assignment=review.state.assignments[0];
    const issue=await mutate(users.teacher,{action:'assignment.issue',orgId:orgA,id:assignment.id,expectedRevision:assignment.revision});assignment=issue.state.assignments[0];assert.equal(assignment.status,'issued');
  });
  await check(2,'Student payload omits answer keys, explanation, internal rubric and roster',async()=>{
    const {r,v}=await get(users.student,orgA);assert.equal(r.status,200);const q=v.assignments[0].questions[0];
    for(const k of ['correctIndex','modelAnswer','explanation','rubric'])assert.equal(Object.hasOwn(q,k),false,k);
    assert.equal(v.questions.length,0);assert.equal(v.members.some(m=>m.userId===users.otherStudent.id),false);
    assert.equal(v.analytics.some(a=>a.studentId===users.otherStudent.id),false);
  });
  await check(3,'Submission is self-bound and auto grading remains hidden until teacher confirmation/publication',async()=>{
    const sent=await mutate(users.student,{action:'submission.submit',orgId:orgA,assignmentId:assignment.id,expectedRevision:0,answers:[{questionId:question.id,response:0}]});submission=sent.state.submissions[0];assert.ok(submission);
    for(const k of ['autoScore','score','grades','feedback','confirmedAt'])assert.ok(submission[k]===undefined||submission[k]===null,k);
    assert.equal((await get(users.otherStudent,orgA)).v.submissions.length,0);
    await mutate(users.student,{action:'submission.publish',orgId:orgA,id:submission.id,expectedRevision:submission.revision},403);
    const staff=(await get(users.teacher,orgA)).v;submission=staff.submissions[0];assert.equal(submission.autoScore,10);
    await mutate(users.teacher,{action:'submission.publish',orgId:orgA,id:submission.id,expectedRevision:submission.revision},409);
    const graded=await mutate(users.teacher,{action:'submission.grade',orgId:orgA,id:submission.id,expectedRevision:submission.revision,grades:[{questionId:question.id,points:10,feedback:'Đúng phép biến đổi.'}],feedback:'Giáo viên đã kiểm tra.',confirmed:true});submission=graded.state.submissions[0];assert.equal(submission.status,'graded');
    const hidden=(await get(users.student,orgA)).v.submissions[0];assert.equal(hidden.score,undefined);
    const published=await mutate(users.teacher,{action:'submission.publish',orgId:orgA,id:submission.id,expectedRevision:submission.revision});assert.equal(published.state.submissions[0].status,'published');
    const visible=(await get(users.student,orgA)).v;assert.equal(visible.submissions[0].score,10);assert.equal(visible.assignments[0].questions[0].correctIndex,0);
    assert.ok(visible.analytics.every(a=>a.topics.every(t=>t.level==='insufficient')),'One assessment is not mastery.');
  });
  await check(4,'Draft announcements stay private; published class notice/calendar are scoped and exports authorized',async()=>{
    const notice=await mutate(users.teacher,{action:'announcement.save',orgId:orgA,expectedRevision:0,classId:classA.id,title:'Thông báo kiểm thử',body:'Ôn phép biến đổi tương đương.'});const a=notice.state.announcements[0];
    assert.equal((await get(users.student,orgA)).v.announcements.length,0);
    await mutate(users.teacher,{action:'announcement.publish',orgId:orgA,id:a.id,expectedRevision:a.revision});assert.equal((await get(users.student,orgA)).v.announcements.length,1);
    await mutate(users.teacher,{action:'event.save',orgId:orgA,expectedRevision:0,classId:classA.id,title:'Buổi ôn tập',description:'Lịch thử nghiệm.',startAt:new Date(Date.now()+3600000).toISOString(),endAt:new Date(Date.now()+7200000).toISOString(),kind:'lesson'});
    assert.equal((await get(users.student,orgA)).v.events.length,1);
    const exp=await fetch(origin+'/api/teaching/export?orgId='+orgA,{headers:headers(users.teacher)});assert.equal(exp.status,200);assert.match(exp.headers.get('content-type'),/text\/csv/);
    const no=await fetch(origin+'/api/teaching/export?orgId='+orgA,{headers:headers(users.otherTeacher)});assert.equal(no.status,403);
  });
  await check(4,'Teacher/student pages render compiled authenticated HTML; backup and restored teaching rows remain intact',async()=>{
    for(const [u,route] of [[users.teacher,'/teacher'],[users.student,'/classroom']]){const r=await fetch(origin+route,{headers:headers(u)});const html=await r.text();assert.equal(r.status,200);assert.ok(!html.includes('id="__next_error__"'));assert.ok(!html.includes('Cannot read properties of undefined'));}
    const count=db.prepare('SELECT count(*) n FROM audit_events WHERE action LIKE ?').get('TEACHING%').n;report.teachingAuditEvents=Number(count);
    const backup=path.join(scratch,'backup.sqlite'),restored=path.join(scratch,'restored.sqlite');
    const {snapshot}=require('./database-snapshot.cjs');
    const first=snapshot(dbPath,backup),second=snapshot(backup,restored);
    assert.equal(first.integrity,'ok');assert.equal(second.integrity,'ok');
    const copy=new DatabaseSync(restored,{readOnly:true});
    assert.equal(copy.prepare('SELECT score FROM teaching_submissions WHERE id=?').get(submission.id).score,10);
    assert.equal(copy.prepare('SELECT count(*) n FROM teaching_classes WHERE id=?').get(classA.id).n,1);copy.close();
    report.backupRestore={status:'PASS',schemaVersion:first.schemaVersion,scope:'Separate restored SQLite file; not off-host hosting disaster recovery.'};
    assert.equal((await get(users.student,orgA)).v.submissions[0].score,10);
  });
  for(const phase of [1,2,3,4])report.phases[phase]={status:'PASS',checks:checks.filter(c=>c.phase===phase).length};
  report.status='PASS';report.passed=checks.length;report.version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;report.completedAt=new Date().toISOString();save();console.log(JSON.stringify({status:'PASS',checks:checks.length,phases:report.phases,providerCalls:0}));
}
main().catch(e=>{report.status='FAIL';report.error=String(e.message).slice(0,900);save();console.error(report.error);process.exitCode=1;}).finally(async()=>{if(db)try{db.close();}catch{}if(server&&server.exitCode===null){server.kill();await new Promise(r=>{server.once('exit',r);setTimeout(r,5000).unref();});}if(scratch&&path.dirname(scratch)===os.tmpdir()&&path.basename(scratch).startsWith('lumio-teaching-compiled-'))fs.rmSync(scratch,{recursive:true,force:true});});
