"use strict";
// Reproduce Turso's unquoted ACTION/KEY physical column labels on real SQLite.
// Do not lowercase arbitrary result labels in the generic adapter.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os"), {randomUUID} = require("node:crypto"), {DatabaseSync} = require("node:sqlite");
const load = require("./v9-database-loader.cjs")();
const {createStore} = load("lib/server/store.ts");
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v9-labels-")), file = path.join(folder, "synthetic.sqlite");
const checks = [], previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "development";
process.env.NEXTAUTH_SECRET = "synthetic-column-label-invitation-only-secret";
let store, insertedFlags = 0;
function database() {
  const db = new DatabaseSync(file);
  return {
    prepare(sql) { const statement = db.prepare(sql); if (/^INSERT OR IGNORE INTO feature_flags/.test(sql)) insertedFlags++; return statement; },
    exec(sql) { db.exec(sql.replace(/\baction(?=\s+TEXT)/gi,"ACTION").replace(/\bkey(?=\s+TEXT)/gi,"KEY")); },
    close() { db.close(); }
  };
}
const check = (name, fn) => { fn(); checks.push({name,status:"PASS"}); console.log("PASS " + name); };
const identity = (label) => ({provider:"google",providerAccountId:label,name:"Synthetic QA",email:label+"@example.test",emailVerified:true});
try {
  const db = database(); store = createStore(":injected:",{database:db,adminEmails:["owner@example.test"]});
  const owner = store.ensureIdentity(identity("owner")), student = store.ensureIdentity(identity("student"));
  check("Physical ACTION/KEY labels do not corrupt flags or audit projections", () => {
    assert.equal(db.prepare("SELECT * FROM feature_flags LIMIT 1").get().key,undefined);
    assert.equal(typeof db.prepare("SELECT * FROM feature_flags LIMIT 1").get().KEY,"string");
    assert.ok(store.listFlags().length > 0);
    assert.ok(store.listFlags().every(f => typeof f.key === "string" && f.key !== "undefined"));
    assert.ok(store.listAudit().length > 0);
    assert.ok(store.listAudit().every(e => /^[A-Z][A-Z0-9_]+$/.test(e.action)));
  });
  check("Student join replay keeps its canonical operation and permission checks", () => {
    const mutate = (u,b) => store.mutateTeaching(u.id,u.sessionVersion,{requestId:randomUUID(),...b});
    const orgId = mutate(owner,{action:"org.create",name:"Synthetic labels"}).result.id;
    const classId = mutate(owner,{action:"class.create",orgId,name:"Synthetic class",subject:"Toán",grade:"9",description:"QA"}).result.id;
    const invite = mutate(owner,{action:"invite.create",orgId,classId,expectedRevision:1,expiresInDays:1,maxUses:1});
    const input = {requestId:randomUUID(),action:"class.join",code:invite.result.inviteCode};
    mutate(student,input); assert.equal(mutate(student,input).replayed,true);
    assert.throws(() => mutate(owner,input),e => e.code === "TEACHING_REQUEST_REUSED");
  });
  check("Sandbox billing replay preserves the exact balance with uppercase ACTION", () => {
    const input = {actorId:owner.id,sessionVersion:owner.sessionVersion,userId:student.id,requestId:randomUUID(),planId:"plus",credits:13,days:1,reason:"Synthetic column-label test only"};
    store.adminGrant(input);
    const balance = store.getBillingSnapshot(student.id,student.sessionVersion).account.balance;
    store.adminGrant(input);
    assert.equal(store.getBillingSnapshot(student.id,student.sessionVersion).account.balance,balance);
    assert.throws(() => store.adminGrant({...input,credits:14}),e => e.code === "IDEMPOTENCY_CONFLICT");
  });
  check("Reopen recognizes existing uppercase KEY flags without reseeding", () => {
    store.close(); insertedFlags = 0; store = createStore(":injected:",{database:database()});
    assert.equal(insertedFlags,0);
    assert.ok(store.listFlags().every(f => f.key !== "undefined"));
  });
  fs.writeFileSync(path.join(__dirname,"../docs/v9/reports/database-column-labels.json"),JSON.stringify({status:"PASS",scope:"Local real SQLite with synthetic uppercase physical columns; not remote durability",passed:checks.length,checks},null,2)+"\n");
} finally {
  store?.close();
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
  fs.rmSync(folder,{recursive:true,force:true});
}
