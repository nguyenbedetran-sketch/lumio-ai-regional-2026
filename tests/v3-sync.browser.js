// Real rendered UI + browser storage, isolated synthetic accounts and in-memory HTTP fixtures.
// No OAuth session, production backend, private library, paid provider or payment is used.
async function lumioV3SyncQA(page) {
  const passed = [],
    errors = [],
    external = [],
    forbidden = [],
    calls = [];
  const A = "qa-v3-sync-a",
    B = "qa-v3-sync-b";
  let account = A,
    loseNextAck = false,
    appliedWrites = 0,
    replayedWrites = 0;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const check = (value, label) => {
    if (!value) throw Error(label);
    passed.push(label);
  };
  const at = "2026-10-15T08:00:00.000Z";
  function item(id, notes) {
    return {
      id,
      title: `KIỂM THỬ ĐỒNG BỘ · ${id}`,
      kind: "text",
      spaceId: "",
      createdAt: at,
      updatedAt: at,
      text: "Học liệu giả lập kiểm thử đồng bộ. Không chứa dữ liệu học sinh.",
      notes,
      cards: [],
      questions: [],
      attempts: [],
      favorite: false,
    };
  }
  function envelope(items, enabled = true) {
    return {
      version: 1,
      library: { version: 1, items, spaces: [] },
      learning: { version: 1, tasks: [], reviews: [], events: [], focus: null },
      preferences: { version: 1, enabled, feedback: [] },
    };
  }
  const snapshots = new Map([
    [
      A,
      {
        epoch: "synthetic-epoch-a",
        revision: 1,
        digest: "synthetic",
        updatedAt: at,
        expiresAt: "2099-01-01T00:00:00.000Z",
        data: envelope([item("shared", "BẢN MÁY CHỦ BAN ĐẦU")], false),
      },
    ],
    [
      B,
      {
        epoch: "synthetic-epoch-b",
        revision: 0,
        digest: null,
        updatedAt: at,
        expiresAt: "2099-01-01T00:00:00.000Z",
        data: null,
      },
    ],
  ]);
  const operations = new Map();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = request.url();
    if (!/^https?:/.test(url)) return route.continue();
    if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
      external.push(url.match(/^https?:\/\/[^/]+/)[0]);
      return route.abort();
    }
    const pathname = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (pathname.startsWith("/api/")) {
      if (request.method() !== "GET") forbidden.push(pathname);
      // Unknown API reads are isolated too: do not read the developer's private DB.
      return route.fulfill({
        status: request.method() === "GET" ? 200 : 409,
        json:
          request.method() === "GET"
            ? {}
            : { error: "SYNTHETIC_QA_NO_MUTATIONS" },
      });
    }
    return route.continue();
  });
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        google: true,
        facebook: false,
        ai: false,
        capabilities: {
          tutor: false,
          summary: false,
          media: false,
          transcription: false,
          speech: false,
        },
      },
    }),
  );
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({
      json: {
        user: { name: `Synthetic Sync ${account === A ? "A" : "B"}` },
        accountKey: account,
        expires: "2099-01-01T00:00:00.000Z",
      },
    }),
  );
  await page.route("**/api/account", (r) =>
    r.fulfill({
      json: {
        authenticated: true,
        id: account,
        name: `Synthetic Sync ${account === A ? "A" : "B"}`,
        isAdmin: false,
        identities: [],
        providers: { google: true, facebook: false },
      },
    }),
  );
  await page.route("**/api/rag/documents?*", (r) =>
    r.fulfill({ json: { documents: [], embeddingsAvailable: false } }),
  );
  await page.route("**/api/sync", async (route) => {
    const request = route.request(),
      actor = request.headers()["x-lumio-account"];
    const method = request.method(),
      body = request.postDataJSON();
    calls.push({
      actor,
      method,
      requestId: body?.requestId,
      data: body?.data && clone(body.data),
    });
    if (actor !== account || !snapshots.has(actor))
      return route.fulfill({ status: 403, json: { error: "ACCOUNT_CHANGED" } });
    const snapshot = snapshots.get(actor);
    if (method === "GET") return route.fulfill({ json: clone(snapshot) });
    if (method !== "PUT")
      return route.fulfill({
        status: 405,
        json: { error: "SYNTHETIC_METHOD" },
      });
    const operationKey = `${actor}:${body.requestId}`,
      fingerprint = JSON.stringify(body);
    const old = operations.get(operationKey);
    if (old) {
      if (old.fingerprint !== fingerprint)
        return route.fulfill({ status: 409, json: { error: "SYNC_CONFLICT" } });
      replayedWrites++;
      return route.fulfill({ json: old.ack });
    }
    if (
      body.epoch !== snapshot.epoch ||
      body.expectedRevision !== snapshot.revision
    )
      return route.fulfill({ status: 409, json: { error: "SYNC_CONFLICT" } });
    snapshot.revision++;
    snapshot.data = clone(body.data);
    snapshot.digest = "synthetic-updated";
    const ack = { epoch: snapshot.epoch, revision: snapshot.revision };
    operations.set(operationKey, { fingerprint, ack });
    appliedWrites++;
    if (loseNextAck) {
      loseNextAck = false;
      return route.abort("connectionreset");
    }
    return route.fulfill({ json: ack });
  });
  await page.addInitScript(() => {
    localStorage.setItem("lumio-language", "vi");
    localStorage.setItem("lumio-theme", "light");
    localStorage.setItem("lumio-motion-v3", "off");
    const addListener = window.addEventListener;
    window.__qaSyncBeforeUnload = [];
    window.addEventListener = function (type, listener, options) {
      if (type === "beforeunload")
        window.__qaSyncBeforeUnload.push({ listener, options });
      return addListener.call(this, type, listener, options);
    };
    // One-shot storage fault in this disposable profile, never in application code.
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (
        window.__qaSyncFailLearningOnce &&
        key.startsWith("lumio-learning-v1:")
      ) {
        window.__qaSyncFailLearningOnce = false;
        throw new DOMException(
          "Synthetic storage write fault",
          "QuotaExceededError",
        );
      }
      return setItem.call(this, key, value);
    };
  });
  async function readLocal(actor = account) {
    return page.evaluate(async (actor) => {
      const library = await new Promise((resolve, reject) => {
        const open = indexedDB.open("lumio-local-library-v2", 2);
        open.onsuccess = () => {
          const db = open.result,
            q = db.transaction("libraries").objectStore("libraries").get(actor);
          q.onsuccess = () => {
            db.close();
            resolve(q.result);
          };
          q.onerror = () => reject(q.error);
        };
        open.onerror = () => reject(open.error);
      });
      return {
        version: 1,
        library,
        learning: JSON.parse(
          localStorage.getItem(
            `lumio-learning-v1:${encodeURIComponent(actor)}`,
          ) || "null",
        ),
        preferences: JSON.parse(
          localStorage.getItem(
            `lumio-personalization-v1:${encodeURIComponent(actor)}`,
          ) || "null",
        ),
        cursor: JSON.parse(
          localStorage.getItem(`lumio-sync-v3:${encodeURIComponent(actor)}`) ||
            "null",
        ),
      };
    }, actor);
  }
  async function seedLocal(data, actor = account) {
    await page.evaluate(
      async ({ actor, data }) => {
        await new Promise((resolve, reject) => {
          const open = indexedDB.open("lumio-local-library-v2", 2);
          open.onupgradeneeded = () => {
            if (!open.result.objectStoreNames.contains("libraries"))
              open.result.createObjectStore("libraries");
            if (!open.result.objectStoreNames.contains("revisions"))
              open.result.createObjectStore("revisions");
          };
          open.onsuccess = () => {
            const db = open.result,
              tx = db.transaction(["libraries", "revisions"], "readwrite");
            tx.objectStore("libraries").put(data.library, actor);
            const revisions = tx.objectStore("revisions"),
              prior = revisions.get(actor);
            prior.onsuccess = () =>
              revisions.put((prior.result || 0) + 1, actor);
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          open.onerror = () => reject(open.error);
        });
        localStorage.setItem(
          `lumio-learning-v1:${encodeURIComponent(actor)}`,
          JSON.stringify(data.learning),
        );
        localStorage.setItem(
          `lumio-personalization-v1:${encodeURIComponent(actor)}`,
          JSON.stringify(data.preferences),
        );
      },
      { actor, data },
    );
  }
  async function settings() {
    await page
      .locator(".lm-profile")
      .filter({ hasText: `Synthetic Sync ${account === A ? "A" : "B"}` })
      .waitFor();
    await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
    try {
      await page.locator("[data-sync-panel] input[type=checkbox]").waitFor();
    } catch (error) {
      await page.screenshot({
        path: "docs/v3/qa-sync-failure-diagnostic.png",
        fullPage: true,
      });
      throw Error(
        `Sync settings unavailable after ${passed.length} checks: ${JSON.stringify(errors)}; ${(await page.locator("body").innerText()).slice(-1000)}; ${error.message}`,
      );
    }
    await page.waitForFunction(() => {
      const input = document.querySelector("[data-sync-panel] input");
      return input && !input.disabled;
    });
  }
  async function reloadSettings() {
    await page.reload();
    await settings();
  }
  const sync = page.locator("[data-sync-panel]");
  const syncNow = () =>
    sync.getByRole("button", { name: "Đồng bộ ngay", exact: true }).click();
  const done = () =>
    sync.getByRole("status").filter({ hasText: "Đã đồng bộ" }).waitFor();
  const conflict = () =>
    sync
      .getByRole("status")
      .filter({ hasText: "Có thay đổi khác nhau" })
      .waitFor();
  const failed = async () => {
    try {
      await sync
        .getByRole("status")
        .filter({ hasText: "Chưa đồng bộ" })
        .waitFor();
    } catch (error) {
      await page.screenshot({
        path: "docs/v3/qa-sync-failure-diagnostic.png",
        fullPage: true,
      });
      const current = await readLocal();
      throw Error(
        `Expected sync failure after ${passed.length} checks: ${await sync.innerText()}; cursor=${JSON.stringify({ revision: current.cursor?.revision, pending: !!current.cursor?.pending })}; ${JSON.stringify(errors)}; ${error.message}`,
      );
    }
  };
  const choose = (side) =>
    sync
      .getByRole("button", {
        name:
          side === "remote"
            ? "Ưu tiên thay đổi từ máy chủ"
            : "Ưu tiên thay đổi trên thiết bị này",
        exact: true,
      })
      .click();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("http://localhost:3000/");
  await page
    .locator(".lm-profile")
    .filter({ hasText: "Synthetic Sync A" })
    .waitFor();
  await seedLocal(envelope([item("shared", "BẢN THIẾT BỊ BAN ĐẦU")]));
  await reloadSettings();
  check(
    !(await sync.locator("input").isChecked()) && calls.length === 0,
    "Fresh account opens settings without consent, snapshot read or upload",
  );
  check(
    await sync
      .getByRole("button", { name: "Đồng bộ ngay", exact: true })
      .isDisabled(),
    "Sync action requires explicit opt-in",
  );
  await sync.locator("input").check();
  check(
    calls.length === 0,
    "Opting in alone does not read or upload study content",
  );
  await syncNow();
  await conflict();
  check(
    calls.length === 1 && calls[0].method === "GET" && appliedWrites === 0,
    "First pairing reads only and pauses for an explicit choice",
  );
  check(
    (await readLocal()).library.items[0].notes === "BẢN THIẾT BỊ BAN ĐẦU",
    "First-pair conflict cannot overwrite local notes before a choice",
  );
  await sync.screenshot({ path: "docs/v3/qa-sync-first-pair-desktop.png" });
  await choose("remote");
  await done();
  let local = await readLocal();
  check(
    local.library.items[0].notes === "BẢN MÁY CHỦ BAN ĐẦU" &&
      !local.preferences.enabled,
    "Server choice actually persists both library and preference data in browser storage",
  );
  check(
    appliedWrites === 0 && local.cursor.revision === 1 && !local.cursor.pending,
    "Pure server pull advances the applied cursor without an upload",
  );
  local.library.items[0].notes = "CHỈNH SỬA TỪ THIẾT BỊ";
  await seedLocal(local);
  snapshots.get(A).data.library.items[0].notes = "CHỈNH SỬA TỪ MÁY CHỦ";
  snapshots.get(A).revision++;
  const callsBeforeReload = calls.length;
  await reloadSettings();
  check(
    await sync.locator("input").isChecked(),
    "Opt-in survives reload only for its account",
  );
  check(
    calls.length === callsBeforeReload,
    "Remembered opt-in does not automatically upload on reload",
  );
  await syncNow();
  await conflict();
  check(
    (await sync.textContent()).includes("Học liệu: shared"),
    "Concurrent edits identify the conflicting record instead of silently merging it",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await sync.scrollIntoViewIfNeeded();
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Consent, conflict recovery and choice buttons fit a 390px phone viewport",
  );
  for (const name of [
    "Ưu tiên thay đổi trên thiết bị này",
    "Ưu tiên thay đổi từ máy chủ",
  ]) {
    const bounds = await sync
      .getByRole("button", { name, exact: true })
      .boundingBox();
    check(
      bounds && bounds.x >= 0 && bounds.x + bounds.width <= 391,
      `Phone choice remains within the viewport: ${name}`,
    );
  }
  await sync.screenshot({ path: "docs/v3/qa-sync-conflict-phone.png" });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await choose("local");
  await done();
  check(
    snapshots.get(A).data.library.items[0].notes === "CHỈNH SỬA TỪ THIẾT BỊ" &&
      appliedWrites === 1,
    "Explicit device choice uploads the selected edit exactly once",
  );

  // A different record is added on each side. Fail local application AFTER server ACK.
  local = await readLocal();
  local.library.items.push(item("device-only", "THÊM TỪ THIẾT BỊ"));
  await seedLocal(local);
  snapshots
    .get(A)
    .data.library.items.push(item("server-only", "THÊM TỪ MÁY CHỦ"));
  snapshots.get(A).data.preferences.enabled = true;
  snapshots
    .get(A)
    .data.learning.events.push({
      id: "synthetic-remote-read",
      kind: "read",
      at,
      localDay: "2026-10-15",
      itemId: "server-only",
    });
  snapshots.get(A).revision++;
  await reloadSettings();
  const appliedBase = clone((await readLocal()).cursor.base);
  await page.evaluate(() => {
    window.__qaSyncFailLearningOnce = true;
  });
  await syncNow();
  await failed();
  local = await readLocal();
  check(
    local.cursor.pending &&
      JSON.stringify(local.cursor.base) === JSON.stringify(appliedBase),
    "Post-ACK local write failure retains the pending operation and original applied base",
  );
  check(
    appliedWrites === 2 &&
      !(await sync.getByRole("status").textContent()).includes("Đã đồng bộ"),
    "A server ACK is never presented as completed local synchronization",
  );
  const failedId = local.cursor.pending.requestId;
  await sync.screenshot({ path: "docs/v3/qa-sync-local-write-recovery.png" });
  snapshots
    .get(A)
    .data.library.items.push(item("server-after-failure", "THÊM SAU LỖI LƯU"));
  snapshots.get(A).revision++;
  // The app correctly warns before leaving unsaved state. CLI treats native dialogs
  // as a separate command, so suppress only this disposable fault-test reload prompt.
  await page.evaluate(() => {
    for (const { listener, options } of window.__qaSyncBeforeUnload)
      window.removeEventListener("beforeunload", listener, options);
  });
  await reloadSettings();
  await syncNow();
  await done();
  local = await readLocal();
  check(
    ["shared", "device-only", "server-only", "server-after-failure"].every(
      (id) => local.library.items.some((i) => i.id === id),
    ),
    "Retry after failed local application preserves remote records and new server changes",
  );
  check(
    local.preferences.enabled &&
      !local.cursor.pending &&
      appliedWrites === 2 &&
      replayedWrites === 1,
    "Failed apply replays its original idempotency key, restores preferences and clears the outbox only after success",
  );
  check(
    calls.filter((c) => c.requestId === failedId).length === 2,
    "The same pending operation is replayed rather than regenerated after reload",
  );

  // The simulated server commits a PUT, then the browser receives a network reset.
  local.library.items[0].notes = "BẢN GỬI BỊ MẤT PHẢN HỒI";
  await seedLocal(local);
  await reloadSettings();
  loseNextAck = true;
  await syncNow();
  await failed();
  local = await readLocal();
  const lostId = local.cursor.pending?.requestId;
  check(
    !!lostId && appliedWrites === 3,
    "Lost response leaves a durable browser outbox after the synthetic server commits",
  );
  await reloadSettings();
  await syncNow();
  await done();
  local = await readLocal();
  check(
    appliedWrites === 3 &&
      replayedWrites === 2 &&
      !local.cursor.pending &&
      calls.filter((c) => c.requestId === lostId).length === 2,
    "Lost-ACK reload replay uses one operation and does not duplicate the synthetic server write",
  );
  check(
    local.library.items[0].notes === "BẢN GỬI BỊ MẤT PHẢN HỒI",
    "Lost-ACK replay preserves the learner's actual note",
  );

  local.library.items[0].notes = "GHI CHÚ NGOẠI TUYẾN";
  await seedLocal(local);
  await reloadSettings();
  const callsBeforeOffline = calls.length;
  await page.context().setOffline(true);
  check(
    !(await page.evaluate(() => navigator.onLine)),
    "Browser context actually enters offline mode",
  );
  await syncNow();
  await sync
    .getByRole("status")
    .filter({ hasText: "Đang ngoại tuyến" })
    .waitFor();
  check(
    calls.length === callsBeforeOffline && !!(await readLocal()).cursor.pending,
    "Offline synchronization writes only a browser outbox and makes no HTTP request",
  );
  await sync.screenshot({ path: "docs/v3/qa-sync-offline-queue.png" });
  await page.context().setOffline(false);
  await done();
  local = await readLocal();
  check(
    appliedWrites === 4 &&
      !local.cursor.pending &&
      snapshots.get(A).data.library.items[0].notes === "GHI CHÚ NGOẠI TUYẾN",
    "The browser online event resumes the queued change and clears it after local persistence",
  );
  await sync.screenshot({ path: "docs/v3/qa-sync-reconnected-desktop.png" });

  // A new synthetic account must not inherit the first account's consent/cursor/library.
  const aCursor = clone(local.cursor),
    aCalls = calls.length;
  await seedLocal(envelope([item("b-private", "CHỈ TÀI KHOẢN B")]), B);
  account = B;
  await reloadSettings();
  const bLocal = await readLocal();
  check(
    !(await sync.locator("input").isChecked()) &&
      !bLocal.cursor &&
      calls.length === aCalls,
    "Switching accounts starts with separate consent and no inherited cursor or automatic requests",
  );
  check(
    bLocal.library.items.length === 1 &&
      bLocal.library.items[0].id === "b-private" &&
      JSON.stringify((await readLocal(A)).cursor) === JSON.stringify(aCursor),
    "Account switch cannot reveal the other account's local records or alter its recovery cursor",
  );
  await sync.locator("input").check();
  await syncNow();
  await done();
  check(
    snapshots.get(B).data.library.items.every((i) => i.id === "b-private") &&
      calls.slice(aCalls).every((c) => c.actor === B),
    "New account synchronization binds every request to its own account and uploads only its own library",
  );
  check(
    calls.every((c) => c.actor === A || c.actor === B),
    "All sync requests carry an explicit synthetic current-account header",
  );
  check(
    forbidden.length === 0,
    "No unrelated server mutation, provider or payment request was made",
  );
  check(errors.length === 0, "No browser runtime or hydration error occurred");
  return {
    status: "PASS",
    passed: passed.length,
    cases: passed,
    errors,
    syntheticSync: { requests: calls.length, appliedWrites, replayedWrites },
    forbiddenMutations: forbidden,
    externalOriginsBlocked: [...new Set(external)],
    fixture:
      "Real rendered SyncPanel/IndexedDB/localStorage in a disposable Edge profile; synthetic auth and in-memory HTTP snapshots. Not production backend, OAuth, physical device or educational efficacy validation.",
    screenshots: [
      "docs/v3/qa-sync-first-pair-desktop.png",
      "docs/v3/qa-sync-conflict-phone.png",
      "docs/v3/qa-sync-local-write-recovery.png",
      "docs/v3/qa-sync-offline-queue.png",
      "docs/v3/qa-sync-reconnected-desktop.png",
    ],
  };
}
