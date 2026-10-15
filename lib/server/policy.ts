import type {
  Actor,
  Permission,
  ResourceScope,
  SystemRole,
  OrganizationRole,
} from "./types";
import { PlatformError } from "./types";

const systemGrants: Record<SystemRole, readonly Permission[]> = {
  USER: [],
  DEV: ["admin.read", "ai.usage.read", "features.read", "system.read"],
  ADMIN: [
    "admin.read",
    "users.read",
    "users.suspend",
    "users.sessions.revoke",
    "ai.usage.read",
    "features.read",
    "audit_logs.read",
    "system.read",
  ],
  SUPER_ADMIN: [
    "admin.read",
    "users.read",
    "users.suspend",
    "users.sessions.revoke",
    "users.roles.update",
    "ai.usage.read",
    "features.read",
    "features.update",
    "audit_logs.read",
    "system.read",
  ],
};
const ownGrants: readonly Permission[] = ["learning.read", "learning.update"];
const organizationGrants: Record<OrganizationRole, readonly Permission[]> = {
  OWNER: ["members.read"],
  SCHOOL_ADMIN: ["members.read"],
  TEACHER: [],
  PARENT: [],
  STUDENT: [],
};

// Organization membership alone never grants access to a student's private learning data.
// Classroom and parent relationship grants need their own explicit resource policy later.
export function can(
  actor: Actor | null,
  permission: Permission,
  resource: ResourceScope,
): boolean {
  if (!actor || actor.user.disabled) return false;
  if (resource.scope === "SYSTEM")
    return systemGrants[actor.user.role].includes(permission);
  if (resource.scope === "SELF")
    return (
      !!resource.ownerId &&
      resource.ownerId === actor.user.id &&
      ownGrants.includes(permission)
    );
  if (!resource.organizationId) return false;
  const membership = actor.memberships.find(
    (m) => m.organizationId === resource.organizationId,
  );
  return (
    !!membership && organizationGrants[membership.role].includes(permission)
  );
}
export function requirePermission(
  actor: Actor | null,
  permission: Permission,
  resource: ResourceScope = { scope: "SYSTEM" },
) {
  if (!can(actor, permission, resource))
    throw new PlatformError("FORBIDDEN", 403);
}
export function permissionsFor(actor: Actor): Permission[] {
  return actor.user.disabled ? [] : [...systemGrants[actor.user.role]];
}
export function mayBootstrapAdmin(
  identity: { provider: string; email?: string | null; emailVerified: boolean },
  emails: string[],
): boolean {
  return (
    identity.provider === "google" &&
    identity.emailVerified === true &&
    !!identity.email &&
    emails.some(
      (email) =>
        email.trim().toLowerCase() === identity.email!.trim().toLowerCase(),
    )
  );
}
