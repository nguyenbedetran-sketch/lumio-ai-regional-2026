// No provider calls: re-process a saved actual provider response through the current validator.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { load } = require("./source-grounding.cjs");
const root = path.resolve(__dirname, ".."),
  file = path.join(root, "docs/regional/content-live-evaluation.json");
const report = JSON.parse(fs.readFileSync(file, "utf8")),
  saved = report.results.find((r) => r.task === "cards");
assert.ok(
  saved?.output?.text && report.fixture?.authored === true,
  "Requires the authored live content fixture report",
);
const ai = load("lib/ai/contracts.ts"),
  input = ai.validateInput({
    task: "cards",
    source: report.fixture.source,
    language: "vi",
  }),
  result = ai.validateStructured("cards", saved.output.text, input);
assert.equal(result.cards.length, 5);
assert.equal(result.quality.citedItems, 5);
assert.ok(
  result.cards.every(
    (c) => c.references?.length && !/\n\s*References:/i.test(c.back),
  ),
);
assert.ok(result.cards[1].back.includes("x ≠ 1"));
assert.ok(result.cards[2].back.includes("vô nghiệm"));
assert.ok(result.cards[3].back.includes("x ≥ −1"));
assert.ok(result.cards[4].back.includes("24 cm²"));
const output = {
  status: "PASS",
  checks: 8,
  checkedAt: new Date().toISOString(),
  actualProviderResponse: true,
  providerRequests: 0,
  sourceReport: "content-live-evaluation.json",
  initialStructuredCitationCount: saved.output.cards.filter(
    (c) => c.references?.length,
  ).length,
  currentValidatedCitationCount: result.quality.citedItems,
  normalizedResult: result,
  explanation:
    "Saved actual provider output had explicit References JSON inside back strings. The updated validator extracts only valid JSON references with exact matching quotes, strips that metadata suffix, and preserves mathematical answer text. This is offline parser revalidation, not a new provider generation or independent semantic proof.",
};
fs.writeFileSync(
  path.join(root, "docs/regional/content-offline-revalidation.json"),
  JSON.stringify(output, null, 2) + "\n",
);
console.log(
  "PASS saved actual 5-card response: 5 exact citations recovered safely, conditions and numerical answers preserved; 8 offline checks, zero provider calls.",
);
