async (page) => {
  const checks = [],
    ratios = [],
    requests = [],
    errors = [];
  const check = (ok, name) => {
    if (!ok) throw Error(name);
    checks.push(name);
  };
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u === "http://localhost:3000/fixture")
      return route.fulfill({
        path: "work/v9-foundation-ui/fixture.html",
        contentType: "text/html",
      });
    if (u === "http://localhost:3000/fixture.css")
      return route.fulfill({
        path: "work/v9-foundation-ui/fixture.css",
        contentType: "text/css",
      });
    requests.push(u);
    return route.abort();
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.emulateMedia({
    reducedMotion: "no-preference",
    colorScheme: "dark",
  });
  await page.goto("http://localhost:3000/fixture");
  await page.evaluate(() => (document.documentElement.dataset.motion = "off"));
  async function appearance(id) {
    return page.locator("#" + id).evaluate((node) => {
      const c = getComputedStyle(node),
        numbers = (s) => (s.match(/[\d.]+/g) || []).map(Number);
      let p = node,
        background = "";
      while (p) {
        const v = getComputedStyle(p).backgroundColor,
          n = numbers(v);
        if (n.length >= 3 && (n.length < 4 || n[3] > 0)) {
          background = v;
          break;
        }
        p = p.parentElement;
      }
      let ancestor = node.parentElement,
        outside = "";
      while (ancestor) {
        const v = getComputedStyle(ancestor).backgroundColor,
          n = numbers(v);
        if (n.length >= 3 && (n.length < 4 || n[3] > 0)) {
          outside = v;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      return {
        color: c.color,
        background,
        outside,
        border: c.borderTopColor,
        outline: c.outlineColor,
        outlineWidth: c.outlineWidth,
        transition: c.transitionDuration,
        transform: c.transform,
        height: node.getBoundingClientRect().height,
      };
    });
  }
  function contrast(a, b) {
    const values = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number),
      lum = (s) =>
        values(s)
          .map((x) => {
            const c = x / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          })
          .reduce((n, c, i) => n + c * [0.2126, 0.7152, 0.0722][i], 0);
    const x = lum(a),
      y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (t) => (document.documentElement.dataset.theme = t),
      theme,
    );
    for (const id of [
      "heading",
      "secondary",
      "body-text",
      "muted",
      "primary",
      "topbar-primary",
      "secondary-button",
      "danger",
      "ai-label",
      "ai-body",
      "success",
      "warning",
      "error",
      "info",
      "existing-error",
    ]) {
      const s = await appearance(id),
        r = contrast(s.color, s.background);
      ratios.push({
        theme,
        target: id,
        ratio: Number(r.toFixed(2)),
        foreground: s.color,
        background: s.background,
      });
      check(r >= 4.5, `${theme}: ${id} computed text contrast >=4.5`);
    }
    for (const id of [
      "input",
      "select",
      "textarea",
      "secondary-button",
      "primary",
      "topbar-primary",
    ]) {
      const s = await appearance(id),
        r = Math.max(
          contrast(s.border, s.outside),
          contrast(s.background, s.outside),
        );
      check(r >= 3, `${theme}: ${id} effective control boundary >=3`);
    }
    for (const id of ["chart1", "chart2", "chart3", "chart4"]) {
      const s = await appearance(id);
      check(
        contrast(s.color, s.background) >= 3,
        `${theme}: ${id} marker contrast >=3`,
      );
    }
    await page.keyboard.press("Tab");
    await page.locator("#primary").focus();
    const focus = await appearance("primary"),
      surface = await appearance("body-text");
    check(
      parseFloat(focus.outlineWidth) >= 3 &&
        contrast(focus.outline, surface.background) >= 3,
      `${theme}: keyboard primary focus ring is visible against surface`,
    );
    await page.locator("#disclosure").focus();
    const d = await appearance("disclosure");
    check(
      parseFloat(d.outlineWidth) >= 3,
      `${theme}: native disclosure has visible keyboard focus`,
    );
    check(
      (await appearance("input")).height >= 44,
      `${theme}: shared input target is at least44px`,
    );
    const placeholder = await page
      .locator("#input")
      .evaluate((node) => getComputedStyle(node, "::placeholder").color);
    check(
      contrast(placeholder, (await appearance("input")).background) >= 4.5,
      `${theme}: placeholder contrast remains readable`,
    );
    const ai = await appearance("ai-body"),
      base = await appearance("body-text");
    check(
      ai.background !== base.background,
      `${theme}: localized AI surface survives existing panel cascade`,
    );
    await page.screenshot({
      path: `docs/v9/qa-foundation-${theme}.png`,
      fullPage: true,
    });
  }
  await page.evaluate(() => delete document.documentElement.dataset.theme);
  await page.emulateMedia({ colorScheme: "light" });
  check(
    (await appearance("heading")).background === "rgb(241, 245, 238)",
    "No stored theme honors light system before JavaScript theme resolution",
  );
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  check(
    (await appearance("heading")).background === "rgb(16, 25, 22)",
    "Explicit dark theme wins over light system preference",
  );
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.dataset.motion = "full";
  });
  await page.locator("#card").hover();
  await page.waitForTimeout(250);
  let c = await appearance("card");
  let m = (c.transform.match(/[-\d.]+/g) || []).map(Number);
  check(
    m.length === 6 && m[0] === 1 && m[3] === 1 && m[5] >= -2 && m[5] < 0,
    "Full motion card lifts at most2px without scale",
  );
  check(
    c.transition.split(",").every((t) => {
      const n = parseFloat(t);
      return n >= 0.15 && n <= 0.22;
    }),
    "Shared hover durations stay between150 and220ms",
  );
  await page.locator("#primary").hover();
  await page.mouse.down();
  await page.waitForTimeout(250);
  c = await appearance("primary");
  m = (c.transform.match(/[-\d.]+/g) || []).map(Number);
  check(
    c.transform === "none" ||
      (m.length === 6 && m[0] === 1 && m[3] === 1 && m[5] === 0),
    "Button press feedback does not scale the button",
  );
  await page.mouse.up();
  for (const mode of ["off", "subtle"]) {
    await page.evaluate(
      (v) => (document.documentElement.dataset.motion = v),
      mode,
    );
    for (const id of ["card", "space", "action", "primary", "icon"]) {
      await page.locator("#" + id).hover();
      await page.waitForTimeout(30);
      check(
        (await appearance(id)).transform === "none",
        `${mode}: ${id} has no hover transform`,
      );
    }
    if (mode === "off")
      check(
        (await appearance("card")).transition
          .split(",")
          .every((v) => parseFloat(v) === 0),
        "User motion-off removes transitions",
      );
    check(
      (await appearance("layout-transform")).transform.includes("7"),
      "Motion preference preserves structural layout transform",
    );
  }
  await page.evaluate(() => (document.documentElement.dataset.motion = "full"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const id of ["card", "space", "action", "primary", "icon"]) {
    await page.locator("#" + id).hover();
    check(
      (await appearance(id)).transform === "none",
      `OS reduced motion suppresses ${id} hover transform`,
    );
  }
  check(
    (await appearance("card")).transition
      .split(",")
      .every((v) => parseFloat(v) === 0),
    "OS reduced motion removes shared transitions",
  );
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Representative shared controls fit${width}px without horizontal overflow`,
    );
  }
  check(
    await page.locator("#disabled").isDisabled(),
    "Disabled control preserves native disabled semantics",
  );
  check(errors.length === 0, "No browser runtime errors");
  check(requests.length === 0, "No external or product API requests");
  return {
    status: "PASS",
    passed: checks.length,
    checks,
    ratios,
    errors,
    requests,
    scope:
      "Actual full imported product CSS on labelled representative semantic DOM in isolated Edge; no product workflow/auth/provider/device/WCAG certification or learning-effect claim",
  };
};
