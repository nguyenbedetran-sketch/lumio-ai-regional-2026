import { databaseConfiguration, DatabaseConnectionError } from "./database-connection";
import { SqliteWorkerConnection } from "./database-remote";

const state = globalThis as typeof globalThis & { __lumioRemoteDatabaseFault?: DatabaseConnectionError };
/** A failed bootstrap is latched until process restart; never respawn per request. */
export function quarantineRemoteDatabase() {
  state.__lumioRemoteDatabaseFault ||= new DatabaseConnectionError("DATABASE_CONNECTION_POISONED");
}
export function openConfiguredRemoteDatabase(config: ReturnType<typeof databaseConfiguration>) {
  if (config.mode !== "remote-libsql") throw new DatabaseConnectionError("DATABASE_CONFIGURATION_INVALID");
  if (state.__lumioRemoteDatabaseFault) throw state.__lumioRemoteDatabaseFault;
  try { return new SqliteWorkerConnection(config); }
  catch (error) { quarantineRemoteDatabase(); throw error; }
}
