export const teachingFileLimits = {
  fileBytes: 1024 * 1024,
  bodyBytes: 1400000 + 4096,
  chunkBytes: 256 * 1024,
  filesPerTarget: 3,
  organizationBytes: 20 * 1024 * 1024,
  uploadsPerDay: 60,
  pendingMs: 24 * 60 * 60 * 1000,
} as const;
export type TeachingFileTarget = {
  kind: "lesson" | "assignment" | "submission";
  id: string;
};
export interface TeachingFile {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  sha256: string;
  createdAt: string;
  orgId: string;
  classId: string;
  uploaderId: string;
  targetKind: TeachingFileTarget["kind"];
  targetId: string;
  purpose: "reference" | "teacher-only" | "submission";
  status: "pending" | "attached";
  submissionId?: string;
  submissionRevision?: number;
}
