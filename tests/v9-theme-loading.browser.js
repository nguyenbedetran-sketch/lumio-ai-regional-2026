async (page) => {
  const checks = [],
    errors = [],
    unexpected = [],
    blocked = [];
  const check = (ok, name) => {
    if (!ok) throw Error(name);
    checks.push(name);
  };
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const q = new URLSearchParams(location.search),
      pref = q.get("pref");
    if (pref === null) return;
    localStorage.clear();
    if (pref !== "missing") localStorage.setItem("lumio-theme", pref);
    if (document.documentElement)
      document.documentElement.dataset.motion = q.get("motion") || "off";
    if (q.get("blocked") === "1")
      Storage.prototype.getItem = function () {
        throw new DOMException("Synthetic blocked storage", "SecurityError");
      };
  });
  await page.route("**/*", (r) => {
    const href = r.request().url(),
      pathname = href.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0];
    const files = {
      "/prepaint": ["prepaint.html", "text/html"],
      "/client": ["fixture.html", "text/html"],
      "/__v7-learner-ui.js": ["fixture.js", "text/javascript"],
      "/__v7-learner-ui.css": ["fixture.css", "text/css"],
    };
    if (href.startsWith("http://localhost:3000/") && files[pathname]) {
      const f = files[pathname];
      return r.fulfill({
        path: "work/v9-theme-loading-ui/" + f[0],
        contentType: f[1],
      });
    }
    if (pathname === "/blocked-hydration.js") {
      blocked.push(href);
      return r.abort();
    }
    if (pathname === "/brand/lumio-logo.png")
      return r.fulfill({
        path: "public/brand/lumio-logo.png",
        contentType: "image/png",
      });
    if (pathname === "/api/config")
      return r.fulfill({
        json: {
          google: false,
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
      });
    if (pathname.startsWith("/api/") && r.request().method() === "GET")
      return r.fulfill({
        status: 403,
        json: { error: "SYNTHETIC_GUEST_UNAVAILABLE" },
      });
    unexpected.push({ url: href, method: r.request().method() });
    return r.abort();
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  const scenarios = [
    ["light", "dark", "light", false],
    ["dark", "light", "dark", false],
    ["missing", "dark", "dark", false],
    ["missing", "light", "light", false],
    ["corrupt", "dark", "dark", false],
    ["missing", "light", "light", true],
  ];
  for (const [pref, system, expected, deny] of scenarios) {
    await page.emulateMedia({ colorScheme: system, reducedMotion: "reduce" });
    await page.goto(
      `http://localhost:3000/prepaint?pref=${pref}${deny ? "&blocked=1" : ""}`,
    );
    check(
      await page.evaluate(
        (v) => document.documentElement.dataset.theme === v,
        expected,
      ),
      `Before hydration: stored${pref}/system${system}${deny ? "/blocked-storage" : ""} resolves${expected}`,
    );
    check(
      await page.evaluate(
        (v) => window.__themeBeforeHydration === v && !window.__hydrationRan,
        expected,
      ),
      "First body script sees resolved theme while hydration bundle is blocked",
    );
    check(
      await page.evaluate(
        (v) =>
          getComputedStyle(document.body).backgroundColor ===
          (v === "dark" ? "rgb(16, 25, 22)" : "rgb(241, 245, 238)"),
        expected,
      ),
      "Prepaint effective canvas matches the resolved theme",
    );
    if (!deny)
      check(
        await page.evaluate(
          (v) =>
            localStorage.getItem("lumio-theme") ===
            (v === "missing" ? null : v),
          pref,
        ),
        "Bootstrap does not overwrite the stored preference",
      );
  }
  check(
    blocked.length === scenarios.length,
    "Every prepaint case blocked the hydration request",
  );
  check(
    (await page
      .locator('[data-loading-skeleton][aria-busy="true"]')
      .count()) === 1,
    "Server loading shell marks the actual waiting region busy",
  );
  check(
    (await page.getByRole("status").count()) === 1,
    "Loading has one polite status message",
  );
  check(
    (await page.getByRole("status").innerText()) === "Đang mở không gian học…",
    "SSR fixture preserves Vietnamese text with the framework-equivalent UTF8 declaration",
  );
  check(
    (await page.locator('[role="progressbar"],[aria-valuenow]').count()) === 0,
    "Skeleton makes no percentage or completion claim",
  );
  check(
    !(await page.locator("[data-loading-skeleton]").innerText()).match(
      /\d+\s*%/,
    ),
    "No fabricated progress percentage",
  );
  check(
    (await page
      .locator('[data-loading-skeleton] [aria-hidden="true"]')
      .count()) === 1,
    "Placeholder geometry is hidden from assistive technology",
  );
  await page.emulateMedia({
    colorScheme: "dark",
    reducedMotion: "no-preference",
  });
  await page.goto("http://localhost:3000/prepaint?pref=dark&motion=full");
  check(
    await page
      .locator("[data-loading-skeleton] i")
      .first()
      .evaluate((n) => getComputedStyle(n).animationName !== "none"),
    "Only known full motion may pulse real waiting placeholders",
  );
  for (const modeof of ["off", "subtle"]) {
    await page.evaluate(
      (m) => (document.documentElement.dataset.motion = m),
      modeof,
    );
    check(
      await page
        .locator("[data-loading-skeleton] i")
        .first()
        .evaluate((n) => getComputedStyle(n).animationName === "none"),
      `Skeleton respects user${modeof} setting`,
    );
  }
  await page.evaluate(() => (document.documentElement.dataset.motion = "full"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  check(
    await page
      .locator("[data-loading-skeleton] i")
      .first()
      .evaluate((n) => getComputedStyle(n).animationName === "none"),
    "Skeleton respects OS reduced motion",
  );
  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Actual loading shell fits${width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/v9/qa-loading-mobile.png",
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("http://localhost:3000/client?pref=missing");
  await page.waitForFunction(() => window.__v9LibraryReads?.length > 0);
  check(
    (await page.locator("[data-loading-skeleton]").count()) === 1,
    "Actual LumioApp shows the shared shell while library Promise is pending",
  );
  check(
    await page.evaluate(
      () =>
        document.documentElement.dataset.theme === "dark" &&
        localStorage.getItem("lumio-theme") === "system",
    ),
    "Missing preference stays system after client initialization",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  check(
    await page.evaluate(() => localStorage.getItem("lumio-theme") === "system"),
    "Changing system theme updates the live client without making it explicit",
  );
  await page.evaluate(() => window.__v9FinishLibrary(true));
  await page.locator(".lm-sidebar").waitFor({ state: "attached" });
  check(
    (await page.locator("[data-loading-skeleton]").count()) === 0,
    "Real readiness replaces skeleton with the workspace",
  );
  await page.goto("http://localhost:3000/client?pref=dark");
  await page.waitForFunction(() => window.__v9LibraryReads?.length > 0);
  check(
    await page.evaluate(
      () =>
        document.documentElement.dataset.theme === "dark" &&
        localStorage.getItem("lumio-theme") === "dark",
    ),
    "Explicit dark preference survives client initialization on light system",
  );
  await page.evaluate(() => window.__v9FinishLibrary(false));
  await page.getByRole("alert").waitFor();
  check(
    (await page.locator("[data-loading-skeleton]").count()) === 0,
    "Library error is not disguised as indefinite loading",
  );
  const retry = page.getByRole("button", { name: "Làm lại", exact: true });
  check(
    await retry.isVisible(),
    "Existing read error keeps its explicit Retry control",
  );
  await Promise.all([page.waitForEvent("framenavigated"), retry.click()]);
  await page.waitForFunction(() => window.__v9LibraryReads?.length > 0);
  check(
    (await page.locator("[data-loading-skeleton]").count()) === 1,
    "Retry starts a new real read and shows waiting shell",
  );
  await page.evaluate(() => window.__v9FinishLibrary(true));
  await page.locator(".lm-sidebar").waitFor({ state: "attached" });
  check(errors.length === 0, "No browser runtime errors");
  check(unexpected.length === 0, "No unhandled or paid/external requests");
  return {
    status: "PASS",
    passed: checks.length,
    checks,
    errors,
    unexpected,
    blockedHydrationCases: blocked.length,
    scope:
      "Actual Layout+Skeleton static SSR before blocked hydration and actual LumioApp React with a held/rejected test-only library read; intercepted guest HTTP. No real OAuth, private data, provider calls or public/physical-device claim",
  };
};
