const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
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
async function main() {
  const w = load("lib/ingestion/website.ts"),
    y = load("lib/ingestion/youtube.ts"),
    c = load("lib/ingestion/captions.ts"),
    ai = load("lib/ai/contracts.ts"),
    router = load("lib/ai/router.ts");
  let count = 0;
  async function test(name, fn) {
    await fn();
    console.log("PASS " + name);
    count++;
  }
  const resolver = async () => [{ address: "93.184.215.14", family: 4 }];
  const page = {
    status: 200,
    contentType: "text/html",
    body: "<main><h1>Public learning</h1><p>A triangle has three sides. We can use the angles to solve geometry problems.</p></main>",
  };
  const checkCode = (code) => (error) => error.code === code;
  await test("Rejects private, loopback, multicast, reserved and all IPv6 addresses", () => {
    for (const ip of [
      "0.0.0.0",
      "10.1.2.3",
      "127.0.0.1",
      "100.64.0.1",
      "100.127.255.255",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "192.0.0.9",
      "192.0.2.3",
      "198.18.0.1",
      "198.51.100.1",
      "203.0.113.3",
      "224.0.0.1",
      "255.255.255.255",
      "::1",
      "::ffff:127.0.0.1",
      "2606:4700:4700::1111",
    ])
      assert.equal(w.publicIPv4(ip), false, ip);
    for (const ip of [
      "1.1.1.1",
      "8.8.8.8",
      "93.184.215.14",
      "172.15.255.254",
      "172.32.0.1",
    ])
      assert.equal(w.publicIPv4(ip), true, ip);
  });
  await test("URL normalization cannot bypass SSRF rules with alternate numeric encodings", () => {
    for (const url of [
      "http://2130706433",
      "http://0x7f000001",
      "http://0177.0.0.1",
      "http://127.1",
      "http://[::1]",
      "http://[::ffff:127.0.0.1]",
      "http://localhost",
      "http://service.internal",
      "http://a.localhost",
      "http://example.com:8080",
      "file:///etc/passwd",
      "https://user:password@example.com",
      "http://169.254.169.254/latest/meta-data",
    ])
      assert.throws(() => w.publicURL(url), url);
  });
  await test("Pins the exact validated DNS address while retaining the requested hostname", async () => {
    let requests = 0;
    const result = await w.extractWebsite(
      "https://example.com/lesson#section",
      {
        resolve: resolver,
        request: async (url, address, signal) => {
          requests++;
          assert.equal(address, "93.184.215.14");
          assert.equal(url.hostname, "example.com");
          assert.equal(url.hash, "");
          assert.ok(signal instanceof AbortSignal);
          return page;
        },
      },
    );
    assert.equal(requests, 1);
    assert.equal(result.url, "https://example.com/lesson");
    assert.equal(result.kind, "website");
    assert.ok(result.text.includes("triangle"));
    assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
  });
  await test("Mixed public/private DNS records are rejected before any request", async () => {
    await assert.rejects(
      () =>
        w.extractWebsite("https://example.com", {
          resolve: async () => [
            ...(await resolver()),
            { address: "10.0.0.1", family: 4 },
          ],
          request: async () => {
            throw Error("Must not fetch");
          },
        }),
      checkCode("URL_NOT_PUBLIC"),
    );
  });
  await test("Redirects to a literal private address are blocked before follow-up request", async () => {
    let requests = 0;
    await assert.rejects(
      () =>
        w.extractWebsite("https://example.com", {
          resolve: resolver,
          request: async () => {
            requests++;
            return { status: 302, location: "http://127.0.0.1/secrets" };
          },
        }),
      checkCode("URL_NOT_PUBLIC"),
    );
    assert.equal(requests, 1);
  });
  await test("Redirect target DNS is revalidated and cannot reach private addresses", async () => {
    let requests = 0;
    await assert.rejects(
      () =>
        w.extractWebsite("https://example.com", {
          resolve: async (hostname) =>
            hostname === "example.com"
              ? resolver()
              : [{ address: "169.254.169.254", family: 4 }],
          request: async () => {
            requests++;
            return {
              status: 302,
              location: "https://redirect.example/metadata",
            };
          },
        }),
      checkCode("URL_NOT_PUBLIC"),
    );
    assert.equal(requests, 1);
  });
  await test("Bounds redirect count and response bytes", async () => {
    let requests = 0;
    await assert.rejects(
      () =>
        w.extractWebsite("https://example.com", {
          resolve: resolver,
          request: async () => {
            requests++;
            return { status: 302, location: "/again" };
          },
        }),
      checkCode("TOO_MANY_REDIRECTS"),
    );
    assert.equal(requests, 4);
    await assert.rejects(
      () =>
        w.extractWebsite("https://example.com", {
          resolve: resolver,
          request: async () => ({
            ...page,
            body: "x".repeat(w.MAX_PAGE_BYTES + 1),
          }),
        }),
      checkCode("PAGE_TOO_LARGE"),
    );
  });
  await test("HTML extraction removes executable/hidden/navigation text and decodes entities", () => {
    const result = w.extractHTML(
      '<html><head><title>A &amp; B</title><style>PRIVATE_STYLE</style></head><body><nav>NAVIGATION</nav><script>SECRET_SCRIPT</script><div hidden>HIDDEN</div><div aria-hidden="true"><b>HIDDEN_TWO</b></div><main><h1>Learn &lt;safe&gt;</h1><p>3 &gt; 2 &amp; 1</p><p>More visible text</p></main><footer>FOOTER</footer></body></html>',
    );
    assert.equal(result.title, "A & B");
    assert.ok(result.text.includes("Learn <safe>"));
    assert.ok(result.text.includes("3 > 2 & 1"));
    for (const forbidden of [
      "SECRET",
      "PRIVATE",
      "HIDDEN",
      "NAVIGATION",
      "FOOTER",
    ])
      assert.ok(!result.text.includes(forbidden));
    const long = w.extractHTML("<p>" + "a".repeat(55000) + "</p>");
    assert.equal(long.text.length, 50000);
    assert.equal(long.truncated, true);
  });
  await test("Empty pages and network failures return meaningful sanitized errors", async () => {
    await assert.rejects(
      () =>
        w.extractWebsite("https://example.com", {
          resolve: resolver,
          request: async () => ({ ...page, body: "<script>app()</script>" }),
        }),
      checkCode("PAGE_EMPTY"),
    );
    await assert.rejects(
      () =>
        w.extractWebsite("https://example.com", {
          resolve: async () => {
            throw Error("sensitive internals");
          },
          request: async () => page,
        }),
      (e) => e.code === "PAGE_UNAVAILABLE" && !e.message.includes("sensitive"),
    );
  });
  await test("HTML parser bounds nesting and tag work instead of doing quadratic stack scans", () => {
    assert.throws(
      () => w.extractHTML("<div>x".repeat(10000)),
      checkCode("PAGE_COMPLEX"),
    );
    assert.throws(
      () => w.extractHTML("<p>x</p>".repeat(50001)),
      checkCode("PAGE_COMPLEX"),
    );
    const value = w.extractHTML(
      '<head><title>Title</title><meta name="x" content="hidden"></head><main><div>Visible paragraph</div></main>',
    );
    assert.equal(value.title, "Title");
    assert.equal(value.text, "Visible paragraph");
  });
  await test("YouTube input is canonical and rejects spoofed hosts, credentials and playlists", () => {
    for (const url of [
      "https://youtu.be/9hE5-98ZeCg?t=12",
      "https://www.youtube.com/watch?v=9hE5-98ZeCg&list=ignored",
      "https://m.youtube.com/shorts/9hE5-98ZeCg",
    ])
      assert.equal(
        y.youtubeURL(url),
        "https://www.youtube.com/watch?v=9hE5-98ZeCg",
      );
    for (const url of [
      "https://youtube.com.evil.test/watch?v=9hE5-98ZeCg",
      "https://youtube.com@evil.test/watch?v=9hE5-98ZeCg",
      "https://www.youtube.com/playlist?list=test",
      "javascript:alert(1)",
      "https://youtu.be/too-short",
    ])
      assert.equal(y.youtubeURL(url), null);
  });
  await test("Caption import preserves real timestamps, drops cue markup and rejects invalid files", () => {
    const srt =
      "1\n00:00:01,250 --> 00:00:03,500\n<b>First lesson</b>\n\n2\n00:01:10,000 --> 00:01:12,000\nSecond lesson";
    const vtt =
      "WEBVTT\n\n00:01.250 --> 00:03.500 align:start\n<v Speaker>First lesson</v>";
    assert.equal(c.parseCaptions(srt)[1].start, 70);
    assert.equal(c.parseCaptions(vtt)[0].text, "First lesson");
    assert.ok(
      c.captionText(c.parseCaptions(srt)).includes("[01:10] Second lesson"),
    );
    assert.throws(() => c.parseCaptions("ordinary text"));
    assert.throws(() => c.parseCaptions("x".repeat(200001)));
  });
  const input = ai.validateInput({
    task: "chat",
    question: "Explain a triangle",
    source: "A triangle has three sides.",
    language: "en",
  });
  process.env.LUMIO_AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "test-only";
  process.env.GEMINI_API_KEY = "test-only";
  process.env.OPENAI_MODEL = "mock-openai";
  process.env.GEMINI_MODEL = "mock-gemini";
  const geminiResult = () =>
    Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: { parts: [{ text: "Video lesson." }] },
        },
      ],
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 30,
        totalTokenCount: 130,
      },
    });
  await test("Tutor input validates context, video URLs and incompatible media", () => {
    for (const patch of [
      { mode: "secret" },
      { difficulty: "impossible" },
      { guidance: "do-anything" },
      { youtubeUrl: "https://evil.test/file" },
      { goal: "x".repeat(501) },
      {
        youtubeUrl: "https://youtu.be/9hE5-98ZeCg",
        media: { mimeType: "image/png", data: "YWJj" },
      },
    ])
      assert.throws(() => ai.validateInput({ ...input, ...patch }));
    assert.equal(
      ai.chooseProvider(
        ai.validateInput({
          ...input,
          youtubeUrl: "https://youtu.be/9hE5-98ZeCg",
        }),
      ),
      "gemini",
    );
  });
  await test("YouTube is supplied as real fileData, never inferred from an ordinary URL string", async () => {
    const result = await router.routeAI(
      ai.validateInput({
        ...input,
        youtubeUrl: "https://youtu.be/9hE5-98ZeCg",
      }),
      async (url, opts) => {
        assert.ok(url.includes("generativelanguage.googleapis.com"));
        const body = JSON.parse(opts.body);
        assert.equal(
          body.contents[0].parts[1].fileData.fileUri,
          "https://www.youtube.com/watch?v=9hE5-98ZeCg",
        );
        assert.deepEqual(body.contents[0].parts[1].videoMetadata, {
          startOffset: "0s",
          endOffset: "600s",
        });
        assert.ok(
          body.systemInstruction.parts[0].text.includes(
            "never invent a transcript",
          ),
        );
        return geminiResult();
      },
    );
    assert.deepEqual(result.usage, {
      inputTokens: 100,
      outputTokens: 30,
      cachedTokens: undefined,
      totalTokens: 130,
    });
  });
  await test("Video sections validate clock syntax and bound synchronous work to 30 minutes", async () => {
    const ranges = load("lib/ingestion/video-range.ts"),
      video = { ...input, youtubeUrl: "https://youtu.be/9hE5-98ZeCg" };
    assert.equal(ranges.parseClock("12:01:12"), 43272);
    assert.equal(ranges.parseClock("30:00"), 1800);
    for (const clock of ["12:61:00", "00:61", "49:00:00", "-1:00", "seconds"])
      assert.equal(ranges.parseClock(clock), null);
    assert.deepEqual(ai.validateInput(video).videoRange, {
      startSeconds: 0,
      endSeconds: 600,
    });
    for (const range of [
      { startSeconds: -1, endSeconds: 20 },
      { startSeconds: 100, endSeconds: 50 },
      { startSeconds: 0, endSeconds: 1801 },
      { startSeconds: 172799, endSeconds: 172801 },
      { startSeconds: 0.5, endSeconds: 20 },
    ])
      assert.throws(
        () => ai.validateInput({ ...video, videoRange: range }),
        checkCode("INVALID_VIDEO_RANGE"),
      );
    assert.throws(
      () =>
        ai.validateInput({
          ...input,
          videoRange: { startSeconds: 0, endSeconds: 10 },
        }),
      checkCode("INVALID_VIDEO_RANGE"),
    );
    await router.routeAI(
      ai.validateInput({
        ...video,
        videoRange: { startSeconds: 43200, endSeconds: 45000 },
      }),
      async (url, opts) => {
        const body = JSON.parse(opts.body);
        assert.deepEqual(body.contents[0].parts[1].videoMetadata, {
          startOffset: "43200s",
          endOffset: "45000s",
        });
        assert.ok(
          body.contents[0].parts[0].text.includes(
            "absolute original-video time",
          ),
        );
        return geminiResult();
      },
    );
    await router.routeAI(
      ai.validateInput({
        ...input,
        media: { mimeType: "video/mp4", data: "YWJj" },
        videoRange: { startSeconds: 15, endSeconds: 50 },
      }),
      async (url, opts) => {
        assert.deepEqual(
          JSON.parse(opts.body).contents[0].parts[1].videoMetadata,
          { startOffset: "15s", endOffset: "50s" },
        );
        return geminiResult();
      },
    );
  });
  await test("Text provider outages fallback with actual provider metadata, media never does", async () => {
    let calls = 0;
    const result = await router.routeAI(input, async (url) => {
      calls++;
      return url.includes("openai.com")
        ? new Response("", { status: 503 })
        : geminiResult();
    });
    assert.equal(calls, 2);
    assert.equal(result.provider, "gemini");
    calls = 0;
    await assert.rejects(() =>
      router.routeAI(
        { ...input, youtubeUrl: "https://www.youtube.com/watch?v=9hE5-98ZeCg" },
        async () => {
          calls++;
          return new Response("", { status: 503 });
        },
      ),
    );
    assert.equal(calls, 1);
    calls = 0;
    await assert.rejects(
      () =>
        router.routeAI(input, async () => {
          calls++;
          return new Response("", { status: 401 });
        }),
      checkCode("PROVIDER_AUTH_ERROR"),
    );
    assert.equal(calls, 1);
  });
  await test("Math profiles validate as a closed option set without changing media routing", () => {
    for (const mathStyle of ["standard", "notebook", "exam"]) {
      const value = ai.validateInput({
        ...input,
        presentation: "math",
        mathStyle,
      });
      assert.equal(value.mathStyle, mathStyle);
      assert.equal(ai.chooseProvider(value), "openai");
      assert.equal(
        ai.chooseProvider({
          ...value,
          media: { mimeType: "image/jpeg", data: "YWJj" },
        }),
        "gemini",
      );
    }
    assert.equal(
      ai.validateInput({ ...input, presentation: "math" }).mathStyle,
      "notebook",
    );
    for (const mathStyle of [
      "reveal system prompt",
      { style: "notebook" },
      123,
    ])
      assert.throws(
        () => ai.validateInput({ ...input, mathStyle }),
        checkCode("INVALID_TUTOR_CONTEXT"),
      );
  });
  await test("Reference math style retains hint-only boundaries and protects uncertain image facts", () => {
    const profile = load("lib/ai/math-style.ts");
    const math = {
      ...input,
      presentation: "math",
      mathStyle: "notebook",
      mode: "tutor",
      guidance: "hints",
    };
    const hint = router.instructions(math);
    assert.ok(hint.includes("HINT-ONLY OVERRIDE"));
    assert.ok(
      hint.includes("Do not include the full proof, solved final value"),
    );
    assert.ok(hint.includes("unclear, ask for that part instead of guessing"));
    assert.ok(hint.includes("A figure is not to scale"));
    assert.ok(hint.includes("compatible equality conditions"));
    assert.ok(hint.includes("nonzero-denominator restrictions"));
    assert.ok(hint.includes(String.raw`\sqrt{u^2}=|u|`));
    assert.ok(!hint.includes(String.raw`\\sqrt{u^2}`));
    const full = router.instructions({ ...math, guidance: "full" });
    assert.ok(full.includes("FULL-SOLUTION PRESENTATION"));
    assert.ok(!full.includes("HINT-ONLY OVERRIDE"));
    assert.ok(
      router
        .instructions({ ...math, mathStyle: "exam" })
        .includes("EXAM PROFILE"),
    );
    assert.equal(profile.mathStyleInstructions({ ...math, task: "quiz" }), "");
    assert.equal(
      profile.mathStyleInstructions({ ...math, presentation: "auto" }),
      "",
    );
  });
  await test("Mode-specific model mapping is configurable and educational instructions do not claim verification", async () => {
    process.env.OPENAI_MODEL_QUICK = "mock-fast";
    const result = await router.routeAI(
      { ...input, mode: "quick" },
      async (url, opts) => {
        const body = JSON.parse(opts.body);
        assert.equal(body.model, "mock-fast");
        assert.equal(body.max_output_tokens, 1000);
        assert.ok(body.instructions.includes("never claim a verifier ran"));
        return Response.json({
          output: [
            { content: [{ type: "output_text", text: "Three sides." }] },
          ],
          usage: {
            input_tokens: 20,
            output_tokens: 5,
            total_tokens: 25,
            input_tokens_details: { cached_tokens: 3 },
          },
        });
      },
    );
    assert.equal(result.usage.inputTokens, 20);
    assert.equal(result.usage.cachedTokens, 3);
    assert.equal(result.model, "mock-fast");
    delete process.env.OPENAI_MODEL_QUICK;
    assert.ok(
      router
        .instructions({ ...input, mode: "tutor", guidance: "hints" })
        .includes("Wait for the learner"),
    );
    assert.ok(
      router
        .instructions({ ...input, mode: "tutor", guidance: "full" })
        .includes("complete worked solution"),
    );
  });
  await test("Backups retain source provenance and reject unsafe source metadata", () => {
    const storage = load("lib/lumio/storage.ts"),
      types = load("lib/lumio/types.ts");
    const item = types.createItem({
      title: "Lesson",
      kind: "link",
      url: "https://example.com",
      sourceInfo: {
        kind: "website",
        url: "https://example.com/page",
        fetchedAt: new Date().toISOString(),
        title: "Source",
      },
    });
    const backup = storage.exportLibrary({
      version: 1,
      items: [item],
      spaces: [],
    });
    assert.equal(
      storage.importLibrary(backup).items[0].sourceInfo.title,
      "Source",
    );
    const bad = JSON.parse(backup);
    bad.items[0].sourceInfo.url = "javascript:alert(1)";
    assert.throws(() => storage.importLibrary(JSON.stringify(bad)));
  });
  const summary = load("lib/ai/summary.ts");
  const sample = {
    title: "Web development",
    overview: "A source-based overview.",
    keyPoints: ["HTML structures content.", "CSS styles content."],
    chapters: [
      {
        title: "Markup",
        summary: "Use HTML to structure the page.",
        bullets: ["Use meaningful headings."],
        startSeconds: 12,
        sourceQuote: "exact words",
      },
    ],
    mindMap: {
      nodes: [
        { id: "root", label: "Web", detail: "Main topic" },
        { id: "html", label: "HTML", detail: "Structure", chapterIndex: 0 },
      ],
      edges: [{ source: "root", target: "html", label: "uses" }],
    },
  };
  await test("Rich summaries strip invented timestamps and quotes for plain text", () => {
    const value = summary.validateSummary(sample, {
      source: "A pasted summary without timestamps.",
    });
    assert.equal(value.chapters[0].startSeconds, undefined);
    assert.equal(value.chapters[0].timestampKind, "none");
    assert.equal(value.chapters[0].sourceQuote, undefined);
    const timed = summary.validateSummary(sample, {
      source: "[00:12] exact words",
    });
    assert.equal(timed.chapters[0].startSeconds, 12);
    assert.equal(timed.chapters[0].timestampKind, "source");
    assert.equal(timed.chapters[0].sourceQuote, "exact words");
    assert.equal(
      summary.validateSummary(sample, { video: true }).chapters[0]
        .timestampKind,
      "approximate",
    );
    assert.deepEqual(
      summary.sourceTimes(
        c.captionText([{ start: 43212, end: 43215, text: "Long video" }]),
      ),
      [43212],
    );
  });
  await test("Mind-map validation rejects unknown nodes, duplicates and disconnected graphs", () => {
    for (const map of [
      { ...sample.mindMap, edges: [{ source: "root", target: "missing" }] },
      {
        ...sample.mindMap,
        nodes: [
          ...sample.mindMap.nodes,
          { id: "html", label: "Duplicate", detail: "" },
        ],
      },
      {
        ...sample.mindMap,
        nodes: [
          ...sample.mindMap.nodes,
          { id: "alone", label: "Disconnected", detail: "" },
        ],
      },
    ])
      assert.throws(() => summary.validateSummary({ ...sample, mindMap: map }));
  });
  await test("Video chapters keep absolute times within the requested scope only", () => {
    const range = { startSeconds: 43200, endSeconds: 45000 };
    for (const time of [12, 43199, 45000, 50000]) {
      const data = {
        ...sample,
        chapters: [
          {
            ...sample.chapters[0],
            startSeconds: time,
            timestampKind: "source",
          },
        ],
      };
      assert.equal(
        summary.validateSummary(data, {
          video: true,
          range,
          source: `[${summary.formatTime(time)}] words`,
        }).chapters[0].startSeconds,
        undefined,
      );
      assert.equal(
        summary.validateSummary(data, { restore: true, range }).chapters[0]
          .startSeconds,
        undefined,
      );
    }
    const data = {
      ...sample,
      chapters: [{ ...sample.chapters[0], startSeconds: 43260 }],
    };
    assert.equal(
      summary.validateSummary(data, { video: true, range }).chapters[0]
        .startSeconds,
      43260,
    );
    assert.equal(
      summary.validateSummary(data, { video: true, range }).chapters[0]
        .timestampKind,
      "approximate",
    );
  });
  await test("Summary route requests structured JSON and returns rendered text plus validated graph", async () => {
    const result = await router.routeAI(
      { ...input, task: "summary" },
      async (url, opts) => {
        const body = JSON.parse(opts.body);
        assert.equal(
          body.generationConfig.responseMimeType,
          "application/json",
        );
        assert.equal(body.generationConfig.maxOutputTokens, 7200);
        return Response.json({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: JSON.stringify(sample) }] },
            },
          ],
        });
      },
    );
    assert.equal(result.summary.mindMap.nodes.length, 2);
    assert.ok(result.text.startsWith("# Web development"));
    assert.equal(result.summary.chapters[0].startSeconds, undefined);
    assert.ok(!result.text.includes("00:12"));
    assert.throws(
      () =>
        ai.validateStructured(
          "summary",
          '{"error":"SOURCE_UNAVAILABLE"}',
          input,
        ),
      checkCode("SOURCE_UNAVAILABLE"),
    );
  });
  await test("Truncated or oversized rich summaries cannot be saved as valid output", async () => {
    await assert.rejects(
      () =>
        router.routeAI({ ...input, task: "summary" }, async () =>
          Response.json({
            candidates: [
              {
                finishReason: "MAX_TOKENS",
                content: { parts: [{ text: '{"title":"Partial' }] },
              },
            ],
          }),
        ),
      checkCode("INCOMPLETE_RESPONSE"),
    );
    assert.throws(() =>
      summary.validateSummary({ ...sample, overview: "x".repeat(6001) }),
    );
    assert.throws(() =>
      summary.validateSummary({
        ...sample,
        chapters: Array.from({ length: 25 }, () => sample.chapters[0]),
      }),
    );
  });
  await test("Summary artifacts survive backup and keep source identity without secrets", () => {
    const storage = load("lib/lumio/storage.ts"),
      types = load("lib/lumio/types.ts"),
      value = summary.validateSummary(sample, {
        source: "[00:12] exact words",
      });
    const item = types.createItem({
      title: "Lesson",
      kind: "text",
      text: "[00:12] exact words",
      artifacts: [
        {
          id: "artifact1",
          kind: "summary",
          createdAt: new Date().toISOString(),
          summary: value,
          source: {
            kind: "captions",
            title: "My captions",
            contentLength: 100,
          },
        },
      ],
    });
    const restored = storage.importLibrary(
      storage.exportLibrary({ version: 1, items: [item], spaces: [] }),
    );
    assert.equal(
      restored.items[0].artifacts[0].summary.chapters[0].startSeconds,
      12,
    );
    assert.equal(restored.items[0].artifacts[0].source.kind, "captions");
    const mismatched = storage.importLibrary(
      storage.exportLibrary({
        version: 1,
        items: [
          { ...item, text: "A different source without any timestamp cue." },
        ],
        spaces: [],
      }),
    );
    assert.equal(
      mismatched.items[0].artifacts[0].summary.chapters[0].startSeconds,
      undefined,
      "A restored timestamp cannot claim literal-source verification after source text changed",
    );
    assert.equal(
      mismatched.items[0].artifacts[0].summary.chapters[0].sourceQuote,
      undefined,
      "A restored quote must still exist in the restored text",
    );
  });
  await test("Backups preserve bounded captured frames and requested video ranges, rejecting remote images", () => {
    const storage = load("lib/lumio/storage.ts"),
      types = load("lib/lumio/types.ts");
    const artifact = {
      id: "video-summary",
      kind: "summary",
      createdAt: new Date().toISOString(),
      summary: summary.validateSummary(sample, { video: true }),
      source: {
        kind: "media",
        title: "My video",
        contentLength: 0,
        range: { startSeconds: 0, endSeconds: 600 },
      },
      frames: [
        {
          url: "data:image/jpeg;base64,YWJj",
          seconds: 12,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    const item = types.createItem({
      title: "Video",
      kind: "video",
      artifacts: [artifact],
    });
    const backup = storage.exportLibrary({
      version: 1,
      items: [item],
      spaces: [],
    });
    const result = storage.importLibrary(backup).items[0].artifacts[0];
    assert.deepEqual(result.source.range, { startSeconds: 0, endSeconds: 600 });
    assert.equal(result.frames[0].seconds, 12);
    for (const url of [
      "https://example.com/unrelated.jpg",
      "data:image/svg+xml;base64,YWJj",
      "data:image/jpeg;base64," + "Y".repeat(250000),
    ]) {
      const bad = JSON.parse(backup);
      bad.items[0].artifacts[0].frames[0].url = url;
      assert.throws(() => storage.importLibrary(JSON.stringify(bad)));
    }
    const bad = JSON.parse(backup);
    bad.items[0].artifacts[0].source.range.endSeconds = 1801;
    assert.throws(() => storage.importLibrary(JSON.stringify(bad)));
  });
  console.log(
    `${count} ingestion/tutor checks passed; no network or real credentials used.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
