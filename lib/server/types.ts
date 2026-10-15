export type SystemRole = "USER" | "DEV" | "ADMIN" | "SUPER_ADMIN";
export type IdentityProvider = "google" | "facebook";
export type OrganizationRole =
  "OWNER" | "SCHOOL_ADMIN" | "TEACHER" | "PARENT" | "STUDENT";
export type Scope = "SELF" | "ORGANIZATION" | "SYSTEM";
export type Permission =
  | "admin.read"
  | "users.read"
  | "users.suspend"
  | "users.sessions.revoke"
  | "users.roles.update"
  | "audit_logs.read"
  | "ai.usage.read"
  | "features.read"
  | "features.update"
  | "system.read"
  | "learning.read"
  | "learning.update"
  | "members.read";

export interface User {
  id: string;
  storageKey: string;
  name: string;
  email: string | null;
  role: SystemRole;
  disabled: boolean;
  sessionVersion: number;
  createdAt: string;
  lastSeenAt: string;
}
export interface IdentityInput {
  provider: IdentityProvider;
  providerAccountId: string;
  email?: string | null;
  name?: string | null;
  emailVerified: boolean;
}
export interface IdentitySummary {
  provider: IdentityProvider;
  email: string | null;
  emailVerified: boolean;
  linkedAt: string;
}
export interface Membership {
  organizationId: string;
  role: OrganizationRole;
}
export interface Actor {
  user: User;
  memberships: Membership[];
}
export interface ResourceScope {
  scope: Scope;
  ownerId?: string;
  organizationId?: string;
}
export type AuditValue = string | number | boolean | null;
export interface AuditInput {
  actorId?: string | null;
  action: string;
  target?: string | null;
  result?: "success" | "denied" | "error";
  requestId?: string;
  before?: Record<string, AuditValue>;
  after?: Record<string, AuditValue>;
}
export interface AuditEvent {
  id: string;
  actorId: string | null;
  action: string;
  target: string | null;
  result: "success" | "denied" | "error";
  requestId: string;
  before: Record<string, AuditValue>;
  after: Record<string, AuditValue>;
  createdAt: string;
}
export interface AIUsageInput {
  requestId: string;
  userId?: string | null;
  task: string;
  provider?: string | null;
  model?: string | null;
  status: "success" | "error";
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedTokens?: number | null;
  estimatedCostUsd?: number | null;
  latencyMs: number;
  errorCode?: string | null;
}
export interface AIUsageEvent extends AIUsageInput {
  id: string;
  createdAt: string;
}
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  updatedAt: string;
  updatedBy: string | null;
}
export class PlatformError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
