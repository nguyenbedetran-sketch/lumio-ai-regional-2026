import type { SQLInputValue, SQLOutputValue } from "node:sqlite";
import { PlatformError } from "./types";

/** The SQL subset actually used by Lumio's stores; no ORM or public SQL API. */
export interface DatabaseStatement {
  get(...params: SQLInputValue[]): Record<string, SQLOutputValue> | undefined;
  all(...params: SQLInputValue[]): Record<string, SQLOutputValue>[];
  run(...params: SQLInputValue[]): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
}
export interface DatabaseConnection {
  prepare(sql: string): DatabaseStatement;
  exec(sql: string): void;
  close(): void;
  readonly mode?: "local-sqlite" | "remote-libsql";
  beginBootstrap?(): void;
  endBootstrap?(): void;
  beginTransaction?(): void;
  endTransaction?(): void;
  readonly poisoned?: boolean;
}
export type DatabaseMode = "local-sqlite" | "remote-libsql";
export type DatabaseBudgets = {
  rpcMs: number;
  transactionMs: number;
  bootstrapMs: number;
};
export class DatabaseConnectionError extends PlatformError {
  constructor(
    code:
      | "DATABASE_CONFIGURATION_INVALID"
      | "DATABASE_UNAVAILABLE"
      | "DATABASE_TIMEOUT"
      | "DATABASE_WRITE_OUTCOME_UNKNOWN"
      | "DATABASE_CONNECTION_POISONED"
      | "DATABASE_PROTOCOL_ERROR"
      | "DATABASE_RESPONSE_TOO_LARGE",
  ) {
    super(code, 503);
  }
}
function limit(value: string | undefined, fallback: number, max: number) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 100 || parsed > max)
    throw new DatabaseConnectionError("DATABASE_CONFIGURATION_INVALID");
  return parsed;
}
/** Secret-bearing configuration is consumed only by the server factory. */
export function databaseConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const mode = env.LUMIO_DATABASE_MODE || "local-sqlite";
  if (mode !== "local-sqlite" && mode !== "remote-libsql")
    throw new DatabaseConnectionError("DATABASE_CONFIGURATION_INVALID");
  if (mode === "local-sqlite") {
    if (env.TURSO_DATABASE_URL || env.TURSO_AUTH_TOKEN)
      throw new DatabaseConnectionError("DATABASE_CONFIGURATION_INVALID");
    return { mode } as const;
  }
  let endpoint: URL;
  try { endpoint = new URL(env.TURSO_DATABASE_URL || ""); }
  catch { throw new DatabaseConnectionError("DATABASE_CONFIGURATION_INVALID"); }
  const token = env.TURSO_AUTH_TOKEN;
  if (
    !["libsql:", "https:"].includes(endpoint.protocol) ||
    !/^[a-z0-9.-]+\.turso\.io$/.test(endpoint.hostname) ||
    endpoint.username || endpoint.password || endpoint.port || endpoint.search || endpoint.hash ||
    (endpoint.pathname !== "" && endpoint.pathname !== "/") ||
    !token || token.length > 8192 || /[\r\n\0]/.test(token)
  ) throw new DatabaseConnectionError("DATABASE_CONFIGURATION_INVALID");
  return {
    mode,
    url: endpoint.toString(),
    authToken: token,
    budgets: {
      rpcMs: limit(env.LUMIO_DATABASE_RPC_TIMEOUT_MS, 8000, 15000),
      transactionMs: limit(env.LUMIO_DATABASE_TRANSACTION_TIMEOUT_MS, 15000, 30000),
      bootstrapMs: limit(env.LUMIO_DATABASE_BOOTSTRAP_TIMEOUT_MS, 60000, 120000),
    },
  } as const;
}
