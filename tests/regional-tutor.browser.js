// UI contracts only: all tutor/provider/session replies below are explicit synthetic fixtures.
// Real server unlock/auth/source ownership is exercised separately by tutor/server suites.
async (page) => {
  const account = "qa-regional-tutor-ui",
    userId = "qa-tutor-canonical-user",
    passed = [],
    errors = [],
    requests = [],
    gets = [],
    sessions = new Map();
  const check = (ok, label) => {
    if (!ok) throw new Error(label);
    passed.push(label);
  };
  let sequence = 0,
    failNext = false,
    expireNext = false,
    delayNext = false,
    pending = null,
    pendingReady = null,
    lateFinished = null;
  page.on("pageerror", (e) => errors.push(e.message));
  const source =
    "Hai vế của phương trình phải được biến đổi cùng cách.\n\nChỉ chia hai vế cho cùng một số khác không.";
  const refs = [
    {
      segmentId: "s2",
      quote: "Chỉ chia hai vế cho cùng một số khác không.",
      start: 55,
      end: 100,
      paragraph: 2,
      verification: "exact-excerpt",
    },
  ];
  const state = (session, guidance = "hints") => ({
    sessionId: session.id,
    hintCount: session.hints,
    requiredHints: 3,
    canUnlock: session.hints >= 3,
    guidance,
    revision: session.turns.length,
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  const summary = {
    title: "Fixture tóm tắt lớp văn bản",
    overview: "Giữ cân bằng hai vế và kiểm tra số chia.",
    keyPoints: ["Số chia khác không."],
    chapters: [
      {
        title: "Phép chia",
        summary: "Chỉ chia cùng một số khác không.",
        bullets: ["Kiểm tra số chia."],
        timestampKind: "none",
        references: refs,
      },
    ],
    mindMap: {
      nodes: [
        { id: "r", label: "Phương trình", detail: "" },
        { id: "d", label: "Phép chia", detail: "", chapterIndex: 0 },
      ],
      edges: [{ source: "r", target: "d" }],
    },
  };
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = request.url();
    if (
      /^https?:\/\//.test(url) &&
      !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//.test(url)
    )
      return route.abort();
    if (/\/api\//.test(url) && request.method() !== "GET")
      return route.fulfill({
        status: 409,
        json: { error: "SYNTHETIC_UI_NO_UNEXPECTED_WRITE" },
      });
    return route.continue();
  });
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        google: true,
        facebook: false,
        ai: true,
        capabilities: {
          tutor: true,
          summary: true,
          media: true,
          transcription: false,
          speech: false,
        },
      },
    }),
  );
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({
      json: {
        user: { name: "Synthetic tutor UI" },
        accountKey: account,
        userId,
        sessionVersion: 1,
        expires: "2099-01-01T00:00:00.000Z",
      },
    }),
  );
  await page.route("**/api/account", (r) =>
    r.fulfill({
      json: {
        authenticated: true,
        id: userId,
        name: "Synthetic tutor UI",
        isAdmin: false,
        identities: [],
        providers: { google: true, facebook: false },
      },
    }),
  );
  await page.route("**/api/tutor/session?**", async (route) => {
    const id = decodeURIComponent(
      route.request().url().split("sessionId=")[1] || "",
    );
    gets.push(id);
    if (expireNext) {
      expireNext = false;
      return route.fulfill({
        status: 410,
        json: { error: "TUTOR_SESSION_EXPIRED" },
      });
    }
    const session = sessions.get(id);
    return session
      ? route.fulfill({
          json: {
            ...state(session),
            problem: session.problem,
            turns: session.turns,
            retentionDays: 7,
          },
        })
      : route.fulfill({
          status: 404,
          json: { error: "TUTOR_SESSION_NOT_FOUND" },
        });
  });
  await page.route("**/api/ai", async (route) => {
    const body = route.request().postDataJSON();
    let wasDelayed = false;
    requests.push(body);
    if (failNext) {
      failNext = false;
      return route.fulfill({
        status: 502,
        json: { error: "PROVIDER_UNAVAILABLE" },
      });
    }
    if (delayNext) {
      delayNext = false;
      wasDelayed = true;
      await new Promise((resolve) => {
        pending = resolve;
        pendingReady?.();
      });
    }
    if (body.task === "summary")
      return route.fulfill({
        json: {
          text: "Synthetic UI summary",
          summary,
          quality: {
            status: "review-required",
            structuralChecks: true,
            citedItems: 1,
            totalItems: 1,
            issues: ["semantic-review"],
          },
        },
      });
    let session = body.tutorSessionId
      ? sessions.get(body.tutorSessionId)
      : null;
    if (!session) {
      const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
      session = {
        id,
        hints: 0,
        problem: body.tutorProblem || body.question,
        turns: [],
      };
      sessions.set(id, session);
    }
    if (body.guidance === "full" && session.hints < 3)
      return route.fulfill({
        status: 409,
        json: { error: "TUTOR_LOCKED", tutor: state(session) },
      });
    const full = body.guidance === "full";
    const answer = full
      ? "Fixture UI lời giải đầy đủ: số chia 2 khác 0; 2x=8 nên x=4. Kiểm tra 2·4+3=11."
      : [
          "Fixture UI gợi ý 1: giữ cân bằng hai vế khi bỏ hạng tử 3. Bạn sẽ làm cùng phép tính nào ở hai vế?",
          "Fixture UI gợi ý 2: hãy tính vế phải sau khi trừ 3. Em nhận được số nào?",
          "Fixture UI gợi ý 3: để bỏ hệ số 2, xét phép chia hai vế. Cần kiểm tra điều kiện gì của số chia?",
        ][Math.min(session.hints, 2)];
    const verification = full
      ? {
          status: "verified",
          equation: "2x+3=11",
          method: "Synthetic UI fixture, not an actual verifier run",
          conditions: ["2 ≠ 0"],
          complete: true,
          note: "Synthetic UI fixture",
        }
      : undefined;
    if (!full) session.hints++;
    session.turns.push({
      student: body.question,
      assistant: answer,
      guidance: full ? "full" : "hints",
      references: refs,
      verification,
      createdAt: new Date().toISOString(),
    });
    try {
      return await route.fulfill({
        json: {
          text: answer,
          tutor: state(session, full ? "full" : "hints"),
          references: refs,
          verification,
          quality: {
            status: "review-required",
            structuralChecks: true,
            citedItems: 1,
            totalItems: 1,
            issues: ["semantic-review"],
          },
        },
      });
    } catch {
      /* A cancelled UI request must not be forced into a new source. */
    } finally {
      if (wasDelayed) lateFinished?.();
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem("lumio-language", "vi");
    localStorage.setItem("lumio-theme", "light");
    localStorage.setItem("lumio-motion-v3", "off");
  });
  await page.reload();
  await page.evaluate(
    async ({ account, source, refs }) => {
      const now = new Date().toISOString(),
        base = {
          spaceId: "",
          createdAt: now,
          updatedAt: now,
          text: source,
          notes: "",
          cards: [],
          questions: [],
          attempts: [],
          favorite: false,
        };
      const evidence = {
        version: 1,
        kind: "pdf",
        filename: "synthetic-ui.pdf",
        digest: "0".repeat(64),
        proof: "0".repeat(64),
        units: [{ start: 0, end: source.length, page: 1 }],
      };
      const data = {
        version: 1,
        spaces: [],
        items: [
          {
            ...base,
            id: "qa-tutor-main",
            title: "Gia sư · minh chứng giao diện",
            kind: "text",
          },
          {
            ...base,
            id: "qa-extracted-pdf",
            title: "PDF đã trích · fixture UI",
            kind: "pdf",
            fileName: "synthetic-ui.pdf",
            blob: new Blob(["%PDF-1.4 Synthetic UI fixture"], {
              type: "application/pdf",
            }),
            sourceEvidence: evidence,
          },
          {
            ...base,
            id: "qa-unextracted-office",
            title: "DOCX chưa trích · fixture UI",
            kind: "text",
            text: "",
            fileName: "synthetic-ui.docx",
            blob: new Blob(["Synthetic fixture only"], {
              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            }),
          },
          {
            ...base,
            id: "qa-raw-image",
            title: "Ảnh gốc · fixture UI",
            kind: "image",
            text: "",
            fileName: "synthetic.png",
            blob: new Blob(
              [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
              { type: "image/png" },
            ),
          },
        ],
      };
      await new Promise((resolve, reject) => {
        const request = indexedDB.open("lumio-local-library-v2", 2);
        request.onupgradeneeded = () => {
          for (const name of ["libraries", "revisions"])
            if (!request.result.objectStoreNames.contains(name))
              request.result.createObjectStore(name);
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction(["libraries", "revisions"], "readwrite");
          tx.objectStore("libraries").put(data, account);
          tx.objectStore("revisions").put(1, account);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { account, source, refs },
  );
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .locator(".lm-profile")
    .filter({ hasText: "Synthetic tutor UI" })
    .waitFor();
  const openItem = async (title) => {
    await page.getByRole("button", { name: "Tìm nhanh", exact: true }).click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByRole("combobox").fill(title);
    await page.keyboard.press("Enter");
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("tab", { name: "Hỏi Lumio", exact: true }).click();
    await page.locator("[data-tutor-progress]").waitFor();
    await page.waitForFunction(
      () => !document.querySelector("[data-tutor-progress] button").disabled,
    );
  };
  const question = () => page.locator(".lm-composer textarea"),
    send = () => page.locator("[data-full-summary-generate]"),
    progress = () => page.locator("[data-tutor-progress]"),
    unlock = () => page.locator("[data-tutor-unlock]");
  const count = async (n) =>
    page.waitForFunction(
      (n) =>
        document
          .querySelector("[data-tutor-progress]")
          ?.getAttribute("data-hints") === String(n),
      n,
    );
  const ask = async (text) => {
    await question().fill(text);
    await send().click();
  };
  await openItem("Gia sư · minh chứng giao diện");
  check(await unlock().isDisabled(), "Full solution starts locked");
  check(
    (await page.locator('.lm-tutor-settings option[value="full"]').getAttribute("disabled")) !== null,
    "Full guidance option is disabled before server unlock",
  );
  check(
    (await page.locator('[data-outbound-disclosure="chat"]').count()) === 1,
    "Tutor shows an outbound-data disclosure before sending",
  );
  await ask("2x + 3 = 11");
  await count(1);
  const firstId = requests[0].tutorSessionId || [...sessions.keys()][0];
  check(
    requests[0].source === source && requests[0].history.length === 0,
    "Tutor sends only selected source and lets the server load canonical history",
  );
  check(
    requests[0].tutorProblem === "2x + 3 = 11",
    "First question creates a clearly bound exercise",
  );
  check(
    await unlock().isDisabled(),
    "One valid hint cannot unlock a full solution",
  );
  failNext = true;
  await ask("Mình chưa hiểu, hướng dẫn giúp mình.");
  await page.locator(".lm-error[role=alert]").waitFor();
  check(
    (await progress().getAttribute("data-hints")) === "1",
    "Failed provider response does not increase hint progress",
  );
  await page
    .locator(".lm-tutor-modes")
    .getByRole("button", { name: "Nhanh", exact: true })
    .click();
  await ask("Mình thử x=5, đúng chưa?");
  await count(2);
  check(
    requests.at(-1).mode === "quick" &&
      requests.at(-1).tutorSessionId === firstId,
    "Changing to Quick retains the same server tutor session",
  );
  check(
    requests.at(-1).guidance === "hints" && (await unlock().isDisabled()),
    "Quick mode cannot bypass the visible hint gate",
  );
  await page
    .locator(".lm-tutor-modes")
    .getByRole("button", { name: "Chuyên sâu", exact: true })
    .click();
  await ask("Mình trừ 3 ở cả hai vế, được 2x=8.");
  await count(3);
  check(
    await unlock().isEnabled(),
    "Three valid server hint turns enable the full-solution action",
  );
  await unlock().click();
  if ((await question().inputValue()) && (await send().isEnabled())) await send().click();
  await page.locator('[data-math-verification="verified"]').waitFor();
  check(
    requests.at(-1).guidance === "full" &&
      requests.at(-1).tutorSessionId === firstId,
    "Unlocked solution uses full guidance in the same exercise",
  );
  check(
    (await progress().getAttribute("data-hints")) === "3",
    "A full solution does not masquerade as another hint",
  );
  check(
    (await page
      .locator("[data-tutor-history] [data-source-references]")
      .count()) === 4,
    "Every displayed tutor reply keeps its source-reference panel",
  );
  await page.screenshot({
    path: "docs/regional/qa-tutor-unlocked-desktop.png",
    fullPage: true,
  });
  await page.reload();
  await openItem("Gia sư · minh chứng giao diện");
  await count(3);
  check(
    gets.includes(firstId),
    "Reload retrieves the saved session from the authenticated endpoint",
  );
  check(
    (await page
      .locator("[data-tutor-history] .lm-tutor-message.assistant")
      .count()) === 4,
    "Canonical conversation restores after reload",
  );
  check(
    (await page
      .locator(
        "[data-tutor-history] [data-source-references][data-reference-count='1']",
      )
      .count()) === 4,
    "Source references survive canonical-history restore",
  );
  check(
    (await page.locator('[data-math-verification="verified"]').count()) === 1,
    "Stored verification metadata survives reload",
  );
  await progress()
    .getByRole("button", { name: "Bài mới", exact: true })
    .click();
  check(
    (await progress().getAttribute("data-hints")) === "0" &&
      (await page.locator("[data-tutor-history]").count()) === 0,
    "New problem clears previous hints and visible conversation",
  );
  await ask("x + 1 = 3");
  await count(1);
  check(
    !requests.at(-1).tutorSessionId,
    "New problem does not reuse the previous server exercise id",
  );
  await page.getByRole("tab", { name: "Tài liệu gốc", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Văn bản gốc", exact: true })
    .fill(source + "\n\nNguồn được cập nhật cho bài mới.");
  await page.getByRole("tab", { name: "Hỏi Lumio", exact: true }).click();
  await count(0);
  check(
    (await page.locator("[data-tutor-history]").count()) === 0,
    "Changed source cannot restore an older exercise conversation",
  );
  await ask("3x = 12");
  await count(1);
  check(
    !requests.at(-1).tutorSessionId,
    "Changed source starts a new server exercise",
  );
  delayNext = true;
  const observed = new Promise((resolve) => {
    pendingReady = resolve;
  });
  const completedLate = new Promise((resolve) => {
    lateFinished = resolve;
  });
  await ask("Kiểm tra câu trả lời trong lúc mình đổi nguồn.");
  await observed;
  await page.waitForFunction(
    () => document.querySelector("[data-full-summary-generate]")?.disabled,
  );
  await page.getByRole("tab", { name: "Tài liệu gốc", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Văn bản gốc", exact: true })
    .fill(source + "\n\nMột nguồn khác sau khi hủy yêu cầu.");
  await page.getByRole("tab", { name: "Hỏi Lumio", exact: true }).click();
  await count(0);
  if (pending) {
    pending();
    pending = null;
  }
  await completedLate;
  check(
    (await page.locator("[data-tutor-history]").count()) === 0,
    "Late response after source change cannot populate the new exercise",
  );
  await ask("x + 2 = 5");
  await count(1);
  expireNext = true;
  await page.reload();
  await openItem("Gia sư · minh chứng giao diện");
  await count(0);
  check(
    (await page.locator("[data-tutor-history]").count()) === 0,
    "Expired server session does not revive stored conversation",
  );
  check(
    (await page.locator(".lm-ai-workbench").textContent()).includes(
      "Phiên trước không còn trên máy chủ",
    ),
    "Expired session gives a clear recovery message",
  );
  await openItem("PDF đã trích · fixture UI");
  await page
    .locator(".lm-task-switch")
    .getByRole("button", { name: "Tóm tắt", exact: true })
    .click();
  await send().click();
  await page.locator("[data-summary-coverage='whole']").waitFor();
  const pdfRequest = requests.at(-1);
  check(
    !pdfRequest.media &&
      pdfRequest.sourceEvidence?.kind === "pdf" &&
      pdfRequest.source === source,
    "Extracted PDF sends text with evidence and omits raw binary media",
  );
  const artifact = await page.evaluate(
    async (account) =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open("lumio-local-library-v2", 2);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("libraries", "readonly"),
            q = tx.objectStore("libraries").get(account);
          tx.oncomplete = () => {
            db.close();
            resolve(
              q.result.items
                .find((i) => i.id === "qa-extracted-pdf")
                .artifacts?.at(-1),
            );
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    account,
  );
  check(
    artifact?.source.kind === "text" &&
      artifact?.source.coverage?.method === "full-text",
    "Extracted PDF coverage is honestly labeled as supplied text, not complete visual media",
  );
  await openItem("DOCX chưa trích · fixture UI");
  await question().fill("Hãy đọc tài liệu này.");
  check(
    await send().isDisabled(),
    "Unextracted DOCX is blocked before unsupported binary AI upload",
  );
  check(
    (await page.locator(".lm-ai-workbench").textContent()).includes(
      "trích xuất văn bản",
    ),
    "Unextracted Office document explains how to prepare its source",
  );
  await openItem("Ảnh gốc · fixture UI");
  await question().fill("Đọc phần nhìn rõ trong ảnh.");
  const disclosure = page.locator('[data-outbound-disclosure="chat"]');
  await disclosure.locator("summary").click();
  check(
    (await disclosure.textContent()).includes("ảnh đã chọn"),
    "Raw-image disclosure includes the actual image attachment",
  );
  await send().click();
  await count(1);
  check(
    requests.at(-1).media?.mimeType === "image/png",
    "Raw image remains attached when no extracted text evidence exists",
  );
  const beforeBlobRestore = gets.length;
  await page.evaluate(async account=>new Promise((resolve,reject)=>{
    const r=indexedDB.open("lumio-local-library-v2",2);r.onsuccess=()=>{const db=r.result,tx=db.transaction(["libraries","revisions"],"readwrite"),q=tx.objectStore("libraries").get(account),v=tx.objectStore("revisions").get(account);q.onsuccess=()=>{const data=q.result,item=data.items.find(i=>i.id==="qa-raw-image");item.blob=new Blob([new Uint8Array([137,80,78,71,13,10,26,11])],{type:"image/png"});tx.objectStore("libraries").put(data,account);};v.onsuccess=()=>tx.objectStore("revisions").put(v.result+1,account);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};
  }),account);
  await page.reload();await openItem("Ảnh gốc · fixture UI");await count(0);
  check(await page.locator("[data-tutor-history]").count()===0&&gets.length===beforeBlobRestore,"Different raw media bytes with identical name, MIME and size cannot restore old exercise history");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2,
    ),
    "Tutor progress/history/disclosure fit the mobile viewport",
  );
  await page.screenshot({
    path: "docs/regional/qa-tutor-mobile.png",
    fullPage: true,
  });
  check(
    errors.length === 0,
    "No runtime errors in tutor unlock, restore, source-change and media-scope flows",
  );
  return {
    status: "PASS",
    checks: passed.length,
    passed,
    errors,
    mockedAIRequests: requests.length,
    mockedSessionGets: gets.length,
    paidProviderRequests: 0,
    data: "Explicit synthetic UI contract fixtures. Not real AI correctness, source signature, account security or student outcome evidence.",
    screenshots: [
      "docs/regional/qa-tutor-unlocked-desktop.png",
      "docs/regional/qa-tutor-mobile.png",
    ],
  };
}
