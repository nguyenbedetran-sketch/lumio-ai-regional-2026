"use strict";
// Pure JS broker only: a blocked native child can always be killed by watchdog.
const { workerData } = require("node:worker_threads");
const { fork } = require("node:child_process");
const { resolve } = require("node:path");
const { serialize } = require("node:v8");
const { port, signal: signalBuffer, packetLimit } = workerData;
const signal = new Int32Array(signalBuffer);
let child, pending = 0, timer, ended = false, closing = false, closeReply;
function send(message) {
  if (ended) return;
  if (serialize(message).byteLength > packetLimit) message = { id: message.id, ok: false, error: { kind: "size" } };
  try { port.postMessage(message); Atomics.store(signal, 0, 1); Atomics.notify(signal, 0); } catch { stop(); }
}
function stop() {
  if (ended) return;
  ended = true; clearTimeout(timer);
  // Keep the child handle until exit confirms OS termination; no restart.
  if (child && child.exitCode === null && child.signalCode === null) {
    try { child.kill("SIGKILL"); } catch {}
  } else { Atomics.store(signal, 1, 0); port.close(); }
}
function arm(ms) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    send({ id: pending, ok: false, error: { kind: "timeout" } });
    stop();
  }, Math.max(1, Math.min(Number(ms) || workerData.rpcMs, 120000)));
}
try {
  child = fork(resolve(__dirname, "database-child.cjs"), [], {
    execPath: process.execPath, execArgv: [], serialization: "advanced",
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { ...process.env, RUST_LOG: "off", RUST_BACKTRACE: "0" },
  });
  // Store PID before initialize can enter native code. Main can kill it even if
  // the broker itself unexpectedly stops responding.
  if (child.pid) Atomics.store(signal, 1, child.pid);
  child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
  child.on("error", () => { send({ id: pending, ok: false, error: { kind: "transport" } }); stop(); });
  child.on("exit", (code) => {
    Atomics.store(signal, 1, 0); clearTimeout(timer);
    if (!ended) {
      if (closing && closeReply && code === 0) send(closeReply);
      else send({ id: pending, ok: false, error: { kind: "transport" } });
    }
    ended = true; port.close();
  });
  child.on("message", (reply) => {
    if (ended) return;
    clearTimeout(timer);
    if (!reply || reply.id !== pending || typeof reply.ok !== "boolean") {
      send({ id: pending, ok: false, error: { kind: "transport" } }); stop(); return;
    }
    // A healthy close ACK means the OS child has actually exited, including all
    // native file handles; only then may a caller reopen/remove its test file.
    if (closing && reply.ok) { closeReply = reply; arm(workerData.rpcMs); return; }
    send(reply);
    if (reply.error && reply.error.kind !== "sql") { stop(); return; }
    pending = null;
    if (closing) arm(workerData.rpcMs);
  });
  arm(workerData.rpcMs);
  child.send({ op: "initialize", id: 0, url: workerData.url, authToken: workerData.authToken, packetLimit, driverPath: workerData.driverPath });
} catch { send({ id: 0, ok: false, error: { kind: "transport" } }); stop(); }
port.on("message", (message) => {
  if (message?.op === "abort") { stop(); return; }
  if (ended) return;
  if (pending !== null || !Number.isSafeInteger(message?.id) || serialize(message).byteLength > packetLimit) {
    send({ id: message?.id, ok: false, error: { kind: "transport" } }); stop(); return;
  }
  pending = message.id; closing = message.op === "close";
  arm(message.timeoutMs);
  try { child.send(message, (error) => { if (error) { send({ id: pending, ok: false, error: { kind: "transport" } }); stop(); } }); }
  catch { send({ id: pending, ok: false, error: { kind: "transport" } }); stop(); }
});
port.on("close", stop);
