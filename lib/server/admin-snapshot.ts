import { permissionsFor, can } from "./policy";
import { getStore } from "./store";
import type { Actor } from "./types";

export function adminSnapshot(actor: Actor) {
  const store = getStore();
  return {
    actor: { id: actor.user.id, accountKey: actor.user.storageKey, name: actor.user.name, role: actor.user.role },
    permissions: permissionsFor(actor),
    dashboard: store.getDashboard(),
    users: can(actor, "users.read", { scope: "SYSTEM" })
      ? store.listUsers()
      : null,
    usage: can(actor, "ai.usage.read", { scope: "SYSTEM" })
      ? store.listUsage()
      : [],
    audit: can(actor, "audit_logs.read", { scope: "SYSTEM" })
      ? store.listAudit()
      : [],
    flags: can(actor, "features.read", { scope: "SYSTEM" })
      ? store.listFlags()
      : [],
  };
}
export type AdminSnapshot = ReturnType<typeof adminSnapshot>;
