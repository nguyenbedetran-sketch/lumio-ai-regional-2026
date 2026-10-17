const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
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
const meta = load("lib/metadata.ts"),
  robots = load("app/robots.ts").default,
  sitemap = load("app/sitemap.ts").default;
const previousUrl = process.env.NEXT_PUBLIC_SITE_URL,
  previousIndex = process.env.LUMIO_PUBLIC_INDEXING;
let passed = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  passed++;
}
try {
  test("Install metadata links a public manifest with the actual existing icon dimensions", () => {
    const manifest = load("app/manifest.ts").default();
    assert.equal(meta.siteMetadata.manifest, "/manifest.webmanifest");
    assert.equal(manifest.id, "/");
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.display, "standalone");
    for (const icon of manifest.icons) {
      assert.match(icon.src, /^\/brand\/[A-Za-z0-9.-]+\.png$/);
      const bytes = fs.readFileSync(path.join(root, "public", icon.src));
      assert.equal(
        icon.sizes,
        `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,
      );
      assert.equal(icon.purpose, "any");
    }
    assert.equal(manifest.shortcuts, undefined);
    assert.equal(/offline/i.test(JSON.stringify(manifest)), false);
  });
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.LUMIO_PUBLIC_INDEXING;
  test("Local review has no public origin, canonical, sitemap or structured data", () => {
    assert.equal(meta.publicOrigin(), null);
    assert.equal(meta.publicSiteSchema(), null);
    assert.deepEqual(sitemap(), []);
    assert.deepEqual(robots().rules, { userAgent: "*", disallow: "/" });
    const page = meta.pageMetadata({
      title: "Test",
      description: "Test",
      path: "/privacy",
    });
    assert.equal(page.robots.index, false);
    assert.equal(page.alternates, undefined);
  });
  test("Invalid, private and example public URL configurations are rejected", () => {
    for (const url of [
      "not-url",
      "http://lumio-study.vercel.app",
      "https://127.0.0.1",
      "https://[::1]",
      "https://localhost",
      "https://x.localhost.",
      "https://example.com",
      "https://sub.example.org",
      "https://lumio.test",
      "https://user:password@lumio-study.vercel.app",
      "https://lumio-study.vercel.app/path",
      "https://lumio-study.vercel.app/?token=anything",
    ]) {
      process.env.NEXT_PUBLIC_SITE_URL = url;
      assert.equal(meta.publicOrigin(), null, url);
    }
  });
  test("A configured origin alone does not enable indexing", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://lumio-study.vercel.app";
    process.env.LUMIO_PUBLIC_INDEXING = "false";
    assert.equal(meta.publicOrigin(), "https://lumio-study.vercel.app");
    assert.equal(meta.publicIndexing(), false);
    assert.deepEqual(sitemap(), []);
    assert.equal(meta.publicSiteSchema(), null);
  });
  test("Explicit public indexing includes only actual public policy routes", () => {
    process.env.LUMIO_PUBLIC_INDEXING = "true";
    assert.deepEqual(
      sitemap().map((entry) => entry.url),
      [
        "https://lumio-study.vercel.app/privacy",
        "https://lumio-study.vercel.app/terms",
        "https://lumio-study.vercel.app/data-deletion",
      ],
    );
    const policy = meta.pageMetadata({
      title: "Privacy",
      description: "Privacy description",
      path: "/privacy",
    });
    assert.equal(policy.robots.index, true);
    assert.equal(
      policy.alternates.canonical,
      "https://lumio-study.vercel.app/privacy",
    );
    const admin = meta.pageMetadata({
      title: "Admin",
      description: "Private",
      path: "/admin",
      privatePage: true,
    });
    assert.equal(admin.robots.index, false);
    assert.equal(admin.robots.follow, false);
    assert.ok(robots().rules.disallow.includes("/api/"));
  });
  test("Structured data has only factual software/site fields and no fake ratings or offers", () => {
    const raw = meta.publicSiteSchema(),
      schema = JSON.parse(raw);
    assert.equal(schema["@graph"][0]["@type"], "WebSite");
    assert.equal(schema["@graph"][1]["@type"], "SoftwareApplication");
    for (const field of [
      "aggregateRating",
      "offers",
      "address",
      "foundingDate",
      "price",
    ])
      assert.ok(!raw.includes(`\"${field}\"`));
    assert.ok(!raw.includes("<"));
  });
  console.log(`\n${passed} metadata/SEO checks passed.`);
} finally {
  if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = previousUrl;
  if (previousIndex === undefined) delete process.env.LUMIO_PUBLIC_INDEXING;
  else process.env.LUMIO_PUBLIC_INDEXING = previousIndex;
}
