import { MessageChannel, receiveMessageOnPort, Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { serialize } from "node:v8";
import type { SQLInputValue } from "node:sqlite";
import {
  DatabaseConnectionError,
  type DatabaseBudgets,
  type DatabaseConnection,
  type DatabaseStatement,
} from "./database-connection";

const PACKET_LIMIT = 32 * 1024 * 1024;
const DEFAULT_BUDGETS: DatabaseBudgets = { rpcMs: 8000, transactionMs: 15000, bootstrapMs: 60000 };
type Request = { op: "exec" | "get" | "all" | "run" | "close"; sql?: string; args?: SQLInputValue[] };
type Reply = { id: number; ok: boolean; value?: unknown; error?: { kind: "sql" | "transport" | "size" | "timeout"; code?: string; guard?: string } };
const processState = globalThis as typeof globalThis & { __lumioDatabaseChildren?: Set<Int32Array> };
function killNativeChild(signal: Int32Array) {
  const pid = Atomics.load(signal, 1);
  if (pid > 0) { try { process.kill(pid, "SIGKILL"); } catch { /* Already exited. */ } }
}
if (!processState.__lumioDatabaseChildren) {
  processState.__lumioDatabaseChildren = new Set();
  process.once("exit", () => { for (const signal of processState.__lumioDatabaseChildren!) killNativeChild(signal); });
}
function nativeEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|LANG|LC_ALL|SSL_CERT_FILE|SSL_CERT_DIR|NODE_EXTRA_CA_CERTS)$/i.test(key))) as Record<string, string>;
}

/**
 * Internal SQL port, never reachable as an HTTP endpoint. Production callers
 * must use databaseConfiguration; constructor injection exists for isolated tests.
 * Calls wait on the main thread, bounded by RPC AND aggregate bootstrap/txn limits.
 */
export class SqliteWorkerConnection implements DatabaseConnection {
  readonly mode = "remote-libsql" as const;
  private readonly worker: Worker;
  private readonly port: MessagePortLike;
  private readonly signal = new Int32Array(new SharedArrayBuffer(8));
  private readonly budgets: DatabaseBudgets;
  private readonly nativeBroker: boolean;
  private nextId = 0;
  private closed = false;
  private broken = false;
  private inFlight = false;
  private bootstrapDeadline = Infinity;
  private transactionDeadline = Infinity;
  private transactionWrites = false;

