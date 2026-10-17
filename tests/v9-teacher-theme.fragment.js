const v9Observations = [],
  v9Findings = [];
async function v9Matrix(label, selector, dialogSelector) {
  const original = page.viewportSize(),
    initial = await page.evaluate(
      () => document.documentElement.dataset.theme || "",
    );
  async function inspect() {
    return page
      .locator(selector)
      .first()
      .evaluate((root) => {
        const visible = (n) =>
          n.getBoundingClientRect().width > 0 &&
          n.getBoundingClientRect().height > 0 &&
          getComputedStyle(n).visibility !== "hidden";
        const rgb = (v) => {
          const m = /^rgba?\(([^)]+)\)$/.exec(v);
          return m ? m[1].split(",").map(Number) : null;
        };
        const bg = (n) => {
          while (n) {
            const c = rgb(getComputedStyle(n).backgroundColor);
            if (c && (c.length === 3 || c[3] === 1)) return c;
            n = n.parentElement;
          }
          return [255, 255, 255];
        };
        const lum = (v) =>
          v
            .slice(0, 3)
            .map((x) => x / 255)
            .map((x) =>
              x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4,
            )
            .reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
        const ratio = (a, b) => {
          const x = lum(a),
            y = lum(b);
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        };
        const scope = document.querySelector("dialog[open]") || root;
        const text = [
          ...scope.querySelectorAll(
            "h1,h2,h3,p,small,label,summary,button,a,th,td,caption,legend,input,select,textarea,.tw-tag,.tw-eyebrow,.tw-space-label,.tw-breadcrumb,.tw-connection,.tw-nav-count,.tw-code,.tw-muted,.tw-subtle,.tw-card-footer,.tw-stat>div,.tw-stat>strong,.tw-field>span",
          ),
        ]
          .filter(
            (n) =>
              visible(n) &&
              !n.matches(":disabled") &&
              (n.textContent.trim() ||
                n.value ||
                n.getAttribute("placeholder")),
          )
          .map((n) => {
            const s = getComputedStyle(n),
              c = rgb(s.color),
              b = bg(n),
              large =
                parseFloat(s.fontSize) >= 24 ||
                (parseFloat(s.fontSize) >= 18.67 &&
                  Number(s.fontWeight) >= 700);
            return {
              selector: n.tagName + "." + n.className,
              text: (
                n.textContent ||
                n.value ||
                n.getAttribute("placeholder") ||
                ""
              )
                .trim()
                .slice(0, 80),
              color: s.color,
              background: `rgb(${b.slice(0, 3).join(",")})`,
              ratio: Math.round(ratio(c, b) * 100) / 100,
              minimum: large ? 3 : 4.5,
            };
          });
        const controls = [
          ...scope.querySelectorAll(
            "input:not([type=checkbox]):not([type=radio]),textarea,select,.tw-search",
          ),
        ]
          .filter(visible)
          .map((n) => {
            const s = getComputedStyle(n),
              border = rgb(s.borderTopColor),
              b = bg(n);
            return {
              tag: n.tagName,
              border: s.borderTopColor,
              style: s.borderTopStyle,
              width: parseFloat(s.borderTopWidth),
              ratio: border ? Math.round(ratio(border, b) * 100) / 100 : 0,
              exempt:
                s.borderTopStyle === "none" ||
                parseFloat(s.borderTopWidth) === 0 ||
                n.matches(":disabled"),
            };
          });
        const active = document.activeElement,
          focus =
            active && visible(active)
              ? (() => {
                  const s = getComputedStyle(active),
                    c = rgb(s.outlineColor);
                  return {
                    tag: active.tagName,
                    outline: s.outlineStyle,
                    width: parseFloat(s.outlineWidth),
                    ratio: c ? Math.round(ratio(c, bg(active)) * 100) / 100 : 0,
                  };
                })()
              : null;
        return {
          background: getComputedStyle(root).backgroundColor,
          text,
          controls,
          focus,
          pageWidth: document.documentElement.scrollWidth,
          width: innerWidth,
          theme: document.documentElement.dataset.theme || "system",
          colorScheme: getComputedStyle(root).colorScheme,
          entryAnimations: [...root.querySelectorAll(".tw-enter")].map(
            (n) => getComputedStyle(n).animationName,
          ),
        };
      });
  }
  const backgrounds = {};
  for (const theme of ["light", "dark"]) {
    await page.evaluate((v) => {
      document.documentElement.dataset.theme = v;
      document.documentElement.dataset.motion = "off";
    }, theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 900 : 1000 });
      const scope = dialogSelector
        ? page.locator(dialogSelector).last()
        : page.locator(selector).first();
      const first = scope
        .locator(
          "button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary",
        )
        .filter({ visible: true })
        .first();
      await first.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      const data = await inspect();
      if (data.entryAnimations.some((name) => name !== "none"))
        throw Error(`${label}/${theme}/${width}:USER_MOTION_OFF_IGNORED`);
      backgrounds[theme] = data.background;
      if (data.pageWidth > width + 2)
        throw Error(
          `${label}/${theme}/${width}:PAGE_OVERFLOW:${data.pageWidth}`,
        );
      const badText = data.text.filter((s) => s.ratio < s.minimum),
        badControls = data.controls.filter((s) => !s.exempt && s.ratio < 3);
      if (badText.length)
        throw Error(
          `${label}/${theme}/${width}:TEXT_CONTRAST:${JSON.stringify(badText).slice(0, 2500)}`,
        );
      if (badControls.length)
        throw Error(
          `${label}/${theme}/${width}:CONTROL_CONTRAST:${JSON.stringify(badControls)}`,
        );
      if (
        !data.focus ||
        data.focus.outline === "none" ||
        data.focus.width < 2 ||
        data.focus.ratio < 3
      )
        throw Error(
          `${label}/${theme}/${width}:FOCUS_CONTRAST:${JSON.stringify(data.focus)}`,
        );
      v9Observations.push({ label, theme, width, ...data });
      if ([390, 1440].includes(width)) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `docs/v9/role-theme/teacher-${label}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  if (backgrounds.light === backgrounds.dark)
    throw Error(`${label}:THEME_NOT_INHERITED`);
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate(() => delete document.documentElement.dataset.theme);
    const data = await inspect();
    if (data.background !== backgrounds[scheme])
      throw Error(`${label}:SYSTEM_FALLBACK:${scheme}`);
    v9Observations.push({
      label,
      theme: "system-" + scheme,
      width: 1440,
      ...data,
    });
  }
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await page.emulateMedia({ media: "print" });
  const printed = await inspect();
  if (printed.text.some((s) => s.ratio < s.minimum))
    throw Error(
      `${label}:PRINT_TEXT_CONTRAST:${JSON.stringify(printed.text.filter((s) => s.ratio < s.minimum)).slice(0, 2500)}`,
    );
  if (printed.background !== "rgb(255, 255, 255)")
    throw Error(`${label}:PRINT_NOT_WHITE:${printed.background}`);
  v9Observations.push({ label, theme: "print-from-dark", ...printed });
  await page.emulateMedia({ media: "screen", colorScheme: "light" });
  await page.setViewportSize(original);
  await page.evaluate((v) => {
    if (v) document.documentElement.dataset.theme = v;
    else delete document.documentElement.dataset.theme;
  }, initial);
}
