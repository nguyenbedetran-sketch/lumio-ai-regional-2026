const assert = require('node:assert/strict'), fs = require('node:fs'), path=require('node:path'), ts=require('typescript'), {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file) {
 const full=path.resolve(root,file);if(cache.has(full))return cache.get(full).exports;
 const m={exports:{}};cache.set(full,m);
 const code=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(name=>name.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(full),name+'.ts'))):require(name),m,m.exports);return m.exports;
}
let count=0;function check(name,fn){fn();count++;console.log('PASS '+name);}
const {isCompetitionPreview,createCompetitionQuota,acquireCompetitionQuota}=load('lib/server/competition-preview.ts');
const original={...process.env};
try {
 check('Competition preview requires explicit flag and cannot override public-demo or desktop mode',()=>{
  delete process.env.LUMIO_COMPETITION_PREVIEW;assert.equal(isCompetitionPreview(),false);
  process.env.LUMIO_COMPETITION_PREVIEW='true';delete process.env.LUMIO_PUBLIC_DEMO;delete process.env.LUMIO_DESKTOP;assert.equal(isCompetitionPreview(),true);
  process.env.LUMIO_PUBLIC_DEMO='true';assert.equal(isCompetitionPreview(),false);delete process.env.LUMIO_PUBLIC_DEMO;
  process.env.LUMIO_DESKTOP='true';assert.equal(isCompetitionPreview(),false);delete process.env.LUMIO_DESKTOP;
 });
 check('Global quota bounds concurrent provider calls across accounts and release is idempotent',()=>{
  const q=createCompetitionQuota(()=>Date.UTC(2026,9,15)),a=q.acquire(),b=q.acquire(),c=q.acquire();
  assert.throws(()=>q.acquire(),e=>e.code==='COMPETITION_RATE_LIMIT');a();a();assert.equal(q.snapshot().active,2);
  const d=q.acquire();assert.throws(()=>q.acquire(),e=>e.status===429);b();c();d();assert.equal(q.snapshot().active,0);
 });
 check('A failed or completed request cannot refund the global attempt budget',()=>{
  const q=createCompetitionQuota(()=>Date.UTC(2026,9,15));for(let i=0;i<200;i++)q.acquire()();
  assert.equal(q.snapshot().attempts,200);assert.throws(()=>q.acquire(),e=>e.code==='COMPETITION_RATE_LIMIT');
 });
 check('A new UTC day resets attempts without losing active leases',()=>{
  let now=Date.UTC(2026,9,15,23,59);const q=createCompetitionQuota(()=>now),a=q.acquire(),b=q.acquire(),c=q.acquire();
  now+=120000;assert.throws(()=>q.acquire(),e=>e.status===429);assert.equal(q.snapshot().attempts,0);
  a();q.acquire()();b();c();assert.equal(q.snapshot().attempts,1);assert.equal(q.snapshot().active,0);
 });
 check('Ordinary local/production mode does not silently acquire the competition quota',()=>{
  delete process.env.LUMIO_COMPETITION_PREVIEW;const release=acquireCompetitionQuota();release();release();
 });
 check('Regional startup fails closed before launching a server for missing secrets or unsafe origins',()=>{
  const safe={SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,NODE_ENV:'production',LUMIO_COMPETITION_PREVIEW:'true',LUMIO_AI_ENABLED:'true',NEXTAUTH_SECRET:'test-only-auth-secret-never-a-real-credential',NEXTAUTH_URL:'https://example.invalid/',GOOGLE_CLIENT_ID:'test-only',GOOGLE_CLIENT_SECRET:'test-only',OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-only',GEMINI_API_KEY:'test-only',GEMINI_MODEL:'test-only'};
  for(const patch of [{LUMIO_COMPETITION_PREVIEW:'false'},{LUMIO_PUBLIC_DEMO:'true'},{LUMIO_DESKTOP:'true'},{LUMIO_AI_ENABLED:'false'},{NEXTAUTH_SECRET:''},{NEXTAUTH_URL:'http://example.invalid/'},{NEXTAUTH_URL:'https://example.invalid/untrusted?key=hidden'},{NEXTAUTH_URL:'https://username:password@example.invalid/'},{GOOGLE_CLIENT_SECRET:''},{OPENAI_API_KEY:''},{PORT:'1'}]){
   const run=spawnSync(process.execPath,['scripts/start-regional.cjs'],{cwd:root,env:{...safe,...patch},encoding:'utf8',timeout:10000});
   assert.equal(run.status,1);assert.match(run.stderr,/Regional preview refused:/);assert.ok(!run.stderr.includes(safe.NEXTAUTH_SECRET));assert.ok(!run.stderr.includes('username:password'));
  }
 });
} finally {
 for(const key of ['LUMIO_COMPETITION_PREVIEW','LUMIO_PUBLIC_DEMO','LUMIO_DESKTOP']) {if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}
}
console.log(`Regional preview: ${count} checks passed; no network, server launch or credentials used.`);
