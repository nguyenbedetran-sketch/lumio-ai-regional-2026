const v9Observations = [],
  v9Findings = [];
async function v9Matrix(label, selector, dialogSelector) {
  const original = page.viewportSize(),
    initialTheme = await page.evaluate(
      () => document.documentElement.dataset.theme || "",
    );
  const backgrounds = {};
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
      document.documentElement.dataset.motion = "off";
    }, theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 900 : 1000 });
      const root = page.locator(selector).first();
      await root.waitFor();
      const metrics = await root.evaluate((n) => {
        const style = getComputedStyle(n),
          header = n.querySelector(".tw-topbar,.ad-topbar"),
          controls = [
            ...(header || n).querySelectorAll("button,select,a"),
          ].filter((node) => node.getBoundingClientRect().width > 0),
          clipped = controls
            .filter((node) => {
              const r = node.getBoundingClientRect();
              return r.left < -1 || r.right > innerWidth + 1;
            })
            .map((n) =>
              (
                n.getAttribute("aria-label") ||
                n.textContent ||
                n.title ||
                n.tagName
              )
                .trim()
                .slice(0, 100),
            );
        const rgb = (v) => {
            const m = /^rgba?\(([^)]+)\)$/.exec(v);
            return m ? m[1].split(",").map(Number) : null;
          },
          luminance = (v) =>
            v
              .slice(0, 3)
              .map((c) => c / 255)
              .map((c) =>
                c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
              )
              .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0),
          sampleRoot = document.querySelector("dialog[open],[role=dialog]") || n,
          contrast = [
            ...sampleRoot.querySelectorAll(
              ".tw-stat > div,.tw-stat p,.tw-tabs button,.tw-text-button,.tw-field > span,.tw-field small,.tw-note,.tw-check,.ad-teacher-intro p,.ad-teacher-table small,.ad-table th",
            ),
          ]
            .filter(
              (e) =>
                e.getBoundingClientRect().width > 0 &&
                e.textContent.trim() &&
                !e.matches(":disabled"),
            )
            .slice(0, 12)
            .flatMap((e) => {
              const s = getComputedStyle(e),
                fg = rgb(s.color);
              let parent = e,
                bg = null;
              while (parent && !bg) {
                const c = rgb(getComputedStyle(parent).backgroundColor);
                if (c && (c.length < 4 || c[3] === 1)) bg = c;
                parent = parent.parentElement;
              }
              if (!fg || !bg) return [];
              const a = luminance(fg),
                b = luminance(bg),
                ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
                size = parseFloat(s.fontSize),
                weight = Number(s.fontWeight),
                minimum =
                  size >= 24 || (size >= 18.67 && weight >= 700) ? 3 : 4.5;
              return [
                {
                  text: e.textContent.trim().slice(0, 75),
                  ratio: Math.round(ratio * 100) / 100,
                  minimum,
                  color: s.color,
                  background: `rgb(${bg.slice(0, 3).join(", ")})`,
                  fontSize: size,
                },
              ];
            });
        return {
          viewport: innerWidth,
          pageWidth: document.documentElement.scrollWidth,
          background: style.backgroundColor,
          text: style.color,
          fontFamily: style.fontFamily,
          clippedHeaderControls: clipped,
          controlCount: controls.length,
          contrast,
        };
      });
      backgrounds[theme] = metrics.background;
      const scope = dialogSelector ? page.locator(dialogSelector).last() : root,
        focusable = scope
          .locator(
            "button:not([disabled]),a[href],select:not([disabled]),textarea:not([disabled]),input:not([disabled])",
          )
          .filter({ visible: true })
          .first();
      let focus = null;
      if (await focusable.count()) {
        await focusable.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        focus = await page.evaluate(() => {
          const n = document.activeElement,
            s = getComputedStyle(n),
            r = n.getBoundingClientRect();
          return {
            tag: n.tagName,
            name: (
              n.getAttribute("aria-label") ||
              n.textContent ||
              n.title ||
              ""
            )
              .trim()
              .slice(0, 100),
            visible: r.width > 0 && r.height > 0,
            outline: s.outlineStyle,
            outlineWidth: parseFloat(s.outlineWidth),
            shadow: s.boxShadow,
          };
        });
      }
      const record = { label, theme, width, ...metrics, focus };
      v9Observations.push(record);
      if (metrics.pageWidth > width + 2)
        v9Findings.push({
          label,
          theme,
          width,
          code: "PAGE_OVERFLOW",
          pageWidth: metrics.pageWidth,
        });
      if (metrics.clippedHeaderControls.length)
        v9Findings.push({
          label,
          theme,
          width,
          code: "HEADER_CONTROL_CLIPPED",
          controls: metrics.clippedHeaderControls,
        });
      if (
        width === 1440 &&
        metrics.contrast.some((sample) => sample.ratio < sample.minimum)
      )
        v9Findings.push({
          label,
          theme,
          code: "SAMPLED_TEXT_CONTRAST",
          samples: metrics.contrast.filter(
            (sample) => sample.ratio < sample.minimum,
          ),
        });
      if (
        !focus?.visible ||
        (focus.outline === "none" && focus.shadow === "none")
      )
        v9Findings.push({
          label,
          theme,
          width,
          code: "FOCUS_NOT_VISIBLE",
          focus,
        });
      if ([390, 1440].includes(width)) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `docs/v9/qa-role-${label}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  if (backgrounds.light === backgrounds.dark)
    v9Findings.push({ label, code: "THEME_NOT_INHERITED", backgrounds });
  await page.setViewportSize(original);
  await page.evaluate((value) => {
    if (value) document.documentElement.dataset.theme = value;
    else delete document.documentElement.dataset.theme;
  }, initialTheme);
}
