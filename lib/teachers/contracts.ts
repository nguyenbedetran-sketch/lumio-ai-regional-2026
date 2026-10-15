import { PlatformError } from "../server/types";

export const teachingLevels = [
  "preschool",
  "primary",
  "lower_secondary",
  "upper_secondary",
  "vocational",
  "higher_education",
  "other",
] as const;
export type TeachingLevel = (typeof teachingLevels)[number];
export const teacherStatuses = [
  "pending",
  "approved",
  "rejected",
  "revoked",
] as const;
export type TeacherStatus = (typeof teacherStatuses)[number];
/** Submitted declarations, never an automated identity or employment verification. */
export interface TeacherProfile {
  applicantName: string;
  countryCode: string;
  country: string;
  provinceCity: string;
  ward: string;
  school: string;
  teachingLevel: TeachingLevel;
  subjects: string[];
  teacherDeclaration: true;
  storageConsent: true;
  workEmail?: string;
  publicEvidenceUrl?: string;
}
export interface TeacherApplication {
  id: string;
  userId: string;
  applicantName: string;
  profile: TeacherProfile;
  status: TeacherStatus;
  revision: number;
  submittedAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}
export interface TeacherCredential {
  active: boolean;
  basis: "manual-review-of-declaration";
  identityVerified: false;
  approvedAt: string | null;
  revokedAt: string | null;
}
export interface TeacherSelfState {
  application: TeacherApplication | null;
  credential: TeacherCredential;
}
export interface TeacherAdminList {
  items: TeacherApplication[];
  total: number;
  offset: number;
  limit: number;
}
export interface TeacherSubmission {
  requestId: string;
  expectedRevision: number;
  profile: TeacherProfile;
}
export interface TeacherReview {
  requestId: string;
  applicationId: string;
  expectedRevision: number;
  action: "approve" | "reject" | "revoke";
  note: string;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new PlatformError("INVALID_TEACHER_REQUEST");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new PlatformError("INVALID_TEACHER_REQUEST");
}
function plain(value: unknown, min: number, max: number) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new PlatformError("INVALID_TEACHER_PROFILE");
  const result = value.normalize("NFC").trim().replace(/\s+/g, " ");
  if (result.length < min || result.length > max)
    throw new PlatformError("INVALID_TEACHER_PROFILE");
  return result;
}
export function parseTeacherProfile(value: unknown): TeacherProfile {
  const p = object(value);
  keys(p, [
    "applicantName",
    "countryCode",
    "country",
    "provinceCity",
    "ward",
    "school",
    "teachingLevel",
    "subjects",
    "teacherDeclaration",
    "storageConsent",
    "workEmail",
    "publicEvidenceUrl",
  ]);
  if (p.teacherDeclaration !== true || p.storageConsent !== true)
    throw new PlatformError("TEACHER_DECLARATION_REQUIRED");
  if (
    typeof p.countryCode !== "string" ||
    !/^[A-Z]{2}$/.test(p.countryCode) ||
    !teachingLevels.includes(p.teachingLevel as TeachingLevel)
  )
    throw new PlatformError("INVALID_TEACHER_PROFILE");
  if (
    !Array.isArray(p.subjects) ||
    p.subjects.length < 1 ||
    p.subjects.length > 10
  )
    throw new PlatformError("INVALID_TEACHER_PROFILE");
  const subjects = [
    ...new Set(p.subjects.map((subject) => plain(subject, 2, 80))),
  ];
  const result: TeacherProfile = {
    applicantName: plain(p.applicantName, 2, 120),
    countryCode: p.countryCode,
    country: plain(p.country, 2, 80),
    provinceCity: plain(p.provinceCity, 1, 120),
    ward: plain(p.ward, 1, 120),
    school: plain(p.school, 2, 200),
    teachingLevel: p.teachingLevel as TeachingLevel,
    subjects,
    teacherDeclaration: true,
    storageConsent: true,
  };
  if (p.workEmail !== undefined && p.workEmail !== "") {
    const email = plain(p.workEmail, 3, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new PlatformError("INVALID_TEACHER_PROFILE");
    result.workEmail = email;
  }
  if (p.publicEvidenceUrl !== undefined && p.publicEvidenceUrl !== "") {
    const raw = plain(p.publicEvidenceUrl, 8, 1500);
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new PlatformError("INVALID_TEACHER_PROFILE");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.href.length > 1500
    )
      throw new PlatformError("INVALID_TEACHER_PROFILE");
    result.publicEvidenceUrl = url.href;
  }
  return result;
}
function requestId(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(value))
    throw new PlatformError("INVALID_TEACHER_REQUEST");
  return value;
}
function revision(value: unknown, minimum = 0) {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < minimum ||
    Number(value) > 1000000000
  )
    throw new PlatformError("INVALID_TEACHER_REQUEST");
  return Number(value);
}
export function parseTeacherSubmission(value: unknown): TeacherSubmission {
  const v = object(value);
  keys(v, ["requestId", "expectedRevision", "profile"]);
  return {
    requestId: requestId(v.requestId),
    expectedRevision: revision(v.expectedRevision),
    profile: parseTeacherProfile(v.profile),
  };
}
export function parseTeacherReview(value: unknown): TeacherReview {
  const v = object(value);
  keys(v, ["requestId", "applicationId", "expectedRevision", "action", "note"]);
  if (
    typeof v.applicationId !== "string" ||
    !/^[A-Za-z0-9_-]{8,100}$/.test(v.applicationId) ||
    typeof v.action !== "string" ||
    !["approve", "reject", "revoke"].includes(v.action)
  )
    throw new PlatformError("INVALID_TEACHER_REQUEST");
  if (
    typeof v.note !== "string" ||
    v.note.length > 300 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v.note)
  )
    throw new PlatformError("INVALID_TEACHER_PROFILE");
  return {
    requestId: requestId(v.requestId),
    applicationId: v.applicationId,
    expectedRevision: revision(v.expectedRevision, 1),
    action: v.action as TeacherReview["action"],
    note: plain(v.note.replace(/[\r\n\t]+/g, " "), 8, 300),
  };
}
export interface TeacherListQuery {
  status?: TeacherStatus | "all";
  q?: string;
  sort?: "newest" | "oldest";
  offset?: number;
}
export function parseTeacherListQuery(value: TeacherListQuery = {}) {
  const v = object(value);
  keys(v, ["status", "q", "sort", "offset"]);
  const status = v.status ?? "pending",
    sort = v.sort ?? "newest",
    q = v.q ?? "",
    offset = v.offset ?? 0;
  if (
    (status !== "all" && !teacherStatuses.includes(status as TeacherStatus)) ||
    typeof sort !== "string" ||
    !["newest", "oldest"].includes(sort) ||
    typeof q !== "string" ||
    q.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(q) ||
    !Number.isSafeInteger(offset) ||
    Number(offset) < 0 ||
    Number(offset) > 1000000
  )
    throw new PlatformError("INVALID_TEACHER_REQUEST");
  return {
    status: status as TeacherStatus | "all",
    sort: sort as "newest" | "oldest",
    q: q.normalize("NFC").trim(),
    offset: Number(offset),
  };
}
