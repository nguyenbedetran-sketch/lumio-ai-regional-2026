// Explicit Playwright CLI smoke run in its own non-persistent browser session.
// Never attach to the user's browser or load authentication state.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js");
const premium = process.argv.includes("--premium");
const dashboard = process.argv.includes("--dashboard");
const meeting = process.argv.includes("--meeting");
const fullSummary = process.argv.includes("--full-summary");
const readout = process.argv.includes("--readout");
const regionalLearning = process.argv.includes("--regional-learning");
const regionalSources = process.argv.includes("--regional-sources");
const regionalTutor = process.argv.includes("--regional-tutor");
const v3Learning = process.argv.includes("--v3-learning");
const v3Rag = process.argv.includes("--v3-rag");
const v3Sync = process.argv.includes("--v3-sync");
if (
  [
    premium,
    dashboard,
    meeting,
    fullSummary,
    readout,
    regionalLearning,
    regionalSources,
    regionalTutor,
    v3Learning,
    v3Rag,
    v3Sync,
  ].filter(Boolean).length > 1
)
  throw new Error("Select one UI suite per isolated session.");
const browser =
  process.argv.slice(2).find((arg) => !arg.startsWith("--")) || "msedge";
if (!["msedge", "chrome", "firefox", "webkit"].includes(browser))
  throw new Error("Browser must be msedge, chrome, firefox or webkit.");
const session = `lumio-qa-${process.pid}-${Date.now()}`;
const reportPath = path.join(
  root,
  v3Sync
    ? "docs/v3/qa-v3-sync-report.json"
    : v3Rag
      ? "docs/v3/qa-v3-rag-report.json"
      : v3Learning
        ? "docs/v3/qa-v3-learning-report.json"
        : regionalTutor
          ? "docs/regional/qa-regional-tutor-report.json"
          : regionalSources
            ? "docs/regional/qa-regional-sources-report.json"
            : regionalLearning
              ? "docs/regional/qa-regional-learning-report.json"
              : readout
                ? "docs/qa-readout-report.json"
                : fullSummary
                  ? "docs/qa-full-summary-report.json"
                  : meeting
                    ? "docs/qa-meeting-report.json"
                    : premium
                      ? "docs/qa-premium-report.json"
                      : dashboard
                        ? "docs/qa-dashboard-v3-report.json"
                        : "docs/qa-command-report.json",
);
function saveReport(report) {
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
}
function call(...args) {
  const run = spawnSync(
    process.execPath,
    [cli, `-s=${session}`, ...args, "--json"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (run.error || run.status !== 0)
    throw (
      run.error ||
      new Error(run.stdout || run.stderr || `CLI exited ${run.status}`)
    );
  const result = JSON.parse(run.stdout);
  if (result.isError || result.error) throw new Error(JSON.stringify(result));
  return result;
}
try {
  saveReport({
    status: "RUNNING",
    browser,
    checkedAt: new Date().toISOString(),
  });
  call("open", "http://localhost:3000/", `--browser=${browser}`);
  const response = call(
    "run-code",
    v3Sync
      ? "--filename=tests/v3-sync.browser.js"
      : v3Rag
        ? "--filename=tests/v3-rag.browser.js"
        : v3Learning
          ? "--filename=tests/v3-learning.browser.js"
          : regionalTutor
            ? "--filename=tests/regional-tutor.browser.js"
            : regionalSources
              ? "--filename=tests/regional-sources.browser.js"
              : regionalLearning
                ? "--filename=tests/regional-learning.browser.js"
                : readout
                  ? "--filename=tests/readout.browser.js"
                  : fullSummary
                    ? "--filename=tests/full-summary.browser.js"
                    : meeting
                      ? "--filename=tests/meeting-capture.browser.js"
                      : premium
                        ? "--filename=tests/premium-v3.browser.js"
                        : dashboard
                          ? "--filename=tests/dashboard-v3.browser.js"
                          : "--filename=tests/command-menu.browser.js",
  );
  const result =
    typeof response.result === "string"
      ? JSON.parse(response.result)
      : response.result;
  if (!result || result.status !== "PASS")
    throw new Error(
      "UI test did not return a passing report: " +
        JSON.stringify(response).slice(0, 1800),
    );
  const report = {
    ...result,
    browser,
    tool: "@playwright/cli@0.1.21",
    checkedAt: new Date().toISOString(),
    mode: v3Sync
      ? "isolated disposable browser profile; synthetic accounts and sync HTTP fixtures; no paid AI requests"
      : "isolated guest profile; UI-only sample data; no paid AI requests",
  };
  saveReport(report);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  saveReport({
    status: "FAIL",
    browser,
    checkedAt: new Date().toISOString(),
    error: error.message.slice(0, 1500),
  });
  throw error;
} finally {
  try {
    call("close");
  } catch (error) {
    console.error("QA session cleanup:", error.message);
  }
}
