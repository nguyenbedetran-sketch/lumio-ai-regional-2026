"use strict";
// Actual generated standalone tree only, synthetic in-memory DB; no credentials.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { createRequire } = require("node:module"), { Worker, MessageChannel } = require("node:worker_threads");
const root = path.resolve(__dirname, ".."), base = path.join(root, ".next/standalone"), childFile = path.join(base, "scripts/database-child.cjs");
const req = createRequire(childFile), driverPath = fs.realpathSync(req.resolve("libsql"));
assert.ok(driverPath.startsWith(base + path.sep), "STANDALONE_DRIVER_MUST_NOT_FALL_BACK_TO_SOURCE_NODE_MODULES");
const native = req("libsql");
assert.equal(typeof native, "function");
const signal = new Int32Array(new SharedArrayBuffer(8)), { port1, port2 } = new MessageChannel();
const worker = new Worker(path.join(base, "scripts/database-worker.cjs"), { workerData: { url: ":memory:", authToken: "", port: port2, signal: signal.buffer, packetLimit: 32 * 1024 * 1024, rpcMs: 3000, driverPath }, transferList: [port2], stdout: true, stderr: true });
worker.stdout.on("data", () => {}); worker.stderr.on("data", () => {});
let next = 0, pending = new Map(), exit;
const exited = new Promise((resolve, reject) => { exit = resolve; worker.once("error", reject); worker.once("exit", (code) => code === 0 ? resolve() : reject(Error("STANDALONE_WORKER_EXIT"))); });
exited.catch(() => {});
port1.on("message", (reply) => { const waiting = pending.get(reply.id); if (!waiting) return; pending.delete(reply.id); clearTimeout(waiting.timer); reply.ok ? waiting.resolve(reply.value) : waiting.reject(Error("STANDALONE_RPC_FAILED")); });
function wait(id, message) { return new Promise((resolve, reject) => { const timer = setTimeout(() => { const pid = Atomics.load(signal, 1); if (pid > 0) { try { process.kill(pid, "SIGKILL"); } catch {} } port1.postMessage({ op: "abort" }); reject(Error("STANDALONE_TIMEOUT")); }, 5000); pending.set(id, { resolve, reject, timer }); if (message) port1.postMessage({ ...message, id, timeoutMs: 3000 }); }); }
async function main() {
  await wait(0);
  await wait(++next, { op: "exec", sql: "CREATE TABLE proof (value TEXT NOT NULL);" });
  await wait(++next, { op: "run", sql: "INSERT INTO proof(value) VALUES(?)", args: ["Tiếng Việt"] });
  assert.deepEqual(await wait(++next, { op: "get", sql: "SELECT value FROM proof", args: [] }), { value: "Tiếng Việt" });
  await wait(++next, { op: "close" });
  await exited; port1.close();
  const report = { status: "PASS", checkedAt: new Date().toISOString(), platform: process.platform, architecture: process.arch, standaloneDriver: path.relative(base, driverPath).replaceAll("\\", "/"), child: "scripts/database-child.cjs", broker: "scripts/database-worker.cjs", actualNativeSelect: true, naturalExit: true, scope: "Generated standalone tree with in-memory synthetic SQLite; no remote service or Linux claim from a Windows run" };
  fs.mkdirSync(path.join(root, "docs/v9/reports"), { recursive: true }); fs.writeFileSync(path.join(root, "docs/v9/reports/database-standalone.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; const pid = Atomics.load(signal, 1); if (pid > 0) { try { process.kill(pid, "SIGKILL"); } catch {} } port1.postMessage({ op: "abort" }); port1.close(); for (const item of pending.values()) clearTimeout(item.timer); });