  constructor(options: {
    url: string;
    authToken?: string;
    budgets?: Partial<DatabaseBudgets>;
    /** Server-internal test fixture only; never filled from env or requests. */
    workerFile?: string;
    workerExtra?: Record<string, unknown>;
  }) {
    this.nativeBroker = !options.workerFile;
    this.budgets = { ...DEFAULT_BUDGETS, ...options.budgets };
    for (const value of Object.values(this.budgets)) {
      if (!Number.isSafeInteger(value) || value < 1 || value > 120000)
        throw new DatabaseConnectionError("DATABASE_CONFIGURATION_INVALID");
    }
    const channel = new MessageChannel();
    this.port = channel.port1;
    this.port.unref();
    // Tracing anchor only: retain libsql's dependency graph and pnpm links in
    // Next's standalone package. This resolves a module ID without loading
    // native code on the main thread; the ID is never passed to the child.
    void require.resolve("libsql");
    this.worker = new Worker(options.workerFile || resolve(process.cwd(), "scripts/database-worker.cjs"), {
      // Pass a package directory, not require.resolve(): Webpack rewrites that
      // call into its module ID. Native Node in the unbundled child resolves
      // this absolute directory and its real pnpm dependencies itself.
      workerData: { ...options.workerExtra, url: options.url, authToken: options.authToken || "", port: channel.port2, signal: this.signal.buffer, packetLimit: PACKET_LIMIT, rpcMs: this.budgets.rpcMs, driverPath: resolve(process.cwd(), "node_modules/libsql") },
      transferList: [channel.port2],
      env: { ...nativeEnvironment(), RUST_LOG: "off", RUST_BACKTRACE: "0" },
      stdout: true,
      stderr: true,
    });
    if (this.nativeBroker) processState.__lumioDatabaseChildren!.add(this.signal);
    this.worker.unref();
    // The broker also discards native child's OS stdout/stderr streams.
    this.worker.stdout?.on("data", () => {});
    this.worker.stderr?.on("data", () => {});
    this.worker.on("error", () => this.poison());
    this.worker.on("exit", () => {
      if (!this.closed) this.poison();
      this.port.close();
      processState.__lumioDatabaseChildren!.delete(this.signal);
    });
    try { this.waitFor(0, performance.now() + this.budgets.rpcMs, false); }
    catch (error) { this.poison(); throw error; }
  }
  get poisoned() { return this.broken || this.closed; }
  private poison() {
    if (this.broken || this.closed) return;
    this.broken = true;
    if (this.nativeBroker) {
      // Native calls cannot be preempted by terminating a Worker. Its dedicated
      // OS child is killed directly; keep the JS broker alive until it reaps it.
      killNativeChild(this.signal);
      this.worker.ref();
      try { this.port.postMessage({ op: "abort" }); } catch {}
      this.port.close();
      return;
    }
    this.port.close();
    // Internal test fixtures contain no native child.
    void this.worker.terminate().catch(() => {});
    this.worker.unref();
  }
  private waitFor(id: number, deadline: number, uncertainWrite: boolean): unknown {
    const checkDeadline = () => {
      if (performance.now() >= deadline) {
        this.poison();
        throw new DatabaseConnectionError(uncertainWrite ? "DATABASE_WRITE_OUTCOME_UNKNOWN" : "DATABASE_TIMEOUT");
      }
    };
    while (true) {
      checkDeadline();
      const received = receiveMessageOnPort(this.port);
      if (received) {
        // Deserialization itself consumes the aggregate budget; late ACKs do not
        // turn an expired mutation into a reported success.
        checkDeadline();
        const reply = received.message as Reply;
        if (!reply || reply.id !== id || typeof reply.ok !== "boolean") {
          this.poison();
          throw new DatabaseConnectionError(uncertainWrite ? "DATABASE_WRITE_OUTCOME_UNKNOWN" : "DATABASE_PROTOCOL_ERROR");
        }
        if (reply.ok) return reply.value;
        if (reply.error?.kind === "sql" && /^SQLITE_[A-Z_]+$/.test(reply.error.code || "")) {
          const guard = ["AUDIT_APPEND_ONLY", "LEDGER_APPEND_ONLY", "TEACHING_HISTORY_IMMUTABLE"].includes(reply.error.guard || "") ? reply.error.guard : undefined;
          const error = new Error(guard || reply.error.code);
          Object.assign(error, { code: reply.error.code });
          throw error;
        }
        this.poison();
        throw new DatabaseConnectionError(uncertainWrite ? "DATABASE_WRITE_OUTCOME_UNKNOWN" : reply.error?.kind === "size" ? "DATABASE_RESPONSE_TOO_LARGE" : reply.error?.kind === "timeout" ? "DATABASE_TIMEOUT" : "DATABASE_UNAVAILABLE");
      }
      const remaining = deadline - performance.now();
      if (remaining <= 0) {
        this.poison();
        throw new DatabaseConnectionError(uncertainWrite ? "DATABASE_WRITE_OUTCOME_UNKNOWN" : "DATABASE_TIMEOUT");
      }
      // Message is posted before notify; short wake polling also tolerates early wakeups.
      Atomics.wait(this.signal, 0, 0, Math.min(remaining, 20));
    }
  }
  private rpc(request: Request) {
    if (this.closed || this.broken) throw new DatabaseConnectionError("DATABASE_CONNECTION_POISONED");
    if (this.inFlight) throw new DatabaseConnectionError("DATABASE_PROTOCOL_ERROR");
    const mutation = request.op !== "close" && (request.op === "run" || !/^\s*(?:SELECT|EXPLAIN)\b/i.test(request.sql || ""));
    const uncertainWrite = mutation || this.transactionWrites;
    const deadline = Math.min(performance.now() + this.budgets.rpcMs, this.bootstrapDeadline, this.transactionDeadline);
    if (deadline <= performance.now()) {
      this.poison();
      throw new DatabaseConnectionError(this.transactionWrites ? "DATABASE_WRITE_OUTCOME_UNKNOWN" : "DATABASE_TIMEOUT");
    }
    const id = ++this.nextId;
    const message = { ...request, id, timeoutMs: Math.max(1, Math.floor(deadline - performance.now())) };
    try {
      if (serialize(message).byteLength > PACKET_LIMIT) throw new DatabaseConnectionError("DATABASE_RESPONSE_TOO_LARGE");
    } catch (error) {
      if (error instanceof DatabaseConnectionError) throw error;
      throw new DatabaseConnectionError("DATABASE_PROTOCOL_ERROR");
    }
    this.inFlight = true;
    if (Number.isFinite(this.transactionDeadline) && mutation) this.transactionWrites = true;
    try {
      Atomics.store(this.signal, 0, 0);
      this.port.postMessage(message);
      return this.waitFor(id, deadline, uncertainWrite);
    } catch (error) {
      if (error instanceof DatabaseConnectionError || (error instanceof Error && /^SQLITE_[A-Z_]+$/.test(String((error as { code?: string }).code)))) throw error;
      this.poison();
      throw new DatabaseConnectionError(uncertainWrite ? "DATABASE_WRITE_OUTCOME_UNKNOWN" : "DATABASE_UNAVAILABLE");
    } finally { this.inFlight = false; }
  }
  prepare(sql: string): DatabaseStatement {
    if (typeof sql !== "string" || !sql || sql.length > 2 * 1024 * 1024) throw new DatabaseConnectionError("DATABASE_PROTOCOL_ERROR");
    return {
      get: (...args) => this.rpc({ op: "get", sql, args }) as ReturnType<DatabaseStatement["get"]>,
      all: (...args) => this.rpc({ op: "all", sql, args }) as ReturnType<DatabaseStatement["all"]>,
      run: (...args) => this.rpc({ op: "run", sql, args }) as ReturnType<DatabaseStatement["run"]>,
    };
  }
  exec(sql: string) { this.rpc({ op: "exec", sql }); }
  beginBootstrap() { this.bootstrapDeadline = performance.now() + this.budgets.bootstrapMs; }
  endBootstrap() { this.bootstrapDeadline = Infinity; }
  beginTransaction() {
    if (Number.isFinite(this.transactionDeadline)) throw new DatabaseConnectionError("DATABASE_PROTOCOL_ERROR");
    this.transactionDeadline = performance.now() + this.budgets.transactionMs;
    this.transactionWrites = false;
  }
  endTransaction() { this.transactionDeadline = Infinity; this.transactionWrites = false; }
  close() {
    if (this.closed) return;
    try { if (!this.broken) this.rpc({ op: "close" }); }
    finally {
      this.closed = true;
      if (!this.nativeBroker || this.broken) this.port.close();
      // The broker reaps a healthy native child; forced OS kill is for poison.
      if (this.nativeBroker) this.worker.ref(); else this.worker.unref();
    }
  }
}
type MessagePortLike = import("node:worker_threads").MessagePort;
