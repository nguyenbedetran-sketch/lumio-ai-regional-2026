const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require("node:worker_threads");
const { DatabaseSync } = require("node:sqlite");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name.startsWith(".")
        ? load(
            path.relative(
              root,
              path.resolve(path.dirname(filename), name + ".ts"),
            ),
          )
        : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const { createStore } = load("lib/server/store.ts");
if (!isMainThread) {
  const store = createStore(workerData.filename);
  parentPort.postMessage("ready");
  Atomics.wait(new Int32Array(workerData.barrier), 0, 0);
  try {
    parentPort.postMessage({ result: store.reserveUsage(workerData.input) });
  } catch (error) {
    parentPort.postMessage({ error: error.code });
  } finally {
    store.close();
  }
} else {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-billing-"));
  const filename = path.join(directory, "isolated.sqlite");
  let clock = Date.UTC(2026, 8, 20, 8),
    passed = 0;
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const store = createStore(filename, {
    adminEmails: ["owner@example.test"],
    now: () => clock,
  });
  const identity = (id, email = `${id}@example.test`) =>
    store.ensureIdentity({
      provider: "google",
      providerAccountId: id,
      name: id,
      email,
      emailVerified: true,
    });
  const owner = identity("owner", "owner@example.test"),
    learner = identity("learner"),
    other = identity("other");
  const usage = (user = learner, overrides = {}) => ({
    userId: user.id,
    sessionVersion: user.sessionVersion,
    requestId: crypto.randomUUID(),
    task: "chat",
    kind: "text",
    mode: "quick",
    ...overrides,
  });
  const snapshot = (user = learner) =>
    store.getBillingSnapshot(user.id, user.sessionVersion);
  const error = (code) => (e) => e.code === code;
  const grant = (user, overrides = {}) =>
    store.adminGrant({
      actorId: owner.id,
      sessionVersion: owner.sessionVersion,
      userId: user.id,
      requestId: crypto.randomUUID(),
      planId: "premium",
      credits: 100,
      days: 7,
      reason: "Kiểm tra tính năng có kiểm soát",
      ...overrides,
    });
  async function test(name, fn) {
    await fn();
    passed++;
    console.log("PASS " + name);
  }
  async function main() {
    await test("Catalog leaves all paid prices/credits unassigned and disables checkout", () => {
      const catalog = store.getBillingCatalog();
      for (const plan of catalog.plans.filter((p) => p.id !== "free")) {
        assert.equal(plan.monthlyPriceMinor, null);
        assert.equal(plan.yearlyPriceMinor, null);
        assert.equal(plan.credits, null);
        assert.equal(plan.checkoutAvailable, false);
      }
      for (const pack of catalog.packs) {
        assert.equal(pack.priceMinor, null);
        assert.equal(pack.credits, null);
      }
      assert.equal(
        catalog.plans.find((p) => p.id === "free").entitlements.maxVideoSeconds,
        600,
      );
    });
    await test("Trial is granted once to the canonical user, even after reopening database", () => {
      assert.equal(snapshot().account.balance, 200);
      assert.equal(
        snapshot().history.filter((e) => e.kind === "trial").length,
        1,
      );
      const reopened = createStore(filename);
      try {
        assert.equal(
          reopened.getBillingSnapshot(learner.id, 1).account.balance,
          200,
        );
      } finally {
        reopened.close();
      }
    });
    await test("Google and Facebook linking share the original wallet without a second trial", () => {
      const intent = store.createLinkIntent(learner.id, "facebook", 1);
      const linked = store.claimIdentity({
        userId: learner.id,
        token: intent.token,
        identity: {
          provider: "facebook",
          providerAccountId: "billing-facebook",
          name: "Linked learner",
          email: "linked@example.test",
          emailVerified: false,
        },
      });
      assert.equal(linked.id, learner.id);
      assert.equal(
        store.getBillingSnapshot(
          store.findIdentity("facebook", "billing-facebook").id,
          1,
        ).account.balance,
        200,
      );
      assert.equal(
        snapshot().history.filter((e) => e.kind === "trial").length,
        1,
      );
    });
    await test("Reservation deducts available credits and settlement consumes held units once", () => {
      const r = store.reserveUsage(usage());
      assert.equal(r.units, 2);
      assert.equal(snapshot().account.balance, 198);
      assert.equal(snapshot().account.reserved, 2);
      assert.deepEqual(
        store.settleUsage({
          userId: learner.id,
          reservationId: r.reservationId,
        }),
        { status: "settled", changed: true },
      );
      assert.equal(
        store.settleUsage({
          userId: learner.id,
          reservationId: r.reservationId,
        }).changed,
        false,
      );
      assert.equal(
        store.failUsage({ userId: learner.id, reservationId: r.reservationId })
          .changed,
        false,
      );
      assert.equal(snapshot().account.balance, 198);
      assert.equal(snapshot().account.reserved, 0);
    });
    await test("Provider failure refunds exactly once, and another user cannot finalize", () => {
      const before = snapshot().account.balance,
        r = store.reserveUsage(
          usage(learner, { task: "summary", kind: "pdf" }),
        );
      assert.throws(
        () =>
          store.failUsage({ userId: other.id, reservationId: r.reservationId }),
        error("BILLING_RESERVATION_NOT_FOUND"),
      );
      store.failUsage({ userId: learner.id, reservationId: r.reservationId });
      store.failUsage({ userId: learner.id, reservationId: r.reservationId });
      assert.equal(snapshot().account.balance, before);
      assert.equal(snapshot().account.reserved, 0);
    });
    await test("Duplicate request keys cannot execute a provider twice", () => {
      const input = usage(),
        r = store.reserveUsage(input);
      assert.throws(
        () => store.reserveUsage(input),
        error("BILLING_REQUEST_IN_PROGRESS"),
      );
      store.failUsage({ userId: learner.id, reservationId: r.reservationId });
      assert.throws(
        () => store.reserveUsage(input),
        error("BILLING_REQUEST_FINALIZED"),
      );
    });
    await test("Plan access is server-enforced for models, voice, media and video duration", () => {
      const before = snapshot().account.balance;
      for (const overrides of [
        { mode: "deep" },
        { task: "summary", mode: "think" },
        { task: "speech" },
        { kind: "audio" },
        { kind: "video", duration: 601 },
      ])
        assert.throws(
          () => store.reserveUsage(usage(learner, overrides)),
          error("PLAN_ACCESS_REQUIRED"),
        );
      assert.throws(
        () => store.reserveUsage(usage(learner, { kind: "video" })),
        error("INVALID_VIDEO_DURATION"),
      );
      const r = store.reserveUsage(
        usage(learner, { kind: "video", duration: 600 }),
      );
      store.failUsage({ userId: learner.id, reservationId: r.reservationId });
      assert.equal(snapshot().account.balance, before);
    });
    await test("Sandbox grants require real fresh-role authority and are audited/idempotent", () => {
      assert.throws(
        () => grant(learner, { actorId: learner.id }),
        error("FORBIDDEN"),
      );
      assert.throws(
        () => grant(learner, { sessionVersion: 999 }),
        error("SESSION_REVOKED"),
      );
      const requestId = crypto.randomUUID(),
        before = snapshot().account.balance;
      grant(learner, { requestId });
      grant(learner, { requestId });
      assert.equal(snapshot().account.balance, before + 100);
      assert.equal(snapshot().account.planSource, "sandbox");
      assert.throws(
        () => grant(learner, { requestId, credits: 101 }),
        error("IDEMPOTENCY_CONFLICT"),
      );
      assert.ok(
        store
          .listAudit()
          .some(
            (event) =>
              event.action === "BILLING_SANDBOX_GRANTED" &&
              event.after.money === false,
          ),
      );
      process.env.NODE_ENV = "production";
      try {
        assert.throws(() => grant(other), error("SANDBOX_DISABLED"));
      } finally {
        process.env.NODE_ENV = "development";
      }
    });
    await test("Checkout never grants a paid plan, even when admin configures prices", () => {
      const input = {
        userId: other.id,
        sessionVersion: 1,
        itemId: "plus",
        interval: "month",
      };
      assert.throws(
        () => store.prepareCheckout(input),
        error("PRICE_NOT_CONFIGURED"),
      );
      assert.throws(
        () =>
          store.updateBillingCatalog({
            actorId: learner.id,
            sessionVersion: 1,
            itemId: "plus",
            monthlyPriceMinor: 1,
            yearlyPriceMinor: null,
            credits: 1,
          }),
        error("FORBIDDEN"),
      );
      // Arbitrary values below are isolated test fixtures, not product prices.
      store.updateBillingCatalog({
        actorId: owner.id,
        sessionVersion: 1,
        itemId: "plus",
        monthlyPriceMinor: 123,
        yearlyPriceMinor: null,
        credits: 42,
      });
      assert.throws(
        () => store.prepareCheckout(input),
        error("PAYMENT_PROVIDER_NOT_CONFIGURED"),
      );
      assert.equal(snapshot(other).account.planId, "free");
      assert.equal(snapshot(other).account.balance, 200);
    });
    await test("Cancel/resume/downgrade sandbox does not renew credits or make payments", () => {
      const balance = snapshot().account.balance;
      for (const action of ["cancel", "resume", "downgrade"]) {
        const result = store.updateSubscription({
          userId: learner.id,
          sessionVersion: 1,
          requestId: crypto.randomUUID(),
          action,
          ...(action === "downgrade" ? { planId: "free" } : {}),
        });
        assert.equal(result.account.cancelAtPeriodEnd, action !== "resume");
        assert.equal(result.account.balance, balance);
        assert.equal(result.account.autoRenewEnabled, false);
      }
      assert.throws(
        () =>
          store.updateSubscription({
            userId: learner.id,
            sessionVersion: 1,
            requestId: crypto.randomUUID(),
            action: "downgrade",
            planId: "plus",
          }),
        error("CHECKOUT_REQUIRED"),
      );
      clock += 8 * 86400000;
      assert.equal(snapshot().account.planId, "free");
      assert.equal(snapshot().account.balance, balance);
    });
    await test("Crashed requests release holds after ten minutes, with a durable refund event", () => {
      const before = snapshot().account.balance,
        r = store.reserveUsage(usage());
      clock += 601000;
      assert.equal(snapshot().account.balance, before);
      assert.equal(snapshot().account.reserved, 0);
      assert.equal(
        store.settleUsage({
          userId: learner.id,
          reservationId: r.reservationId,
        }).status,
        "refunded",
      );
    });
    await test("Revoked sessions cannot reserve or mutate, but server failure can release their holds", () => {
      const target = identity("revoked"),
        r = store.reserveUsage(usage(target));
      store.updateUserAccess(
        owner.id,
        target.id,
        "revoke",
        "Regression revoke during AI request",
        1,
      );
      assert.throws(
        () => store.reserveUsage(usage(target)),
        error("SESSION_REVOKED"),
      );
      assert.throws(() => snapshot(target), error("SESSION_REVOKED"));
      assert.equal(
        store.failUsage({ userId: target.id, reservationId: r.reservationId })
          .changed,
        true,
      );
      assert.equal(store.getBillingSnapshot(target.id, 2).account.balance, 200);
    });
    await test("Two concurrent DB connections cannot overdraw the same credits", async () => {
      const target = identity("concurrent");
      snapshot(target);
      const barrier = new SharedArrayBuffer(4),
        workers = [],
        results = [],
        ready = [];
      for (let i = 0; i < 2; i++) {
        const worker = new Worker(__filename, {
          workerData: {
            filename,
            barrier,
            input: usage(target, {
              task: "summary",
              mode: "tutor",
              kind: "video",
              duration: 600,
            }),
          },
        });
        workers.push(worker);
        ready.push(
          new Promise((resolve, reject) => {
            worker.once("message", resolve);
            worker.once("error", reject);
          }),
        );
        results.push(
          new Promise((resolve, reject) => {
            worker.on("message", (value) => {
              if (value !== "ready") resolve(value);
            });
            worker.once("error", reject);
          }),
        );
      }
      try {
        await Promise.all(ready);
        Atomics.store(new Int32Array(barrier), 0, 1);
        Atomics.notify(new Int32Array(barrier), 0);
        const output = await Promise.all(results);
        assert.equal(output.filter((r) => r.result).length, 1);
        assert.equal(
          output.filter((r) => r.error === "CREDITS_INSUFFICIENT").length,
          1,
        );
        // Inspect directly because worker wall time differs from this test's injected clock.
        const db = new DatabaseSync(filename);
        try {
          const account = db
            .prepare(
              "SELECT balance,reserved FROM billing_accounts WHERE user_id=?",
            )
            .get(target.id);
          assert.equal(account.balance, 90);
          assert.equal(account.reserved, 110);
        } finally {
          db.close();
        }
      } finally {
        await Promise.all(workers.map((worker) => worker.terminate()));
      }
    });
    await test("Ledger is append-only and balances reconcile to real event deltas", () => {
      const db = new DatabaseSync(filename);
      try {
        assert.throws(
          () => db.prepare("UPDATE billing_ledger SET note='tampered'").run(),
          /LEDGER_APPEND_ONLY/,
        );
        assert.throws(
          () => db.prepare("DELETE FROM billing_ledger").run(),
          /LEDGER_APPEND_ONLY/,
        );
        const users = db
          .prepare("SELECT user_id,balance,reserved FROM billing_accounts")
          .all();
        for (const account of users) {
          const sums = db
            .prepare(
              "SELECT sum(available_delta) available,sum(reserved_delta) reserved FROM billing_ledger WHERE user_id=?",
            )
            .get(account.user_id);
          assert.equal(account.balance, sums.available);
          assert.equal(account.reserved, sums.reserved);
        }
      } finally {
        db.close();
      }
    });
    console.log(
      `\n${passed} billing checks passed; isolated databases, no payment or AI network.`,
    );
  }
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => {
      store.close();
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
      fs.rmSync(directory, { recursive: true, force: true });
    });
}
