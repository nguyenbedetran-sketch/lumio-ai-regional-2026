async (page) => {
  const cases = [],
    errors = [],
    unexpected = [],
    calls = [],
    screenshots = [],
    layouts = [];
  let failure = "PRICE_NOT_CONFIGURED",
    hold = false,
    release;
  const check = (value, name) => {
    if (!value) throw Error(name);
    cases.push(name);
  };
  const folder = "docs/next/reports/billing-modal/";
  try {
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", async (route) => {
      const request = route.request(),
        pathname = request
          .url()
          .replace(/^https?:\/\/[^/]+/, "")
          .split("?")[0];
      if (pathname === "/__paid")
        return route.fulfill({
          path: "work/billing-modal-ui/fixture.html",
          contentType: "text/html",
        });
      if (pathname === "/__paid.js")
        return route.fulfill({
          path: "work/billing-modal-ui/fixture.js",
          contentType: "text/javascript",
        });
      if (pathname === "/__paid.css")
        return route.fulfill({
          path: "work/billing-modal-ui/fixture.css",
          contentType: "text/css",
        });
      if (pathname === "/api/billing/checkout") {
        calls.push({
          method: request.method(),
          path: pathname,
          body: request.postDataJSON(),
        });
        if (hold) await new Promise((resolve) => (release = resolve));
        return route
          .fulfill({ status: 503, json: { error: failure } })
          .catch(() => {});
      }
      if (pathname === "/api/billing/catalog" || pathname === "/api/billing") {
        calls.push({ method: request.method(), path: pathname });
        const catalog = await page.evaluate(() => ({
          plans: ["free", "plus", "premium", "pro"].map((id) => {
            const paid = ["premium", "pro"].includes(id),
              config = paid ? window.__policyDefaults(id) : null;
            return {
              id,
              name: id[0].toUpperCase() + id.slice(1),
              monthlyPriceMinor: id === "free" ? 0 : null,
              yearlyPriceMinor: id === "free" ? 0 : null,
              credits: id === "free" ? 200 : null,
              creditsPeriod: id === "free" ? "one_time_trial" : "month",
              checkoutAvailable: false,
              entitlements: paid
                ? {
                    modes: config.allowedModes,
                    kinds: config.allowedKinds,
                    voice: config.voice,
                    maxVideoSeconds: config.maxVideoSeconds,
                  }
                : {
                    modes:
                      id === "plus"
                        ? ["quick", "tutor", "think"]
                        : ["quick", "tutor"],
                    kinds: ["text"],
                    voice: false,
                    maxVideoSeconds: 600,
                  },
              ...(paid
                ? { paidPolicy: { planId: id, revision: 0, config } }
                : {}),
            };
          }),
          packs: [],
          rates: {
            tasks: { chat: 2 },
            modes: { quick: 0, tutor: 1, think: 3, deep: 6 },
            kinds: { text: 0 },
            videoPerMinute: 2,
          },
          trialCredits: 200,
        }));
        return route.fulfill({
          json: pathname.endsWith("catalog")
            ? catalog
            : {
                catalog,
                account: {
                  userId: "synthetic-billing-user",
                  planId: "free",
                  planName: "Free",
                  planSource: "trial",
                  balance: 200,
                  reserved: 0,
                  periodEnd: null,
                  cancelAtPeriodEnd: false,
                  nextPlanId: null,
                },
                history: [],
                sandbox: false,
              },
        });
      }
      unexpected.push(pathname);
      return route.fulfill({ status: 409, body: "FIXTURE_NETWORK_BLOCKED" });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://billing.fixture.test/__paid");
    await page.locator(".lm-plan").first().waitFor();
    await page.evaluate(() => window.__billingMount("vi", true));
    await page.locator(".lm-billing-wallet strong").first().waitFor();
    const trigger = page
      .locator(".lm-plan")
      .filter({ has: page.getByRole("heading", { name: "Pro", exact: true }) })
      .getByRole("button");
    check(
      (await page.locator(".lm-plan").nth(0).innerText()).includes("200") &&
        (await page.locator(".lm-plan").nth(1).innerText()).includes("59.000"),
      "Free/Plus proposal prices and credits are preserved",
    );
    await trigger.click();
    let dialog = page.locator("dialog.lm-billing-dialog[open]");
    await dialog.waitFor();
    check(
      await dialog.evaluate(
        (el) => el.parentElement === document.body && el.matches(":modal"),
      ),
      "Actual billing dialog is a native modal portaled above the transformed learner shell",
    );
    const detail = dialog.locator("[data-paid-plan-details=pro]");
    await detail.locator("summary").click();
    await detail.getByLabel("Số ký tự nguồn", { exact: true }).fill("12001");
    check(
      (await detail.locator("output").innerText()).includes("credits"),
      "Real ephemeral calculator remains usable inside the review",
    );
    for (const theme of ["light", "dark"])
      for (const width of [1440, 390, 320]) {
        const height = width === 1440 ? 900 : 640;
        await page.evaluate(
          (theme) => (document.documentElement.dataset.theme = theme),
          theme,
        );
        await page.setViewportSize({ width, height });
        const body = dialog.locator(".lm-billing-dialog-body");
        await body.evaluate((el) => (el.scrollTop = 0));
        const geometry = await dialog.evaluate((el) => {
          const r = el.getBoundingClientRect(),
            footer = el.querySelector("footer").getBoundingClientRect(),
            button = el
              .querySelector("footer .primary")
              .getBoundingClientRect(),
            body = el.querySelector(".lm-billing-dialog-body");
          return {
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
            centerX: (r.left + r.right) / 2,
            centerY: (r.top + r.bottom) / 2,
            viewport: { width: innerWidth, height: innerHeight },
            footerBottom: footer.bottom,
            buttonTop: button.top,
            buttonBottom: button.bottom,
            bodyClient: body.clientHeight,
            bodyScroll: body.scrollHeight,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          };
        });
        layouts.push({ theme, width, ...geometry });
        check(
          Math.abs(geometry.centerX - width / 2) <= 1 &&
            Math.abs(geometry.centerY - height / 2) <= 1,
          theme +
            " modal centers over the entire " +
            width +
            "px viewport, including sidebar",
        );
        check(
          geometry.left >= 0 &&
            geometry.top >= 0 &&
            geometry.right <= width &&
            geometry.bottom <= height &&
            geometry.scrollWidth <= geometry.clientWidth + 1,
          theme +
            " dialog stays within " +
            width +
            "px viewport without horizontal clipping",
        );
        check(
          geometry.buttonTop >= geometry.top &&
            geometry.buttonBottom <= geometry.bottom &&
            geometry.bodyScroll > geometry.bodyClient,
          theme +
            " long Pro review scrolls separately while payment CTA remains visible at " +
            width +
            "px",
        );
        await body.evaluate((el) => (el.scrollTop = el.scrollHeight));
        const after = await dialog
          .locator(".lm-billing-dialog-footer")
          .boundingBox();
        check(
          Math.abs(after.y + after.height - geometry.footerBottom) <= 1,
          theme +
            " footer stays visible after scrolling long content at " +
            width +
            "px",
        );
        const screenshot = folder + theme + "-" + width + ".png";
        await page.screenshot({ path: screenshot });
        screenshots.push(screenshot);
      }
    const payment = dialog.getByRole("button", {
        name: "Thanh toán",
        exact: true,
      }),
      close = dialog.getByRole("button", { name: "Đóng", exact: true }).first();
    await payment.focus();
    await page.keyboard.press("Tab");
    check(
      await close.evaluate((el) => el === document.activeElement),
      "Tab wraps from payment CTA to the close control",
    );
    await page.keyboard.press("Shift+Tab");
    check(
      await payment.evaluate((el) => el === document.activeElement),
      "Shift+Tab wraps within the native modal",
    );
    check(
      (await dialog.innerText()).includes("Thanh toán chưa mở") &&
        (await dialog.innerText()).includes("không thu tiền"),
      "Unavailable payment and no-charge policy are explicit before any checkout action",
    );
    hold = true;
    await payment.click();
    await page
      .getByRole("button", { name: "Đang kiểm tra thanh toán…", exact: true })
      .waitFor();
    check(
      await page
        .getByRole("button", { name: "Đang kiểm tra thanh toán…", exact: true })
        .isDisabled(),
      "Payment CTA prevents repeated pending requests and reports actual loading",
    );
    while (!release) await page.waitForTimeout(10);
    release();
    hold = false;
    await dialog
      .getByRole("status")
      .getByText("Chưa cấu hình giá bán.", { exact: false })
      .waitFor();
    check(
      calls.filter((c) => c.path.endsWith("checkout")).length === 1 &&
        JSON.stringify(calls.at(-1).body) ===
          JSON.stringify({ itemId: "pro", interval: "month" }),
      "Checkout sends only the selected item and billing interval, never displayed price or wallet data",
    );
    failure = "PAYMENT_PROVIDER_NOT_CONFIGURED";
    await payment.click();
    await dialog
      .getByRole("status")
      .getByText("Chưa kết nối cổng thanh toán.", { exact: false })
      .waitFor();
    check(
      (await dialog.locator(".lm-checkout-status").innerText()).includes(
        "chưa bị trừ tiền",
      ),
      "Real disabled-provider response cannot claim payment, credit or plan success",
    );
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    check(
      await trigger.evaluate((el) => el === document.activeElement),
      "Escape closes after calculator edits and restores the invoking plan button without a false draft prompt",
    );
    check(
      await page.evaluate(() => document.body.style.overflow !== "hidden"),
      "Closing restores page scrolling",
    );
    await page.locator(".lm-plan").first().getByRole("button").click();
    dialog = page.locator("dialog.lm-billing-dialog[open]");
    await dialog.waitFor();
    check(
      (await dialog
        .getByRole("button", { name: "Thanh toán", exact: true })
        .count()) === 0 &&
        (await dialog.innerText()).includes("Free không yêu cầu"),
      "Free review never offers a paid checkout or changes its entitlements",
    );
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.__billingMount("vi", false));
    await page.locator(".lm-plan").nth(3).getByRole("button").click();
    dialog = page.locator("dialog.lm-billing-dialog[open]");
    await dialog.waitFor();
    const before = calls.filter((c) => c.path.endsWith("checkout")).length;
    await dialog
      .getByRole("button", { name: "Thanh toán", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
    check(
      (await page.evaluate(() => window.__loginClicked === true)) &&
        calls.filter((c) => c.path.endsWith("checkout")).length === before,
      "Guest checkout closes the native review before invoking existing sign-in and never issues an unauthenticated purchase",
    );
    await page.keyboard.press("Escape");
    check(
      calls.every(
        (c) => c.method === "GET" || c.path === "/api/billing/checkout",
      ),
      "Review and status checks never write wallet grants, subscription changes or fabricated payment records",
    );
    check(
      errors.length === 0 && unexpected.length === 0,
      "No browser errors, real payment/provider requests or unexpected endpoints",
    );
    return {
      status: "PASS",
      passed: cases.length,
      cases,
      layouts,
      screenshots,
      calls,
      errors,
      unexpected,
      scope:
        "Actual BillingPanel/native modal/calculator/CSS inside a transformed learner-layout fixture, synthetic catalog/wallet and intercepted checkout errors. No real account, merchant, charge, credit grant, provider readiness or successful payment claim.",
    };
  } catch (error) {
    await page.screenshot({ path: folder + "debug.png", fullPage: true });
    return {
      status: "FAIL",
      passed: cases.length,
      cases,
      error: error.message,
      errors,
      unexpected,
      calls,
      layouts,
    };
  }
};
