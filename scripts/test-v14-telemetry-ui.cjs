/* Existing actual-component acceptance suite, isolated output and new metrics.
 * Every HTTP request is intercepted. No live account, provider or database. */
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), crypto = require("node:crypto"), { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."), work = "work/v14-telemetry-ui", evidence = "docs/next/reports/v14-telemetry", session = "v14-telemetry-" + process.pid;
const filename = path.join(root, "tests/v7-usage-ui-fixture.cjs"), fixtureModule = new Module(filename, module);
fixtureModule.filename = filename; fixtureModule.paths = Module._nodeModulePaths(path.dirname(filename));
fixtureModule._compile(fs.readFileSync(filename, "utf8").replaceAll("work/v7-usage-ui", work), filename);
const fixture = fixtureModule.exports.build();
let browser = fs.readFileSync(path.join(root, "tests/v7-usage-ui.browser.js"), "utf8").replaceAll("work/v7-usage-ui", work).replaceAll("docs/v7/qa-", evidence + "/qa-");
function insert(anchor, text) { if (!browser.includes(anchor)) throw Error("FIXTURE_ANCHOR_MISSING:" + anchor); browser = browser.replace(anchor, text); }
insert("    averageLatencyMs: 1200,\n", "    averageLatencyMs:1200, p50LatencyMs:900,p95LatencyMs:1900,latencyRecords:2,observedLatencyRecords:null,recordedErrorRatio:0.5,httpStatusRecords:null,httpStatusCoverage:null,httpErrorRatio:null,\n");
insert("    averageLatencyMs: 1200,\n", "    averageLatencyMs:1200, p50LatencyMs:900,p95LatencyMs:1900,latencyRecords:3,observedLatencyRecords:3,httpStatusRecords:2,httpStatusCoverage:0.4,httpErrorRatio:0.5,\n");
insert("    averageLatencyMs: 0,", "    averageLatencyMs: 0,p50LatencyMs:0,p95LatencyMs:0,latencyRecords:2,observedLatencyRecords:2,httpStatusRecords:2,httpStatusCoverage:1,httpErrorRatio:0,");
insert("      attempts: 7,", "      attempts: 7,httpStatusRecords:4,httpStatusCoverage:4/7,httpErrorRatio:0.25,latencyRecords:5,observedLatencyRecords:5,");
insert('    await page.getByLabel("Loại báo cáo").selectOption("attempts");', `
    const newOutcomeText=await body().innerText();
    check(newOutcomeText.includes("p50 900 ms")&&newOutcomeText.includes("p95 1.900 ms"),"Outcome quantiles show recorded fixture values");
    check(newOutcomeText.includes("số giá trị đo thực chưa xác định")&&newOutcomeText.includes("có thể lưu 0"),"Outcome observed count remains unknown with legacy-zero provenance");
    check(/50\\s*%/.test(newOutcomeText)&&newOutcomeText.includes("HTTP chưa được lưu"),"Outcome error ratio is separate from missing HTTP metadata");
    await page.getByLabel("Loại báo cáo").selectOption("attempts");`);
insert("    const diagnosticText = await page", `
    check(attemptText.includes("p50 900 ms")&&attemptText.includes("p95 1.900 ms"),"Attempt nearest-rank values are visible");
    check(/25\\s*%/.test(attemptText)&&/57,1\\s*%/.test(attemptText),"Attempt HTTP error ratio and status coverage display distinct denominators");
    check(attemptText.includes("p50 0 ms")&&attemptText.includes("p95 0 ms"),"Observed zero quantiles render as zero rather than unknown");
    check(attemptText.includes("không được tự tính thành thành công hoặc lỗi HTTP"),"Unresolved attempts are not labelled HTTP success/error");
    const diagnosticText = await page`);
browser = browser.trim().replace(/;$/, "");
const browserFile = path.join(root, work, "browser.js"); fs.writeFileSync(browserFile, browser);
fs.mkdirSync(path.join(root, evidence), { recursive: true });
const cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js");
function call(...args) {
  const result = spawnSync(process.execPath, [cli, "-s=" + session, ...args, "--json"], { cwd: root, encoding: "utf8", timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw result.error || Error(result.stderr || result.stdout || "CLI_FAILURE");
  const value = JSON.parse(result.stdout); if (value.isError || value.error) throw Error(JSON.stringify(value)); return value;
}
try {
  call("open", "about:blank", "--browser=msedge");
  const response = call("run-code", "--filename=" + work + "/browser.js");
  const result = typeof response.result === "string" ? JSON.parse(response.result) : response.result;
  if (!result || !["PASS", "FAIL"].includes(result.status)) throw Error("BROWSER_DID_NOT_EXECUTE");
  const report = { ...result, checkedAt: new Date().toISOString(), sourceSha256: fixture.sourceSha256, cssSha256: fixture.cssSha256, browserSha256: crypto.createHash("sha256").update(browser).digest("hex"), scope: "Actual UsageBreakdownPanel/CSS, synthetic authored metrics and intercepted HTTP only. Keyboard/races/390-768-1440 layout and metric rendering; not actual admin telemetry, provider costs, device or backend authorization proof." };
  fs.writeFileSync(path.join(root, evidence, "browser.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2)); if (report.status !== "PASS") process.exitCode = 1;
} finally { try { call("close"); } catch {} }
