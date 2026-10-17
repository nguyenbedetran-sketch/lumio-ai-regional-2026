"use strict";
// Explicit synthetic QA only. Never read production DB files or call AI/OAuth.
const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), { fork } = require("node:child_process"), { randomUUID, createHash } = require("node:crypto");
const root = path.resolve(__dirname, ".."), load = require("../tests/v9-database-loader.cjs")(root);
const { databaseConfiguration } = load("lib/server/database-connection.ts");
const { SqliteWorkerConnection } = load("lib/server/database-remote.ts");
const { createStore } = load("lib/server/store.ts");
const QA_HOST = "lumio-v9-qa-20261017-lumio-ai26a0048.aws-ap-northeast-1.turso.io";
// Synthetic invitation signing only; never use or request an OAuth secret.
process.env.NEXTAUTH_SECRET = "synthetic-v9-qa-invitation-only-no-real-login-secret";
process.env.LUMIO_COMPETITION_PREVIEW = "false";
const safeCode = (error) => /^[A-Z][A-Z0-9_]{1,80}$/.test(error?.code || "") ? error.code : "QA_ASSERTION_FAILED";
function validateConfig(config) {
  if (config.localProof) {
    const folder = path.dirname(path.resolve(config.url));
    assert.equal(path.dirname(folder), path.resolve(os.tmpdir()));
    assert.ok(path.basename(folder).startsWith("lumio-v9-qa-selftest-"));
  } else {
    assert.equal(config.mode, "remote-libsql"); assert.equal(new URL(config.url).hostname, QA_HOST);
    databaseConfiguration({ LUMIO_DATABASE_MODE: config.mode, TURSO_DATABASE_URL: config.url, TURSO_AUTH_TOKEN: config.authToken });
  }
}
function connect(config) {
  validateConfig(config);
  const db = new SqliteWorkerConnection(config);
  if (config.localProof) db.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;");
  return db;
}
function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function persistentState(store, input) {
  const teacher = store.readTeaching(input.owner.id, input.owner.sessionVersion, { orgId: input.orgId });
  const student = store.readTeaching(input.student.id, input.student.sessionVersion, { orgId: input.orgId });
  const pick = (rows, id) => rows.find((row) => row.id === id);
  return { owner: store.getUser(input.owner.id), student: store.getUser(input.student.id), classroom: pick(teacher.classes, input.classId), assignment: pick(teacher.assignments, input.assignmentId), submission: pick(student.submissions, input.submissionId), sync: store.syncRead(input.student.id, input.student.sessionVersion), wallet: store.getBillingSnapshot(input.student.id, input.student.sessionVersion).account };
}
async function helper() {
  assert.ok(process.connected, "QA_IPC_REQUIRED");
  let db, store, action;
  process.on("message", async (message) => {
    try {
      if (message.op === "init") {
        db = connect(message.config); store = createStore(":qa:", { database: db }); action = message.action;
        process.send({ ready: true }); return;
      }
      assert.equal(message.op, "go");
      let result;
      if (action === "reserve") {
        try { result = { reservation: store.reserveUsage(message.input) }; }
        catch (error) { result = { denied: safeCode(error) }; }
      } else if (action === "recover") {
        assert.equal(digest(persistentState(store, message.input)), message.input.digest);
        result = { canonicalMatch: true };
      } else throw Error("QA_ACTION_INVALID");
      store.close(); store = null; db = null;
      process.send({ result }); process.disconnect();
    } catch (error) {
      try { store?.close(); db?.close(); } catch {}
      process.send({ failure: safeCode(error) }); process.disconnect(); process.exitCode = 1;
    }
  });
}
function forkHelper(config, action) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|LANG|LC_ALL)$/i.test(key)));
  const child = fork(__filename, ["--worker"], { cwd: root, execArgv: [], serialization: "advanced", env, stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true });
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  let resolveReady, rejectReady, resolveResult, rejectResult, payload;
  const ready = new Promise((a, b) => { resolveReady = a; rejectReady = b; });
  const result = new Promise((a, b) => { resolveResult = a; rejectResult = b; });
  // Both promises always have observers, including setup failure before ready.
  ready.catch(() => {}); result.catch(() => {});
  const timer = setTimeout(() => { rejectReady(Error("QA_HELPER_TIMEOUT")); rejectResult(Error("QA_HELPER_TIMEOUT")); child.kill("SIGTERM"); }, 120000);
  child.on("message", (message) => {
    if (message.ready) resolveReady();
    if (message.result) payload = message.result;
    if (message.failure) { rejectReady(Error(message.failure)); rejectResult(Error(message.failure)); }
  });
  child.on("error", () => { rejectReady(Error("QA_HELPER_FAILED")); rejectResult(Error("QA_HELPER_FAILED")); });
  child.on("exit", (code) => { clearTimeout(timer); if (code === 0 && payload) resolveResult(payload); else { rejectReady(Error("QA_HELPER_FAILED")); rejectResult(Error("QA_HELPER_FAILED")); } });
  child.send({ op: "init", config, action });
  return { ready, result, go: (input) => child.send({ op: "go", input }) };
}
async function main() {
  let config, folder, db, store;
  const local = process.argv.includes("--local-self-test"), remote = process.argv.includes("--remote");
  assert.notEqual(local, remote, "QA_EXPLICIT_MODE_REQUIRED");
  if (local) {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v9-qa-selftest-"));
    config = { localProof: true, url: path.join(folder, "synthetic.sqlite") };
  } else {
    assert.equal(process.env.LUMIO_DATABASE_QA_CONFIRM, "isolated-synthetic", "QA_WRITE_CONFIRMATION_REQUIRED");
    config = databaseConfiguration(); validateConfig(config);
  }
  const checks = [], timings = {}, mutationDurations = [], started = performance.now();
  let activeCase = "configuration", activeMutation = "none";
  const check = async (name, fn) => { activeCase = name; const start = performance.now(); await fn(); timings[name] = Math.round(performance.now() - start); checks.push({ name, status: "PASS" }); console.log("PASS " + name); };
  const latencySummary = () => { const sorted = [...mutationDurations].sort((a, b) => a - b); return { count: sorted.length, min: sorted[0] ?? null, max: sorted.at(-1) ?? null, median: sorted[Math.floor(sorted.length / 2)] ?? null, p95: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? null }; };
  const report = (status, failure) => ({ status, checkedAt: new Date().toISOString(), scope: local ? "Native child/IPC with synthetic LOCAL SQLite; NOT remote durability evidence" : "Dedicated isolated Turso QA database only; synthetic identities, classes, submission and ledger; no live users, OAuth, provider requests or payments", passed: checks.length, checks, timingsMs: timings, teachingMutationLatencyMs: latencySummary(), totalMs: Math.round(performance.now() - started), ...(failure ? { failure: { check: activeCase, mutation: activeMutation, code: safeCode(failure), frames: String(failure.stack || "").split("\n").filter(line => /(?:teaching-core\.ts|store\.ts|test-v9-database-remote\.cjs):\d+:\d+/.test(line)).map(line => line.replace(/.*[\\/](?=(?:teaching-core\.ts|store\.ts|test-v9-database-remote\.cjs):)/, "").trim()) } } : {}) });
  const save = (value) => { const output = path.join(root, "docs/v9/reports", local ? "database-remote-runner-selftest.json" : "database-remote-qa.json"); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(value, null, 2) + "\n"); };
  try {
    await check("Full schema bootstrap and fresh readiness", () => { db = connect(config); store = createStore(":qa:", { database: db, adminEmails: ["synthetic-owner@example.test"] }); assert.equal(store.runtimeHealth().schemaVersion, 18); });
    await check("Fresh readiness latency", () => assert.deepEqual(store.runtimeHealth(), { ready: true, schemaVersion: 18 }));
    const run = randomUUID(), identity = (label) => ({ provider: "google", providerAccountId: `v9-qa-${run}-${label}`, name: "Synthetic QA", email: label === "owner" ? "synthetic-owner@example.test" : `${label}@example.test`, emailVerified: true });
    let owner, student, outsider, budgetUser, orgId, classId, questionId, assignmentId, submissionId;
    const mutate = (user, data) => { activeMutation = data.action; const start = performance.now(); try { return store.mutateTeaching(user.id, user.sessionVersion, { requestId: randomUUID(), ...data }); } finally { mutationDurations.push(Math.round(performance.now() - start)); } };
    await check("Canonical identities preserve one account and enforce organization scope", () => {
      owner = store.ensureIdentity(identity("owner")); student = store.ensureIdentity(identity("student")); outsider = store.ensureIdentity(identity("outsider")); budgetUser = store.ensureIdentity(identity("budget"));
      assert.equal(owner.role, "SUPER_ADMIN"); assert.equal(store.ensureIdentity(identity("student")).id, student.id);
      assert.ok(store.listFlags().every((flag) => flag.key && flag.key !== "undefined"));
      assert.ok(store.listAudit().every((event) => /^[A-Z][A-Z0-9_]+$/.test(event.action)));
      orgId = mutate(owner, { action: "org.create", name: "Synthetic durability QA" }).result.id;
      const input = { requestId: randomUUID(), action: "class.create", orgId, name: "Synthetic class", subject: "Toán", grade: "9", description: "Isolated synthetic QA only" };
      const created = mutate(owner, input); classId = created.result.id;
      const replay = mutate(owner, input); assert.equal(replay.replayed, true); assert.equal(replay.result.id, classId);
      assert.throws(() => store.readTeaching(outsider.id, outsider.sessionVersion, { orgId }), (error) => error.code === "TEACHING_FORBIDDEN");
      const invite = mutate(owner, { action: "invite.create", orgId, classId, expectedRevision: 1, expiresInDays: 1, maxUses: 1 });
      mutate(student, { action: "class.join", code: invite.result.inviteCode });
    });
    await check("Reviewed assignment and actual student submission commit together with operation receipts", () => {
      questionId = mutate(owner, { action: "question.create", orgId, draft: { classId, prompt: "Tính 2 + 2.", kind: "mcq", choices: ["4", "5", "3", "2"], correctIndex: 0, explanation: "2 + 2 = 4.", maxPoints: 1, topic: "Số học", difficulty: "basic", references: [] } }).result.id;
      mutate(owner, { action: "question.review", orgId, id: questionId, expectedRevision: 1 });
      assignmentId = mutate(owner, { action: "assignment.create", orgId, draft: { classId, title: "Synthetic durability exercise", instructions: "Synthetic answer only.", questionIds: [questionId], target: { kind: "class", ids: [] }, dueAt: new Date(Date.now() + 86400000).toISOString() } }).result.id;
      mutate(owner, { action: "assignment.review", orgId, id: assignmentId, expectedRevision: 1 });
      mutate(owner, { action: "assignment.issue", orgId, id: assignmentId, expectedRevision: 2 });
      const request = { requestId: randomUUID(), action: "submission.submit", orgId, assignmentId, expectedRevision: 0, answers: [{ questionId, response: 0 }] };
      submissionId = mutate(student, request).result.id;
      assert.equal(mutate(student, request).replayed, true);
    });
    await check("Foreign keys and immutable audit reject writes without poisoning healthy rollback", () => {
      db.beginTransaction(); db.exec("BEGIN IMMEDIATE");
      try {
        assert.throws(() => db.prepare("INSERT INTO memberships(user_id,organization_id,role) VALUES(?,?,?)").run("missing-synthetic-user", orgId, "STUDENT"), (error) => error.code?.startsWith("SQLITE_CONSTRAINT"));
        assert.throws(() => db.prepare("UPDATE audit_events SET result='error' WHERE actor_id=?").run(owner.id), /AUDIT_APPEND_ONLY/);
      } finally { if (!db.poisoned) db.exec("ROLLBACK"); db.endTransaction(); }
      assert.equal(db.poisoned, false);
    });
    await check("Sync CAS and same-request replay preserve the acknowledged canonical revision", () => {
      const current = store.syncRead(student.id, student.sessionVersion);
      const data = { version: 1, library: { version: 1, items: [], spaces: [] }, learning: { version: 1, tasks: [], reviews: [], events: [], focus: null }, preferences: { version: 1, enabled: true, feedback: [] } };
      const input = { epoch: current.epoch, expectedRevision: current.revision, requestId: randomUUID(), data };
      const saved = store.syncWrite(student.id, student.sessionVersion, input);
      assert.equal(store.syncWrite(student.id, student.sessionVersion, input).revision, saved.revision);
      assert.throws(() => store.syncWrite(student.id, student.sessionVersion, { ...input, requestId: randomUUID() }), (error) => error.code === "SYNC_CONFLICT");
    });
    await check("Two separate processes cannot overdraw the same canonical wallet", async () => {
      assert.equal(store.getBillingSnapshot(budgetUser.id, budgetUser.sessionVersion).account.balance, 200);
      const peers = [forkHelper(config, "reserve"), forkHelper(config, "reserve")];
      await Promise.all(peers.map((peer) => peer.ready));
      peers.forEach((peer) => peer.go({ userId: budgetUser.id, sessionVersion: budgetUser.sessionVersion, requestId: randomUUID(), task: "summary", kind: "video", mode: "tutor", duration: 600 }));
      const results = await Promise.all(peers.map((peer) => peer.result));
      assert.equal(results.filter((value) => value.reservation).length, 1);
      assert.equal(results.filter((value) => value.denied === "CREDITS_INSUFFICIENT").length, 1);
      const reservation = results.find((value) => value.reservation).reservation;
      const held = store.getBillingSnapshot(budgetUser.id, budgetUser.sessionVersion).account;
      assert.equal(held.balance, 90); assert.equal(held.reserved, 110);
      store.failUsage({ userId: budgetUser.id, reservationId: reservation.reservationId, reason: "synthetic-qa-no-provider" });
      assert.equal(store.getBillingSnapshot(budgetUser.id, budgetUser.sessionVersion).account.balance, 200);
    });
    await check("Fresh process recovers exact canonical teacher/student UUIDs, submission, sync and wallet", async () => {
      const input = { owner, student, orgId, classId, assignmentId, submissionId };
      input.digest = digest(persistentState(store, input));
      store.close(); store = null; db = null;
      const peer = forkHelper(config, "recover"); await peer.ready; peer.go(input);
      assert.equal((await peer.result).canonicalMatch, true);
    });
    save(report("PASS")); console.log(JSON.stringify({ status: "PASS", passed: checks.length, remote: !local }));
  } catch (error) { save(report("FAIL", error)); throw error; }
  finally {
    try { store?.close(); db?.close(); } catch {}
    if (folder) { assert.equal(path.dirname(folder), path.resolve(os.tmpdir())); assert.ok(path.basename(folder).startsWith("lumio-v9-qa-selftest-")); fs.rmSync(folder, { recursive: true, force: true }); }
  }
}
(process.argv.includes("--worker") ? helper() : main()).catch((error) => { console.error(JSON.stringify({ status: "FAIL", code: safeCode(error) })); process.exitCode = 1; });
