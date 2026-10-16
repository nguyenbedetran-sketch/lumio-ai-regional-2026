// Actual component/CSS; account keys, outcomes and provider-attempt metadata are
// authored synthetic fixtures. Every network request is intercepted locally.
async (page) => {
  const cases = [],
    errors = [],
    requests = [],
    layouts = [],
    plans = [];
  const check = (value, label) => {
    if (!value) throw Error(label);
    cases.push(label);
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const params = (url) =>
    Object.fromEntries(
      url
        .split("?")[1]
        .split("&")
        .map((part) => part.split("=")),
    );
  const outcomeAggregate = {
    requests: 2,
    errors: 1,
    inputTokens: null,
    outputTokens: 0,
    tokenRecords: 0,
    recordedEstimatedCostUsd: null,
    costRecords: 0,
    unpricedRequests: 2,
    averageLatencyMs: 1200,
  };
  const outcome = (key = "qa-private-outcome-a") => ({
    scope: "recorded-request-outcomes",
    dimension: "model",
    days: 7,
    from: "2026-10-10T00:00:00.000Z",
    through: "2026-10-17T00:00:00.000Z",
    totals: clone(outcomeAggregate),
    groups: [{ ...clone(outcomeAggregate), key, provider: "qa-provider" }],
    truncated: false,
    limitations: [
      "SYNTHETIC · Recorded request outcomes are not attempt or credit totals.",
    ],
  });
  const unknown = {
    attempts: 5,
    responses: 2,
    unresolved: 1,
    transportUnknown: 2,
    httpErrors: 1,
    inputTokens: null,
    outputTokens: null,
    inputTokenRecords: 0,
    outputTokenRecords: 0,
    totalTokens: null,
    totalTokenRecords: 0,
    responseModelRecords: 1,
    changedModelRecords: 1,
    averageLatencyMs: 1200,
    estimatedCostUsd: null,
    unpricedAttempts: 5,
  };
  const zero = {
    attempts: 2,
    responses: 2,
    unresolved: 0,
    transportUnknown: 0,
    httpErrors: 0,
    inputTokens: 0,
    outputTokens: 0,
    inputTokenRecords: 2,
    outputTokenRecords: 2,
    totalTokens: 0,
    totalTokenRecords: 2,
    responseModelRecords: 2,
    changedModelRecords: 0,
    averageLatencyMs: 0,
    estimatedCostUsd: null,
    unpricedAttempts: 2,
  };
  const attempts = (key = "qa-private-attempt-a") => ({
    scope: "recorded-text-provider-attempts",
    dimension: "model",
    days: 7,
    from: "2026-10-10T00:00:00.000Z",
    through: "2026-10-17T00:00:00.000Z",
    firstRetainedAttemptAt: "2026-09-01T01:02:03.000Z",
    retainedAllAges: { attempts: 9, unresolved: 3, unresolvedOutsideWindow: 2 },
    limits: { total: 100000, unresolvedGlobal: 2048, unresolvedPerAccount: 64 },
    totals: {
      ...clone(unknown),
      attempts: 7,
      responses: 4,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      inputTokenRecords: 2,
      outputTokenRecords: 2,
      totalTokenRecords: 2,
      responseModelRecords: 3,
      unpricedAttempts: 7,
    },
    groups: [
      { ...clone(unknown), key, provider: "qa-provider" },
      {
        ...clone(zero),
        key: "qa-observed-zero-" + "long-model-key-".repeat(12),
        provider: "qa-provider",
      },
    ],
    truncated: false,
    limitations: [
      "SYNTHETIC · Provider receipt, unknown costs and coverage are not an invoice or credit ledger.",
    ],
  });
  function hold(json, status = 200) {
    let release;
    const wait = new Promise((resolve) => {
      release = resolve;
    });
    plans.push({ json, status, wait });
    return release;
  }
  function respond(json, status = 200) {
    plans.push({ json, status });
  }
  const body = () => page.locator("main"),
    button = () =>
      page.getByRole("button", { name: "Xem báo cáo", exact: true }),
    summary = () => page.locator("main details > summary").first();
  async function load(json) {
    if (json) respond(json);
    const previous = requests.length;
    await button().click();
    await page.waitForFunction(
      (n) => window.__usageRequests.length > n,
      previous,
    );
  }
  async function known(text) {
    await body().getByText(text, { exact: true }).waitFor();
  }
  async function absent(text) {
    check(
      !(await body().innerText()).includes(text),
      "Private result is absent: " + text,
    );
  }
  async function layout(width, screenshot) {
    await page.setViewportSize({ width, height: 1000 });
    const measured = await page.evaluate(() => ({
      width: window.innerWidth,
      pageScroll: document.documentElement.scrollWidth,
      pageClient: document.documentElement.clientWidth,
      main: document.querySelector("main").getBoundingClientRect().width,
      controls: [...document.querySelectorAll("main select, main button")].map(
        (node) => {
          const box = node.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            width: box.width,
            label: node.closest("label")?.innerText || node.textContent,
          };
        },
      ),
      tables: [...document.querySelectorAll("main .ad-table-scroll")].map(
        (node) => ({
          width: node.clientWidth,
          scroll: node.scrollWidth,
          overflowX: getComputedStyle(node).overflowX,
        }),
      ),
      rowHeaders: [
        ...document.querySelectorAll('main tbody th[scope="row"]'),
      ].map((node) => {
        const code = node.querySelector("code"),
          style = getComputedStyle(code),
          cellStyle = getComputedStyle(node),
          cell = node.getBoundingClientRect(),
          canvas = document.createElement("canvas"),
          context = canvas.getContext("2d");
        context.font = style.font;
        const range = document.createRange();
        range.selectNodeContents(code);
        const lines = [...range.getClientRects()];
        return {
          text: code.textContent,
          cellWidth: cell.width,
          innerWidth:
            cell.width -
            parseFloat(cellStyle.paddingLeft) -
            parseFloat(cellStyle.paddingRight),
          unwrappedTextWidth: context.measureText(code.textContent).width,
          lineCount: lines.length,
          linesInsideCell: lines.every(
            (line) => line.left >= cell.left && line.right <= cell.right,
          ),
        };
      }),
    }));
    layouts.push(measured);
    check(
      measured.pageScroll <= measured.pageClient + 1,
      `No horizontal page overflow at ${width}px`,
    );
    check(
      measured.controls.every(
        (node) => node.left >= -1 && node.right <= width + 1,
      ),
      `All filter controls stay inside ${width}px viewport`,
    );
    check(
      measured.tables.every(
        (node) =>
          node.scroll <= node.width + 1 ||
          ["auto", "scroll"].includes(node.overflowX),
      ),
      `Wide metadata table remains in its own scroll region at ${width}px`,
    );
    check(
      measured.rowHeaders[0].innerWidth >=
        measured.rowHeaders[0].unwrappedTextWidth - 1,
      `A normal model identifier fits its row header without a narrow column of fragments at ${width}px`,
    );
    const longHeader = measured.rowHeaders[1];
    check(
      longHeader.innerWidth < longHeader.unwrappedTextWidth &&
        longHeader.lineCount > 1 &&
        longHeader.linesInsideCell,
      `The complete long identifier wraps inside a bounded row header at ${width}px`,
    );
    await page.screenshot({ path: screenshot, fullPage: true });
  }
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.route("**/*", (route) =>
      route.fulfill({
        status: 409,
        json: { error: "SYNTHETIC_USAGE_NO_EXTERNAL_API" },
      }),
    );
    for (const [url, file, contentType] of [
      ["**/__v7-usage-ui", "fixture.html", "text/html"],
      ["**/__v7-usage-ui.js", "fixture.js", "text/javascript"],
      ["**/__v7-usage-ui.css", "fixture.css", "text/css"],
    ])
      await page.route(url, (route) =>
        route.fulfill({ path: "work/v7-usage-ui/" + file, contentType }),
      );
    await page.route("**/api/admin/usage**", async (route) => {
      const req = route.request(),
        plan = plans.shift();
      requests.push({
        url: req.url(),
        method: req.method(),
        account: req.headers()["x-lumio-account"],
      });
      if (!plan)
        return route.fulfill({
          status: 409,
          json: { error: "UNPLANNED_SYNTHETIC_REQUEST" },
        });
      if (plan.wait) await plan.wait;
      return route.fulfill({ status: plan.status ?? 200, json: plan.json });
    });
    await page.addInitScript(() => {
      const actual = window.fetch;
      window.__usageRequests = [];
      window.fetch = (input, init) => {
        const record = {
          url: String(input),
          cache: init?.cache,
          aborted: !!init?.signal?.aborted,
        };
        window.__usageRequests.push(record);
        init?.signal?.addEventListener("abort", () => {
          record.aborted = true;
        });
        // Deliberately simulate a transport which ignores AbortSignal. The
        // component must still discard late results using its generation guard.
        return actual(input, { ...init, signal: undefined }).then(
          (response) => {
            record.finished = true;
            return response;
          },
        );
      };
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://localhost:3000/__v7-usage-ui");
    await summary().waitFor();
    check(
      !(await page.locator("main details").evaluate((node) => node.open)),
      "Usage details are closed on initial mount",
    );
    check(
      requests.length === 0,
      "Initial mount does not fetch private telemetry",
    );
    await summary().focus();
    await page.keyboard.press("Enter");
    check(
      await page.locator("main details").evaluate((node) => node.open),
      "Native summary opens with keyboard Enter",
    );
    check(
      requests.length === 0,
      "Opening the disclosure does not fetch private telemetry",
    );
    for (const label of ["Loại báo cáo", "Nhóm theo", "Khoảng thời gian"])
      check(
        (await page.getByLabel(label).count()) === 1,
        `Filter has accessible label: ${label}`,
      );
    check(
      (await page.getByLabel("Loại báo cáo").inputValue()) === "outcomes",
      "Recorded request outcomes are the initial separate scope",
    );
    await page.getByLabel("Nhóm theo").focus();
    await page.keyboard.press("Tab");
    check(
      await page
        .getByLabel("Khoảng thời gian")
        .evaluate((node) => node === document.activeElement),
      "Keyboard Tab reaches the date-window filter",
    );
    await page.keyboard.press("Tab");
    check(
      await button().evaluate((node) => node === document.activeElement),
      "Keyboard Tab reaches the explicit load button",
    );
    respond(outcome());
    await page.keyboard.press("Enter");
    await known("qa-private-outcome-a");
    check(
      requests.length === 1 && requests[0].method === "GET",
      "Keyboard form submission performs one explicit GET",
    );
    check(
      requests[0].account === "qa-usage-a",
      "Explicit request uses canonical X-Lumio-Account header",
    );
    const firstQuery = params(requests[0].url);
    check(
      firstQuery.summary === "1" &&
        firstQuery.scope === "outcomes" &&
        firstQuery.dimension === "model" &&
        firstQuery.days === "7",
      "Outcome request binds summary, scope, dimension and days",
    );
    check(
      (await body().innerText()).includes("Chưa đo"),
      "Unknown outcome cost is shown as unmeasured",
    );
    await page.getByLabel("Loại báo cáo").selectOption("attempts");
    await absent("qa-private-outcome-a");
    check(
      requests.length === 1,
      "Changing report scope clears old private data without automatically fetching",
    );
    await load(attempts());
    await known("qa-private-attempt-a");
    check(
      params(requests[1].url).scope === "attempts",
      "Provider-attempt request uses a separate scope",
    );
    const attemptText = await body().innerText();
    const diagnosticText = await page
        .locator('main [aria-live="polite"] > p')
        .nth(0)
        .innerText(),
      windowText = await page
        .locator('main [aria-live="polite"] > p')
        .nth(1)
        .innerText();
    check(
      diagnosticText.includes("3 lượt chưa rõ kết quả") &&
        diagnosticText.includes("2 lượt ngoài khoảng đang xem"),
      "Older unresolved journal intents remain visible outside the selected time window",
    );
    check(
      diagnosticText.includes("64 lượt/tài khoản") &&
        diagnosticText.includes("2.048 lượt toàn hệ thống"),
      "All-age journal diagnostics label per-account and global unresolved limits separately",
    );
    check(
      /Đang lưu\s+9\s*\/\s*100\.000 bản ghi/.test(diagnosticText),
      "Retained all-age journal count has its own storage-capacity denominator",
    );
    check(
      windowText.includes("7 lượt chuẩn bị gọi") &&
        windowText.includes("1 lượt chưa có kết quả ghi nhận"),
      "Selected-window attempt and unresolved totals remain seven and one, not all-age nine and three",
    );
    check(
      /tổng.*chỉ tính khoảng thời gian đã chọn/.test(diagnosticText),
      "The capacity paragraph explicitly distinguishes the selected-window table cohort",
    );
    check(
      /đạt giới hạn sẽ chặn lượt gọi mới/.test(diagnosticText),
      "Journal capacity is disclosed as a dispatch limit rather than credit usage",
    );
    check(
      /lượt.*(?:gọi|chuẩn bị)|dispatch|lần chuẩn bị/i.test(attemptText),
      "Attempt report labels dispatch counts separately from request outcomes",
    );
    check(
      /không.*(?:câu trả lời|đáp án).*(?:hợp lệ|đúng)|không.*(?:hợp lệ|đúng).*(?:câu trả lời|đáp án)/is.test(
        attemptText,
      ),
      "Attempt report explains that an HTTP response is not a valid answer",
    );
    check(
      /không.*(?:credit|tín dụng)|credit.*riêng|sổ.*credit/is.test(attemptText),
      "Attempt report distinguishes independent credit accounting",
    );
    check(
      /bản ghi.*(?:đầu|sớm)|dòng.*đầu|lượt.*đầu/i.test(attemptText) &&
        /không.*(?:bật|kích hoạt|bắt đầu thu thập)/is.test(attemptText),
      "First retained metadata is not presented as instrumentation activation date",
    );
    const rows = page.locator("main tbody tr"),
      unknownText = await rows.nth(0).innerText(),
      zeroText = await rows.nth(1).innerText();
    check(
      unknownText.includes("— vào / — ra") &&
        unknownText.includes("tổng token đã báo —"),
      "Unknown input, output and total token values retain dashes",
    );
    check(
      zeroText.includes("0 vào / 0 ra") &&
        zeroText.includes("tổng token đã báo 0"),
      "Explicitly observed zero input, output and total tokens remain zero",
    );
    check(
      /chi phí.*chưa.*biết.*không phải 0/is.test(attemptText),
      "All unpriced attempt costs are explicitly unknown, not zero",
    );
    check(
      !attemptText.includes("$0.00"),
      "Unknown attempt costs are not formatted as zero dollars",
    );
    check(
      (await rows.count()) === 2,
      "Attempt table contains only its own groups, without merging outcome rows",
    );
    check(
      (await page.getByRole("columnheader").count()) === 6 &&
        (await page.getByRole("rowheader").count()) === 2,
      "Attempt table exposes six column headers and its two group row headers",
    );
    const separated = await page
      .locator("main tbody tr")
      .first()
      .locator("td")
      .first()
      .evaluate((cell) => {
        const note = cell.querySelector("small"),
          range = document.createRange();
        range.setStart(cell, 0);
        range.setEndBefore(note);
        const base = range.getBoundingClientRect(),
          extra = note.getBoundingClientRect();
        return {
          baseText: range.toString().trim(),
          noteText: note.textContent,
          noteDisplay: getComputedStyle(note).display,
          baseBottom: base.bottom,
          noteTop: extra.top,
        };
      });
    check(
      separated.baseText === "5 / 2" &&
        separated.noteText.startsWith("1 phản hồi lỗi HTTP"),
      "Main 5 / 2 counts and one HTTP error remain distinct text units",
    );
    check(
      separated.noteDisplay === "block" &&
        separated.noteTop >= separated.baseBottom,
      "HTTP error detail occupies a separate visual line instead of reading as 5 / 21",
    );
    check(
      await page
        .locator("main .ad-table small")
        .evaluateAll((nodes) =>
          nodes.every((node) => getComputedStyle(node).display === "block"),
        ),
      "Token coverage, unknown status and model details render as separate lines",
    );
    await layout(1440, "docs/v7/qa-usage-attempts-desktop.png");
    await layout(768, "docs/v7/qa-usage-attempts-tablet.png");
    await layout(390, "docs/v7/qa-usage-attempts-mobile.png");
    check(
      requests.length === 2,
      "Viewport changes do not trigger telemetry requests",
    );

    const releaseStale = hold(attempts("qa-stale-result"));
    await load();
    await page
      .getByRole("button", { name: "Đang tải…", exact: true })
      .waitFor();
    check(
      await page
        .getByRole("button", { name: "Đang tải…", exact: true })
        .isDisabled(),
      "A pending load disables repeat form submission",
    );
    check(
      (await page
        .locator('main [aria-live="polite"]')
        .getAttribute("aria-busy")) === "true",
      "Loading state exposes a polite busy region",
    );
    await absent("qa-private-attempt-a");
    await page.getByLabel("Nhóm theo").selectOption("task");
    check(
      await page.evaluate(() => window.__usageRequests[2].aborted),
      "Changing grouping aborts the previous request signal",
    );
    check(
      requests.length === 3,
      "Filter change does not dispatch an automatic replacement",
    );
    const fresh = attempts("qa-fresh-task-result");
    fresh.dimension = "task";
    await load(fresh);
    await known("qa-fresh-task-result");
    releaseStale();
    await page.waitForFunction(() => window.__usageRequests[2].finished);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await known("qa-fresh-task-result");
    check(
      params(requests[3].url).dimension === "task",
      "New explicit load uses the changed grouping",
    );
    await absent("qa-stale-result");
    await page.getByLabel("Khoảng thời gian").selectOption("31");
    await absent("qa-fresh-task-result");
    check(
      requests.length === 4,
      "Window change clears current report without auto fetch",
    );
    const latest = attempts("qa-private-before-denial");
    latest.dimension = "task";
    latest.days = 31;
    await load(latest);
    await known("qa-private-before-denial");
    check(
      params(requests[4].url).days === "31",
      "Explicit request uses the selected 31-day window",
    );
    const releaseDenied = hold({ error: "SYNTHETIC_UNAUTHORIZED" }, 401);
    await load();
    await absent("qa-private-before-denial");
    releaseDenied();
    await page.getByRole("alert").waitFor();
    check(
      (await page.getByRole("alert").innerText()).includes("Quyền"),
      "401 displays an explicit permission error",
    );
    check(
      (await page.locator("main tbody tr").count()) === 0,
      "401 leaves no old private table result",
    );
    const releaseAccount = hold(attempts("qa-other-account-stale"));
    await load();
    await page.evaluate(() => window.__mountUsage("qa-usage-b"));
    await page.waitForFunction(
      () => !document.querySelector("main details").open,
    );
    check(
      (await page.getByRole("alert").count()) === 0,
      "Account remount clears prior error state",
    );
    check(
      (await page.locator("main tbody tr").count()) === 0,
      "Account remount clears old private result",
    );
    check(
      await page.evaluate(() => window.__usageRequests[6].aborted),
      "Account remount aborts the old account request",
    );
    releaseAccount();
    await page.waitForFunction(() => window.__usageRequests[6].finished);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await summary().click();
    const next = outcome("qa-private-outcome-b");
    await load(next);
    await known("qa-private-outcome-b");
    check(
      requests[7].account === "qa-usage-b",
      "Remounted panel sends only the new canonical account key",
    );
    await absent("qa-other-account-stale");
    respond({ error: "SYNTHETIC_SERVER_ERROR" }, 500);
    await load();
    await page.getByRole("alert").waitFor();
    check(
      (await page.locator("main tbody tr").count()) === 0,
      "An unplanned/error HTTP response does not retain prior account metadata",
    );
    const empty = outcome();
    empty.groups = [];
    empty.totals = {
      ...clone(outcomeAggregate),
      requests: 0,
      errors: 0,
      outputTokens: null,
      unpricedRequests: 0,
      averageLatencyMs: null,
    };
    await load(empty);
    await body()
      .getByText("Chưa có dữ liệu trong khoảng thời gian này.", { exact: true })
      .waitFor();
    check(
      (await page.getByRole("alert").count()) === 0,
      "Explicit retry clears prior request error and renders empty data state",
    );
    await load(attempts("qa-wrong-scope-private"));
    await page.getByRole("alert").waitFor();
    check(
      (await page.getByRole("alert").innerText()).includes("không khớp"),
      "A report with the wrong scope is rejected rather than mixed with outcomes",
    );
    await absent("qa-wrong-scope-private");
    respond({ error: "SYNTHETIC_FORBIDDEN" }, 403);
    await load();
    await page.getByRole("alert").waitFor();
    check(
      (await page.getByRole("alert").innerText()).includes("Quyền"),
      "403 displays the same explicit permission recovery state",
    );
    check(
      requests.every((request) =>
        ["qa-usage-a", "qa-usage-b"].includes(request.account),
      ),
      "Every intercepted report request carries an intended canonical synthetic account",
    );
    check(
      requests.every((request) => request.method === "GET"),
      "Panel performs no telemetry or billing mutations",
    );
    check(
      await page.evaluate(() =>
        window.__usageRequests.every((request) => request.cache === "no-store"),
      ),
      "Every report load explicitly bypasses the browser request cache",
    );
    check(
      errors.length === 0,
      "No React runtime error across scope, transport race, denial, account remount and empty state",
    );
    return {
      status: "PASS",
      passed: cases.length,
      cases,
      errors,
      layouts,
      numberSeparation: separated,
      interceptedReportRequests: requests.length,
      paidProviderRequests: 0,
      actualAccounts: 0,
      actualProviderCosts: 0,
      screenshots: [
        "docs/v7/qa-usage-attempts-desktop.png",
        "docs/v7/qa-usage-attempts-tablet.png",
        "docs/v7/qa-usage-attempts-mobile.png",
      ],
      scope:
        "Actual isolated admin component and CSS with synthetic HTTP, including a transport deliberately ignoring abort. This is scoped browser/keyboard/layout acceptance, not backend authorization, real telemetry accuracy or whole-app WCAG/device validation.",
    };
  } catch (error) {
    await page.screenshot({
      path: "docs/v7/qa-usage-current-failure.png",
      fullPage: true,
    });
    return {
      status: "FAIL",
      passed: cases.length,
      cases,
      errors,
      error: error.message,
      snapshot: (await page.locator("body").innerText()).slice(-7000),
    };
  }
};
