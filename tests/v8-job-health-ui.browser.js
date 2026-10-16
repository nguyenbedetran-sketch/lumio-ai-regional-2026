async (page) => {
  const cases = [],
    errors = [],
    calls = [],
    external = [];
  const check = (ok, name) => {
    if (!ok) throw Error(name);
    cases.push(name);
  };
  let denied = false,
    held = null,
    holdNext = false;
  const report = {
    scope: "stored-summary-job-metadata",
    generatedAt: "2026-10-16T14:00:00.000Z",
    retainedJobs: 7,
    statuses: {
      queued: 1,
      running: 1,
      retry_wait: 1,
      paused: 1,
      completed: 1,
      cancelled: 1,
      failed: 1,
    },
    eligiblePending: 2,
    readyNow: 1,
    delayedRetries: 1,
    expiredRetained: 0,
    revokedPending: 0,
    oldestEligibleWaitSeconds: 120,
    runningParts: 1,
    expiredRunningLeases: 1,
    missingRunningLeases: 0,
    nextRetryAt: "2026-10-16T14:01:00.000Z",
    backgroundJobsConfigured: true,
    recovery: "owner-access-driven",
  };
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    if (!/^http:\/\/localhost:3000\//.test(route.request().url()))
      external.push(route.request().url());
    return route.fulfill({ status: 404, body: "SYNTHETIC_FIXTURE_NO_NETWORK" });
  });
  for (const [url, file, contentType] of [
    ["**/__v8-job-health-ui", "fixture.html", "text/html"],
    ["**/__v8-job-health-ui.js", "fixture.js", "text/javascript"],
    ["**/__v8-job-health-ui.css", "fixture.css", "text/css"],
  ])
    await page.route(url, (route) =>
      route.fulfill({ path: "work/v8-job-health-ui/" + file, contentType }),
    );
  await page.route("**/api/admin/jobs", (route) => {
    calls.push({
      method: route.request().method(),
      account: route.request().headers()["x-lumio-account"],
    });
    if (holdNext) {
      holdNext = false;
      held = route;
      return;
    }
    return denied
      ? route.fulfill({ status: 403, json: { error: "FORBIDDEN" } })
      : route.fulfill({ json: report });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://localhost:3000/__v8-job-health-ui");
  const load = page.getByRole("button", {
    name: "Kiểm tra hàng đợi",
    exact: true,
  });
  await load.waitFor();
  check(
    calls.length === 0 && (await page.getByRole("table").count()) === 0,
    "Panel has no fabricated initial health or automatic polling",
  );
  await load.click();
  await page.getByRole("table").waitFor();
  check(
    (await page.locator("#root").textContent()).includes("7 tác vụ còn lưu"),
    "Stored count renders after explicit authorized read",
  );
  check(
    (await page.locator("#root").textContent()).includes("lease đã hết hạn: 1"),
    "Expired lease warning is tied to returned aggregate",
  );
  check(
    (await page.locator("#root").textContent()).includes(
      "không phải tín hiệu worker đang sống hay xác nhận backup",
    ),
    "UI distinguishes metadata snapshot from worker or backup health",
  );
  check(
    calls[0].method === "GET" && calls[0].account === "qa-health-a",
    "Health request is read-only and bound to the current account",
  );
  denied = true;
  await load.click();
  await page.getByRole("alert").waitFor();
  check(
    (await page.getByRole("table").count()) === 0 &&
      (await page.getByRole("alert").textContent()).includes("đăng nhập lại"),
    "Authorization loss clears previous report and requests reauthentication",
  );
  denied = false;
  await load.click();
  await page.getByRole("table").waitFor();
  await page.evaluate(() => window.__mountJobHealth("qa-health-b", false));
  await page.getByRole("table").waitFor({ state: "hidden" });
  check(
    (await page.getByRole("table").count()) === 0,
    "Changing account clears prior aggregate even without a keyed remount",
  );
  holdNext = true;
  await load.click();
  await page.waitForFunction(() =>
    document.querySelector("button")?.textContent.includes("Đang đọc"),
  );
  await page.evaluate(() => window.__mountJobHealth("qa-health-c", false));
  if (held) {
    try {
      await held.fulfill({ json: report });
    } catch {}
  }
  check(
    (await page.getByRole("table").count()) === 0,
    "Late response from prior account does not restore the previous report",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await load.click();
  await page.getByRole("table").waitFor();
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    "Queue-health table fits mobile width",
  );
  await page.screenshot({
    path: "docs/v8/qa-job-health-mobile.png",
    fullPage: true,
  });
  check(
    errors.length === 0 && external.length === 0,
    "No runtime errors or external requests in the isolated queue UI fixture",
  );
  return {
    status: "PASS",
    passed: cases.length,
    cases,
    errors,
    providerRequests: 0,
    scope:
      "Actual JobHealthPanel and application CSS; synthetic intercepted HTTP and account switches, no private queue or real admin data.",
  };
};
