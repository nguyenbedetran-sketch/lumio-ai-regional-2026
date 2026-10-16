// Independent adapter fault review. Real temporary LOCAL SQLite is behind an
// authored Worker protocol fixture; this is not a Turso/network durability test.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn, spawnSync } = require("node:child_process"),
  { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, ".."),
  load = require("./v9-database-loader.cjs")(root),
  { SqliteWorkerConnection } = load("lib/server/database-remote.ts"),
  { createStore } = load("lib/server/store.ts"),
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v9-db-review-")),
  workerFile = path.join(folder, "fixture-worker.cjs"),
  checks = [],
  connections = [],
  reports = path.join(root, "docs/v9/reports");
let networkCalls = 0;
let nativeLoopbackFailure = null;
const originalFetch = global.fetch;
global.fetch = async () => {
  networkCalls++;
  throw Error("UNEXPECTED_NETWORK_IN_LOCAL_FAULT_REVIEW");
};
const workerSource = String.raw`
"use strict";
const {workerData:w}=require("node:worker_threads"),{DatabaseSync}=require("node:sqlite");
const signal=new Int32Array(w.signal),control=new Int32Array(w.reviewControl),db=new DatabaseSync(w.url);
const sleep=(ms)=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
function send(m){w.port.postMessage(m);Atomics.store(signal,0,1);Atomics.notify(signal,0);}
Atomics.add(control,5,1);
if(!w.dropInitialization)send({id:0,ok:true});
w.port.on("message",m=>{
  Atomics.add(control,1,1);
  const sql=String(m.sql||""),op=m.op,mode=Atomics.load(control,0);
  if(/^COMMIT\b/i.test(sql))Atomics.add(control,2,1);
  if(/^ROLLBACK\b/i.test(sql))Atomics.add(control,3,1);
  if(mode===4){send({id:m.id,ok:false,error:{kind:"transport",message:"fixture-private-sql-value",url:"https://fixture.invalid/?token=synthetic-review-secret"}});return;}
  if(mode===5){send({id:m.id+1,ok:true,value:{unexpected:"not-the-current-operation"}});return;}
  if(mode===6){send({id:m.id,ok:false,error:{kind:"size"}});return;}
  try{
    let value;
    if(op==="close"){db.close();Atomics.add(control,4,1);}
    else if(op==="exec")db.exec(sql);
    else value=db.prepare(sql)[op](...(m.args||[]));
    if(mode===1&&op==="get")return;
    if(mode===2&&/^COMMIT\b/i.test(sql))return;
    if(mode===3&&/^ROLLBACK\b/i.test(sql))return;
    if(mode===7)sleep(70);
    send({id:m.id,ok:true,value});
  }catch(error){
    const code=Number(error.errcode);
    if((code&255)===19)send({id:m.id,ok:false,error:{kind:"sql",code:code===2067?"SQLITE_CONSTRAINT_UNIQUE":"SQLITE_CONSTRAINT"}});
    else send({id:m.id,ok:false,error:{kind:"transport"}});
  }
});
`;
fs.writeFileSync(workerFile, workerSource);
const code = (expected) => (error) => error?.code === expected;
const check = (name, fn) => {
  fn();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
};
function fixture(name, options = {}) {
  const reviewControl = new SharedArrayBuffer(8 * Int32Array.BYTES_PER_ELEMENT),
    control = new Int32Array(reviewControl),
    file = path.join(folder, name + ".sqlite"),
    db = new SqliteWorkerConnection({
      url: file,
      workerFile,
      workerExtra: { reviewControl, ...options.workerExtra },
      budgets: {
        rpcMs: 350,
        transactionMs: 2000,
        bootstrapMs: 10000,
        ...options.budgets,
      },
    });
  connections.push(db);
  return { db, file, control };
}
function inspect(file, fn) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
async function nativeBlackhole() {
  const marker = path.join(folder, "native-loopback-accepted.txt"),
    serverProgram = `const net=require('node:net'),fs=require('node:fs');const server=net.createServer(socket=>{fs.appendFileSync(process.argv[1],'x');socket.on('error',()=>{});});server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:server.address().port})));`,
    server = spawn(process.execPath, ["-e", serverProgram, marker], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  try {
    const port = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(
        () => reject(Error("LOOPBACK_SERVER_START_TIMEOUT")),
        5000,
      );
      server.on("error", reject);
      server.once("exit", () => reject(Error("LOOPBACK_SERVER_EXITED_EARLY")));
      server.stdout.on("data", (chunk) => {
        output += chunk;
        if (output.includes("\n")) {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(output.split("\n")[0]).port);
          } catch (error) {
            reject(error);
          }
        }
      });
    });
    const loader = path.join(__dirname, "v9-database-loader.cjs"),
      program = `const assert=require('node:assert/strict'),load=require(${JSON.stringify(loader)})(${JSON.stringify(root)}),{SqliteWorkerConnection}=load('lib/server/database-remote.ts');let db,caught;const start=performance.now();try{db=new SqliteWorkerConnection({url:process.argv[1],authToken:'synthetic-local-probe-not-a-credential',budgets:{rpcMs:900,transactionMs:1800,bootstrapMs:1800}});db.prepare('SELECT 1 AS synthetic_probe').get();}catch(e){caught=e;}finally{try{db?.close();}catch{}}assert.equal(caught?.code,'DATABASE_TIMEOUT');assert.equal(db?.poisoned,true);assert.ok(performance.now()-start<3500);console.log(JSON.stringify({code:caught.code,poisoned:db.poisoned,elapsedMs:Math.round(performance.now()-start),naturalExitRequired:true}));`,
      result = spawnSync(
        process.execPath,
        ["-e", program, `http://127.0.0.1:${port}`],
        {
          cwd: root,
          encoding: "utf8",
          timeout: 7000,
          windowsHide: true,
        },
      );
    let probe = null;
    try {
      const parsed = JSON.parse(result.stdout.trim());
      probe = {
        code: parsed.code,
        poisoned: parsed.poisoned,
        elapsedMs: parsed.elapsedMs,
        naturalExitRequired: parsed.naturalExitRequired,
      };
    } catch {}
    nativeLoopbackFailure = {
      errorCode: result.error?.code || null,
      processStatus: result.status,
      signal: result.signal,
      probe,
      acceptedLoopbackConnections: fs.existsSync(marker)
        ? fs.statSync(marker).size
        : 0,
      stderrCharacters: result.stderr?.length || 0,
    };
    assert.equal(result.error, undefined, result.error?.code || result.stderr);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const outcome = JSON.parse(result.stdout.trim());
    assert.equal(outcome.naturalExitRequired, true);
    assert.equal(outcome.code, "DATABASE_TIMEOUT");
    assert.ok(
      fs.existsSync(marker) && fs.statSync(marker).size >= 1,
      "actual native TCP connection reached the deliberately unresponsive local process",
    );
    nativeLoopbackFailure = null;
    return {
      ...outcome,
      processExitStatus: result.status,
      externallyKilled: false,
      acceptedLoopbackConnections: fs.statSync(marker).size,
    };
  } finally {
    server.kill();
    await new Promise((resolve) =>
      server.exitCode !== null ? resolve() : server.once("exit", resolve),
    );
  }
}
async function main() {
  try {
    check(
      "A foreign table beginning sqlitex is rejected before bootstrap writes",
      () => {
        const db = new DatabaseSync(":memory:"),
          { assertDatabaseIntegrity } = load(
            "lib/server/database-integrity.ts",
          );
        try {
          db.exec("CREATE TABLE sqlitex_foreign_application(value TEXT)");
          assert.throws(
            () => assertDatabaseIntegrity(db, { allowPrefix: true }),
            /SCHEMA_NOT_SUPPORTED/,
          );
          assert.equal(
            db
              .prepare(
                "SELECT 1 FROM sqlite_schema WHERE name='schema_migrations'",
              )
              .get(),
            undefined,
          );
          assert.equal(
            db
              .prepare(
                "SELECT count(*) AS n FROM sqlite_schema WHERE type='table'",
              )
              .get().n,
            1,
          );
        } finally {
          db.close();
        }
      },
    );
    check(
      "Read timeout is bounded, poisons the port and cannot issue subsequent SQL",
      () => {
        const { db, control } = fixture("read-timeout", {
          budgets: { rpcMs: 120 },
        });
        Atomics.store(control, 0, 1);
        const started = performance.now();
        assert.throws(
          () => db.prepare("SELECT 1 AS n").get(),
          code("DATABASE_TIMEOUT"),
        );
        const elapsed = performance.now() - started;
        assert.ok(
          elapsed >= 80 && elapsed < 1500,
          "hard read timeout must bound main wait",
        );
        assert.equal(db.poisoned, true);
        const dispatched = Atomics.load(control, 1);
        assert.throws(
          () => db.exec("CREATE TABLE never_dispatched(n)"),
          code("DATABASE_CONNECTION_POISONED"),
        );
        assert.equal(Atomics.load(control, 1), dispatched);
      },
    );
    check(
      "Aggregate transaction budget expires across individually successful reads without automatic retry",
      () => {
        const { db, control } = fixture("aggregate", {
          budgets: { rpcMs: 500, transactionMs: 180 },
        });
        db.beginTransaction();
        db.exec("BEGIN IMMEDIATE");
        Atomics.store(control, 0, 7);
        const started = performance.now();
        let successes = 0;
        assert.throws(() => {
          for (let i = 0; i < 10; i++) {
            db.prepare("SELECT 1 AS n").get();
            successes++;
          }
        }, code("DATABASE_WRITE_OUTCOME_UNKNOWN"));
        assert.ok(successes >= 1 && successes <= 2);
        assert.ok(performance.now() - started < 1200);
        assert.equal(
          Atomics.load(control, 1),
          successes + 2,
          "one BEGIN and one failed read only",
        );
        assert.equal(db.poisoned, true);
        db.endTransaction();
      },
    );
    check(
      "Aggregate bootstrap budget is independent of the longer per-RPC budget",
      () => {
        const { db, control } = fixture("bootstrap", {
          budgets: { rpcMs: 500, bootstrapMs: 100 },
        });
        db.beginBootstrap();
        Atomics.store(control, 0, 7);
        assert.equal(db.prepare("SELECT 1 AS n").get().n, 1);
        assert.throws(
          () => db.prepare("SELECT 2 AS n").get(),
          code("DATABASE_TIMEOUT"),
        );
        db.endBootstrap();
        assert.equal(db.poisoned, true);
      },
    );
    check(
      "Wrong response ordinal fails closed and cannot become a successful mutation result",
      () => {
        const { db, control } = fixture("wrong-id");
        Atomics.store(control, 0, 5);
        assert.throws(
          () => db.prepare("INSERT INTO unknown VALUES(?)").run("private"),
          code("DATABASE_WRITE_OUTCOME_UNKNOWN"),
        );
        assert.equal(db.poisoned, true);
      },
    );
    check(
      "Transport error details do not expose SQL values, endpoints or tokens",
      () => {
        const { db, control } = fixture("transport-redaction");
        Atomics.store(control, 0, 4);
        let caught;
        try {
          db.prepare("SELECT ?").get("fixture-private-sql-value");
        } catch (error) {
          caught = error;
        }
        assert.equal(caught.code, "DATABASE_UNAVAILABLE");
        assert.doesNotMatch(
          String(caught.stack),
          /fixture-private|synthetic-review-secret|fixture\.invalid/,
        );
        assert.equal(db.poisoned, true);
      },
    );
    check(
      "Oversize response is unavailable rather than a partial row or successful result",
      () => {
        const { db, control } = fixture("oversize");
        Atomics.store(control, 0, 6);
        assert.throws(
          () => db.prepare("SELECT 1").all(),
          code("DATABASE_RESPONSE_TOO_LARGE"),
        );
        assert.equal(db.poisoned, true);
      },
    );
    check(
      "Definite SQL constraint error permits explicit rollback and healthy later transactions",
      () => {
        const { db } = fixture("constraint");
        db.exec("CREATE TABLE t(id TEXT UNIQUE)");
        db.prepare("INSERT INTO t VALUES(?)").run("first");
        db.beginTransaction();
        db.exec("BEGIN IMMEDIATE");
        assert.throws(
          () => db.prepare("INSERT INTO t VALUES(?)").run("first"),
          code("SQLITE_CONSTRAINT_UNIQUE"),
        );
        assert.equal(db.poisoned, false);
        db.exec("ROLLBACK");
        db.endTransaction();
        db.beginTransaction();
        db.exec("BEGIN IMMEDIATE");
        db.prepare("INSERT INTO t VALUES(?)").run("second");
        db.exec("COMMIT");
        db.endTransaction();
        assert.equal(db.prepare("SELECT count(*) AS n FROM t").get().n, 2);
      },
    );
    check(
      "Actual COMMIT followed by lost ACK reports unknown and never sends rollback or replays SQL",
      () => {
        const { db, file, control } = fixture("commit-lost-ack", {
          budgets: { rpcMs: 120 },
        });
        db.exec("CREATE TABLE intents(id TEXT PRIMARY KEY,value TEXT)");
        db.beginTransaction();
        db.exec("BEGIN IMMEDIATE");
        db.prepare("INSERT INTO intents VALUES(?,?)").run(
          "stable-id",
          "synthetic",
        );
        Atomics.store(control, 0, 2);
        assert.throws(
          () => db.exec("COMMIT"),
          code("DATABASE_WRITE_OUTCOME_UNKNOWN"),
        );
        assert.equal(Atomics.load(control, 2), 1);
        assert.equal(Atomics.load(control, 3), 0);
        assert.equal(
          inspect(
            file,
            (actual) =>
              actual.prepare("SELECT count(*) AS n FROM intents").get().n,
          ),
          1,
        );
        const before = Atomics.load(control, 1);
        assert.throws(
          () => db.exec("COMMIT"),
          code("DATABASE_CONNECTION_POISONED"),
        );
        assert.equal(Atomics.load(control, 1), before);
        db.endTransaction();
      },
    );
    let settlement;
    check(
      "Real store settlement and receipt commit atomically even when only the COMMIT ACK is lost",
      () => {
        const f = fixture("store-lost-ack"),
          store = createStore(":injected:", {
            database: f.db,
            adminEmails: [],
          });
        const user = store.ensureIdentity({
          provider: "google",
          providerAccountId: "synthetic-review-user",
          name: "Synthetic review",
          email: "review@example.test",
          emailVerified: true,
        });
        const before = store.getBillingSnapshot(
          user.id,
          user.sessionVersion,
        ).account;
        const key = crypto.randomUUID(),
          fingerprint = "a".repeat(64),
          lease = store.beginAIHttpRequest(
            user.id,
            user.sessionVersion,
            "ai",
            key,
            fingerprint,
          );
        const reservation = store.reserveUsage({
          userId: user.id,
          sessionVersion: user.sessionVersion,
          requestId: lease.requestId,
          task: "chat",
          kind: "text",
          mode: "quick",
        });
        const commits = Atomics.load(f.control, 2),
          rollbacks = Atomics.load(f.control, 3);
        Atomics.store(f.control, 0, 2);
        assert.throws(
          () =>
            store.settleUsage({
              userId: user.id,
              reservationId: reservation.reservationId,
              onSettled: () => store.completeAIHttpRequest(lease),
            }),
          code("DATABASE_WRITE_OUTCOME_UNKNOWN"),
        );
        assert.equal(Atomics.load(f.control, 2), commits + 1);
        assert.equal(Atomics.load(f.control, 3), rollbacks);
        inspect(f.file, (actual) => {
          assert.equal(
            actual
              .prepare(
                "SELECT status FROM ai_http_requests WHERE user_id=? AND request_key=?",
              )
              .get(user.id, key).status,
            "completed",
          );
          assert.equal(
            actual
              .prepare("SELECT status FROM billing_reservations WHERE id=?")
              .get(reservation.reservationId).status,
            "settled",
          );
          const wallet = actual
            .prepare(
              "SELECT balance,reserved FROM billing_accounts WHERE user_id=?",
            )
            .get(user.id);
          assert.equal(wallet.balance, before.balance - reservation.units);
          assert.equal(wallet.reserved, 0);
        });
        settlement = {
          file: f.file,
          user,
          key,
          fingerprint,
          reservation,
          expectedBalance: before.balance - reservation.units,
        };
      },
    );
    check(
      "Fresh-process recovery reads canonical completed receipt and cannot double-debit the same intent",
      () => {
        const loader = path.join(__dirname, "v9-database-loader.cjs");
        const program = `const assert=require('node:assert/strict'),load=require(${JSON.stringify(loader)})(${JSON.stringify(root)}),s=load('lib/server/store.ts').createStore(process.argv[1],{adminEmails:[]}),x=JSON.parse(process.argv[2]);try{const receipt=s.readAIHttpRequest(x.user.id,x.user.sessionVersion,x.key);assert.equal(receipt.status,'completed');assert.throws(()=>s.beginAIHttpRequest(x.user.id,x.user.sessionVersion,'ai',x.key,x.fingerprint),e=>e.code==='AI_REQUEST_COMPLETED');assert.equal(s.settleUsage({userId:x.user.id,reservationId:x.reservation.reservationId}).changed,false);const view=s.getBillingSnapshot(x.user.id,x.user.sessionVersion);assert.equal(view.account.balance,x.expectedBalance);assert.equal(view.account.reserved,0);assert.equal(view.history.filter(e=>e.kind==='usage').length,1);assert.equal(view.history.filter(e=>e.kind==='reserve').length,1);assert.equal(view.history.filter(e=>e.kind==='trial').length,1);console.log(JSON.stringify({receipt:receipt.status,balance:view.account.balance,reserved:view.account.reserved,once:true}));}finally{s.close();}`;
        const child = spawnSync(
          process.execPath,
          ["-e", program, settlement.file, JSON.stringify(settlement)],
          { cwd: root, encoding: "utf8", timeout: 15000 },
        );
        assert.equal(child.status, 0, child.stderr);
        const result = JSON.parse(child.stdout.trim());
        assert.equal(result.receipt, "completed");
        assert.equal(result.once, true);
      },
    );
    check(
      "Callback failure survives lost rollback ACK while the uncertain connection stays quarantined",
      () => {
        const f = fixture("rollback-lost-ack"),
          store = createStore(":injected:", {
            database: f.db,
            adminEmails: [],
          });
        const user = store.ensureIdentity({
          provider: "google",
          providerAccountId: "synthetic-rollback-user",
          name: "Synthetic rollback",
          emailVerified: false,
        });
        const reservation = store.reserveUsage({
          userId: user.id,
          sessionVersion: user.sessionVersion,
          requestId: crypto.randomUUID(),
          task: "chat",
          kind: "text",
          mode: "quick",
        });
        const original = new Error("SYNTHETIC_CALLBACK_REJECTED"),
          commits = Atomics.load(f.control, 2);
        Atomics.store(f.control, 0, 3);
        assert.throws(
          () =>
            store.settleUsage({
              userId: user.id,
              reservationId: reservation.reservationId,
              onSettled: () => {
                throw original;
              },
            }),
          (error) => error === original,
        );
        assert.equal(f.db.poisoned, true);
        assert.equal(Atomics.load(f.control, 2), commits);
        inspect(f.file, (actual) => {
          assert.equal(
            actual
              .prepare("SELECT status FROM billing_reservations WHERE id=?")
              .get(reservation.reservationId).status,
            "reserved",
          );
          assert.equal(
            actual
              .prepare(
                "SELECT count(*) AS n FROM billing_ledger WHERE reservation_id=? AND kind='usage'",
              )
              .get(reservation.reservationId).n,
            0,
          );
        });
      },
    );
    check(
      "Factory latches failed worker initialization and cannot spawn again on the next call",
      () => {
        const controlBuffer = new SharedArrayBuffer(
            8 * Int32Array.BYTES_PER_ELEMENT,
          ),
          control = new Int32Array(controlBuffer),
          { openConfiguredRemoteDatabase } = load(
            "lib/server/database-factory.ts",
          ),
          config = {
            mode: "remote-libsql",
            url: path.join(folder, "factory.sqlite"),
            budgets: { rpcMs: 120, transactionMs: 500, bootstrapMs: 1000 },
            workerFile,
            workerExtra: {
              reviewControl: controlBuffer,
              dropInitialization: true,
            },
          };
        assert.throws(
          () => openConfiguredRemoteDatabase(config),
          code("DATABASE_TIMEOUT"),
        );
        assert.equal(Atomics.load(control, 5), 1);
        const started = performance.now();
        assert.throws(
          () => openConfiguredRemoteDatabase(config),
          code("DATABASE_CONNECTION_POISONED"),
        );
        assert.ok(performance.now() - started < 100);
        assert.equal(Atomics.load(control, 5), 1);
      },
    );
    const nativeLoopback = await nativeBlackhole();
    checks.push({
      name: "Actual native libsql HTTP blackhole times out and probe process exits naturally while server remains unresponsive",
      status: "PASS",
    });
    console.log("PASS " + checks.at(-1).name);
    assert.equal(networkCalls, 0);
    const report = {
      status: "PASS",
      checkedAt: new Date().toISOString(),
      passed: checks.length,
      checks,
      javascriptFetchCalls: networkCalls,
      externalNetworkCalls: 0,
      nativeLoopback,
      paidProviderCalls: 0,
      scope:
        "Independent authored Worker fault protocol backed by real temporary LOCAL node:sqlite; actual store/ledger/receipt paths and separate-process recovery. One actual native libsql connection to an unresponsive LOOPBACK server checks timeout and natural process exit. NOT a remote Turso or live-provider test.",
      limitations: [
        "Native libsql parity is a separate suite",
        "Native child is deliberately killed on deadline; this does not prove a remote transaction rolled back",
        "No remote latency, quota, two-client or public redeploy evidence",
      ],
    };
    fs.mkdirSync(reports, { recursive: true });
    fs.writeFileSync(
      path.join(reports, "database-review.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        status: report.status,
        passed: report.passed,
        javascriptFetchCalls: networkCalls,
        externalNetworkCalls: 0,
      }),
    );
  } finally {
    global.fetch = originalFetch;
    for (const db of connections)
      try {
        db.close();
      } catch {}
    delete globalThis.__lumioRemoteDatabaseFault;
    await new Promise((resolve) => setTimeout(resolve, 150));
    // Delete only the explicit files from this freshly created synthetic directory.
    assert.equal(path.dirname(folder), path.resolve(os.tmpdir()));
    assert.ok(path.basename(folder).startsWith("lumio-v9-db-review-"));
    for (const name of fs.readdirSync(folder)) {
      const target = path.resolve(folder, name);
      assert.equal(path.dirname(target), folder);
      assert.ok(fs.statSync(target).isFile());
      fs.unlinkSync(target);
    }
    fs.rmdirSync(folder);
  }
}
main().catch((error) => {
  fs.mkdirSync(reports, { recursive: true });
  fs.writeFileSync(
    path.join(reports, "database-review.json"),
    JSON.stringify(
      {
        status: "FAIL",
        checkedAt: new Date().toISOString(),
        passed: checks.length,
        checks,
        failure: {
          code: error.code || null,
          message: error.message.split("\n")[0],
        },
        nativeLoopbackFailure,
        javascriptFetchCalls: networkCalls,
        externalNetworkCalls: 0,
        paidProviderCalls: 0,
        scope:
          "Independent authored Worker fault fixture and real temporary LOCAL SQLite; separate actual native libsql LOOPBACK blackhole probe. No Turso, credentials or live provider.",
      },
      null,
      2,
    ) + "\n",
  );
  console.error(error);
  process.exitCode = 1;
});
