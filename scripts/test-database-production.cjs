// Real compiled Next -> worker broker -> native child. Only the transport URL is
// redirected to isolated SQLite by a test-process preload; no application bypass.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"),
  net = require("node:net"), assert = require("node:assert/strict"),
  { spawn } = require("node:child_process"), { DatabaseSync } = require("node:sqlite"),
  { createHash } = require("node:crypto");
const root = path.resolve(__dirname, ".."), manual = process.argv.includes("--remote-qa"),
  output = path.join(root, "docs/next/reports/database-production", manual ? "remote-qa.json" : "native-compiled.json"),
  checks = [], report = { status: "RUNNING", checkedAt: new Date().toISOString(), checks,
    scope: manual ? "Compiled Next HTTP health against approved isolated Turso QA; no production database or providers"
      : "Compiled Next HTTP and actual native child/SQLite; test-only worker transport URL redirection, not remote TLS verification" };
let server, scratch, nativePid = 0;
function save() { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); }
function check(name, fn) { return Promise.resolve().then(fn).then(() => { checks.push({ name, status: "PASS" }); console.log("PASS " + name); save(); }); }
async function freePort() { const socket = net.createServer(); await new Promise((resolve, reject) => socket.once("error", reject).listen(0, "127.0.0.1", resolve)); const port = socket.address().port; await new Promise(resolve => socket.close(resolve)); return port; }
async function main() {
  assert.ok(fs.existsSync(path.join(root, ".next/BUILD_ID")), "BUILD_REQUIRED");
  assert.ok(![".env", ".env.local", ".env.production", ".env.production.local"].some(file => fs.existsSync(path.join(root, file))), "CLEAN_CHECKOUT_REQUIRED");
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-compiled-database-"));
  const dbPath = path.join(scratch, "native.sqlite"), observation = path.join(scratch, "worker.json"),
    preload = path.join(scratch, "transport.cjs"), origin = "http://127.0.0.1:" + await freePort(),
    sentinel = "https://compiled-native-fixture.turso.io/", env = {};
  for (const key of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "ComSpec", "PATHEXT"])
    if (process.env[key]) env[key] = process.env[key];
  Object.assign(env, { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NEXTAUTH_URL: origin,
    NEXTAUTH_SECRET: "synthetic-compiled-database-no-provider-credential", AUTH_TRUST_HOST: "true",
    LUMIO_COMPETITION_PREVIEW: "false", LUMIO_PUBLIC_DEMO: "false", LUMIO_AI_ENABLED: "false",
    LUMIO_BACKGROUND_JOBS_DISABLED: "true", LUMIO_DATABASE_MODE: "remote-libsql" });
  if (manual) {
    assert.equal(process.env.LUMIO_DATABASE_QA_CONFIRM, "isolated-synthetic", "QA_CONFIRMATION_REQUIRED");
    const url = new URL(process.env.TURSO_DATABASE_URL || "");
    assert.equal(url.hostname, "lumio-v9-qa-20261017-lumio-ai26a0048.aws-ap-northeast-1.turso.io", "APPROVED_QA_ONLY");
    assert.ok(process.env.TURSO_AUTH_TOKEN, "QA_TOKEN_REQUIRED");
    env.TURSO_DATABASE_URL = url.toString(); env.TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
  } else {
    env.TURSO_DATABASE_URL = sentinel; env.TURSO_AUTH_TOKEN = "synthetic-native-transport-only";
    fs.writeFileSync(preload, `
const Module=require('node:module'),fs=require('node:fs'),path=require('node:path');
const load=Module._load;
Module._load=function(name,parent,isMain){
 const value=load.apply(this,arguments);
 if(name!=='node:worker_threads')return value;
 return {...value,Worker:class ObservedWorker extends value.Worker{
  constructor(filename,options){
   const data=options?.workerData;
   if(typeof filename==='string'&&filename.endsWith('database-worker.cjs')&&data?.url===${JSON.stringify(sentinel)}){
    fs.writeFileSync(${JSON.stringify(observation)},JSON.stringify({driverType:typeof data.driverPath,absolute:typeof data.driverPath==='string'&&path.isAbsolute(data.driverPath),exists:typeof data.driverPath==='string'&&fs.existsSync(data.driverPath)}));
    super(filename,{...options,workerData:{...data,url:${JSON.stringify(dbPath)},authToken:''}});
    const signal=new Int32Array(data.signal);
    const tick=setInterval(()=>{const pid=Atomics.load(signal,1);if(pid>0){const row=JSON.parse(fs.readFileSync(${JSON.stringify(observation)},'utf8'));row.nativePid=pid;fs.writeFileSync(${JSON.stringify(observation)},JSON.stringify(row));clearInterval(tick);}},20);tick.unref();
   }else super(filename,options);
  }
 }};
};
`, { mode: 0o600 });
    env.NODE_OPTIONS = "--require=" + preload;
  }
  server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", new URL(origin).port], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  // Do not copy arbitrary Next/native output or configuration into evidence.
  server.stdout.on("data", () => {}); server.stderr.on("data", () => {});
  let ready = false;
  for (let attempt = 0; attempt < (manual ? 80 : 30); attempt++) {
    if (server.exitCode !== null) throw Error("COMPILED_SERVER_EXITED");
    try { const response = await fetch(origin + "/api/health", { signal: AbortSignal.timeout(manual ? 65000 : 10000) });
      if (response.status === 200 && (await response.json()).status === "ready") { ready = true; break; }
      if (response.status === 503) break; // Bootstrap is quarantined; never retry it away.
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  await check("Actual compiled health reaches ready through the configured database", () => assert.equal(ready, true, "COMPILED_DATABASE_NOT_READY"));
  if (!manual) {
    await check("Native child receives a real absolute driver path rather than webpack module ID", () => {
      const row = JSON.parse(fs.readFileSync(observation, "utf8")); nativePid = row.nativePid || 0;
      assert.deepEqual({ driverType: row.driverType, absolute: row.absolute, exists: row.exists }, { driverType: "string", absolute: true, exists: true });
    });
    await check("Real native child initializes current schema and immutable file guards", () => {
      const db = new DatabaseSync(dbPath, { readOnly: true });
      try { assert.equal(db.prepare("SELECT max(version) version FROM schema_migrations").get().version, 20);
        assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n, 54);
        assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE type='trigger' AND name IN ('teaching_files_bound_no_update','teaching_file_chunks_no_update')").get().n, 2);
      } finally { db.close(); }
    });
  }
  await check("Repeated actual HTTP readiness retains healthy canonical database access", async () => {
    const response = await fetch(origin + "/api/health", { signal: AbortSignal.timeout(10000) }); assert.equal(response.status, 200); assert.equal((await response.json()).status, "ready");
  });
  report.status = "PASS"; report.passed = checks.length;
  report.sourceSha256 = Object.fromEntries(["lib/server/database-remote.ts", "scripts/database-worker.cjs", "scripts/database-child.cjs"].map(file => [file, createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")]));
  report.compiledBuildIdSha256 = createHash("sha256").update(fs.readFileSync(path.join(root, ".next/BUILD_ID"))).digest("hex");
}
main().catch(error => { report.status = "FAIL"; report.error = /^(?:COMPILED_|BUILD_|CLEAN_|QA_|APPROVED_)/.test(error.message) ? error.message : "COMPILED_DATABASE_ASSERTION_FAILED"; process.exitCode = 1; }).finally(async () => {
  if (scratch && !manual) {
    const file = path.join(scratch, "worker.json");
    if (fs.existsSync(file)) {
      try { const row = JSON.parse(fs.readFileSync(file, "utf8"));
        report.observedDriver = { type: row.driverType, absolute: row.absolute, exists: row.exists };
        nativePid = row.nativePid || 0;
      } catch {}
    }
  }
  if (fs.existsSync(path.join(root, ".next/BUILD_ID")))
    report.compiledBuildIdSha256 = createHash("sha256").update(fs.readFileSync(path.join(root, ".next/BUILD_ID"))).digest("hex");
  save();
  if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise(resolve => server.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 3000))]); }
  if (scratch) {
    const file = path.join(scratch, "worker.json");
    if (!nativePid && fs.existsSync(file)) { try { nativePid = JSON.parse(fs.readFileSync(file, "utf8")).nativePid || 0; } catch {} }
    if (nativePid > 0) { try { process.kill(nativePid, "SIGKILL"); } catch {} }
    if (path.resolve(scratch).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(scratch).startsWith("lumio-compiled-database-"))
      fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
  console.log(JSON.stringify({ status: report.status, passed: report.passed || 0, mode: manual ? "approved-remote-qa" : "compiled-native" }));
});
