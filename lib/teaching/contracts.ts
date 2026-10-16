import type { SourceEvidence } from "../ai/grounding";
import type { SystemRole, OrganizationRole } from "../server/types";
import type { AssessmentBlueprintCell } from "./assessment-plan";

export type TeachingRole = "ORGANIZATION_ADMIN" | "TEACHER" | "STUDENT";
export type DraftStatus = "draft" | "reviewed" | "published" | "archived";
export type QuestionKind = "mcq" | "short" | "essay";
export type TeachingDifficulty = "basic" | "medium" | "advanced";
export interface TeachingOrganization {
  id: string;
  name: string;
  role: TeachingRole;
  revision: number;
  createdAt: string;
}
export interface TeachingClass {
  id: string;
  orgId: string;
  name: string;
  subject: string;
  grade: string;
  description: string;
  archived: boolean;
  revision: number;
  createdAt: string;
  teacherIds: string[];
}
export interface TeachingMember {
  userId: string;
  name: string;
  role: OrganizationRole;
  approvedTeacher: boolean;
}
export interface TeachingEnrollment {
  id: string;
  classId: string;
  userId: string;
  name: string;
  active: boolean;
  revision: number;
  joinedAt: string;
}
export interface TeachingGroup {
  id: string;
  classId: string;
  name: string;
  memberIds: string[];
  revision: number;
}
export interface TeachingInvite {
  id: string;
  classId: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
  active: boolean;
  revision: number;
}
export interface TeachingReference {
  materialId: string;
  quote: string;
  paragraph: number;
  materialRevision?: number;
  page?: number;
  slide?: number;
  heading?: string;
  seconds?: number;
}
export interface TeachingMaterial {
  id: string;
  orgId: string;
  classId: string | null;
  title: string;
  kind: "text" | "link" | "pdf" | "docx" | "pptx" | "image" | "audio" | "video";
  content: string;
  url?: string;
  sourceEvidence?: SourceEvidence;
  status: DraftStatus;
  revision: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface LessonSection {
  title: string;
  body: string;
  references: TeachingReference[];
}
export interface TeachingLesson {
  id: string;
  orgId: string;
  classId: string | null;
  title: string;
  topic: string;
  grade: string;
  objectives: string[];
  sections: LessonSection[];
  sourceIds: string[];
  status: DraftStatus;
  revision: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface RubricCriterion {
  label: string;
  points: number;
}
export interface TeachingQuestion {
  id: string;
  orgId: string;
  classId: string | null;
  prompt: string;
  kind: QuestionKind;
  choices: string[];
  correctIndex?: number;
  modelAnswer?: string;
  explanation?: string;
  rubric?: RubricCriterion[];
  maxPoints: number;
  topic: string;
  difficulty: TeachingDifficulty;
  references: TeachingReference[];
  status: DraftStatus;
  revision: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
/** Student payload omits optional answer/rubric fields until that student's grade is published. */
export interface AssignmentQuestion {
  id: string;
  revision: number;
  prompt: string;
  kind: QuestionKind;
  choices: string[];
  maxPoints: number;
  topic: string;
  difficulty: TeachingDifficulty;
  correctIndex?: number;
  modelAnswer?: string;
  explanation?: string;
  rubric?: RubricCriterion[];
  references?: TeachingReference[];
}
export interface TeachingAssignment {
  id: string;
  orgId: string;
  classId: string;
  title: string;
  instructions: string;
  questionIds: string[];
  questions: AssignmentQuestion[];
  target: { kind: "class" | "groups" | "students"; ids: string[] };
  recipientIds?: string[];
  dueAt: string;
  rootAssignmentId: string;
  attemptNo: number;
  practiceRetake: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
  questionCount: number;
  canSubmit?: boolean;
  availability?:
    | "not_open"
    | "closed"
    | "due_passed"
    | "graded"
    | "class_archived"
    | "available";
  status: "draft" | "reviewed" | "issued" | "closed";
  revision: number;
  createdBy: string;
  createdAt: string;
  issuedAt: string | null;
  maxPoints: number;
}
export interface TeachingAnswer {
  questionId: string;
  response: string | number | null;
}
export interface QuestionGrade {
  questionId: string;
  points: number;
  feedback: string;
}
/** Students receive only published public snapshots; private fields are omitted entirely. */
export interface TeachingGradeHistoryEvent {
  id: string;
  kind: "grade" | "publish" | "legacy_snapshot";
  submissionRevision: number;
  gradeVersion: number;
  score: number;
  grades: QuestionGrade[];
  feedback: string;
  publishedAt: string | null;
  legacy: boolean;
  recordedAt?: string | null;
  recordedBy?: { userId: string; name: string } | null;
  confirmedAt?: string | null;
  reason?: string;
}
export interface TeachingGradeHistoryResponse {
  submissionId: string;
  events: TeachingGradeHistoryEvent[];
  nextCursor: string | null;
}
export interface TeachingSubmission {
  id: string;
  orgId: string;
  assignmentId: string;
  classId: string;
  studentId: string;
  studentName: string;
  answers: TeachingAnswer[];
  submittedAt: string;
  late: boolean;
  status: "submitted" | "graded" | "published";
  revision: number;
  autoScore?: number;
  grades?: QuestionGrade[];
  score?: number;
  feedback?: string;
  confirmedAt?: string | null;
  publishedAt?: string | null;
  countsTowardAnalytics?: boolean;
}
export interface TeachingAnnouncement {
  id: string;
  orgId: string;
  classId: string | null;
  title: string;
  body: string;
  status: "draft" | "published";
  revision: number;
  createdBy: string;
  createdAt: string;
}
export interface TeachingEvent {
  id: string;
  orgId: string;
  classId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  kind: "lesson" | "deadline" | "meeting";
  revision: number;
}
export interface TeachingSettings {
  name: string;
  timezone: string;
  allowLateSubmissions: boolean;
  revision: number;
}
export interface TeachingPreferences {
  subjects: string[];
  grades: string[];
  displayName: string;
  aiLanguage: string;
  defaultDifficulty: TeachingDifficulty;
  aiEnabled: boolean;
  inAppNotifications: boolean;
  revision: number;
}
export interface TeachingAnalytics {
  studentId: string;
  studentName: string;
  assessments: number;
  averagePercent: number | null;
  topics: {
    topic: string;
    assessments: number;
    averagePercent: number;
    level: "insufficient" | "developing" | "secure";
  }[];
}
export interface TeachingState {
  version: 1;
  serverTime: string;
  actor: {
    userId: string;
    name: string;
    accountKey: string;
    systemRole: SystemRole;
    approvedTeacher: boolean;
    canCreateOrganization: boolean;
  };
  organizations: TeachingOrganization[];
  organization: TeachingOrganization | null;
  role: TeachingRole | null;
  permissions: { manageOrg: boolean; teach: boolean; learn: boolean };
  classes: TeachingClass[];
  members: TeachingMember[];
  enrollments: TeachingEnrollment[];
  groups: TeachingGroup[];
  invites: TeachingInvite[];
  materials: TeachingMaterial[];
  lessons: TeachingLesson[];
  questions: TeachingQuestion[];
  assignments: TeachingAssignment[];
  submissions: TeachingSubmission[];
  announcements: TeachingAnnouncement[];
  events: TeachingEvent[];
  settings: TeachingSettings | null;
  preferences: TeachingPreferences | null;
  dashboard: {
    classes: number;
    students: number;
    materials: number;
    lessons: number;
    questions: number;
    assignments: number;
    awaitingGrading: number;
    dueSoon: number;
    publishedAssessments: number;
    averagePercent: number | null;
  };
  analytics: TeachingAnalytics[];
}
export type MaterialDraft = Pick<
  TeachingMaterial,
  "classId" | "title" | "kind" | "content"
> & { url?: string; sourceEvidence?: SourceEvidence };
export type LessonDraft = Pick<
  TeachingLesson,
  | "classId"
  | "title"
  | "topic"
  | "grade"
  | "objectives"
  | "sections"
  | "sourceIds"
>;
export type QuestionDraft = Pick<
  TeachingQuestion,
  | "classId"
  | "prompt"
  | "kind"
  | "choices"
  | "maxPoints"
  | "topic"
  | "difficulty"
  | "references"
> &
  Pick<
    TeachingQuestion,
    "correctIndex" | "modelAnswer" | "explanation" | "rubric"
  >;
export type AssignmentDraft = Pick<
  TeachingAssignment,
  "classId" | "title" | "instructions" | "questionIds" | "target" | "dueAt"
> & { availableFrom?: string | null; availableUntil?: string | null };
type Mutation = { requestId: string; orgId?: string };
export type TeachingMutation = Mutation &
  (
    | ({ action: "preferences.update"; expectedRevision: number } & Omit<
        TeachingPreferences,
        "revision"
      >)
    | { action: "org.create"; name: string }
    | {
        action: "class.create";
        name: string;
        subject: string;
        grade: string;
        description: string;
      }
    | {
        action: "class.update";
        id: string;
        expectedRevision: number;
        name: string;
        subject: string;
        grade: string;
        description: string;
        archived: boolean;
      }
    | {
        action: "invite.create";
        classId: string;
        expectedRevision: number;
        expiresInDays: number;
        maxUses: number;
      }
    | { action: "invite.revoke"; id: string; expectedRevision: number }
    | { action: "class.join"; code: string }
    | {
        action: "enrollment.remove" | "enrollment.restore";
        id: string;
        expectedRevision: number;
      }
    | { action: "member.remove"; userId: string; expectedRevision: number }
    | {
        action: "member.role";
        userId: string;
        role: "TEACHER" | "SCHOOL_ADMIN";
        expectedRevision: number;
      }
    | {
        action: "teacher.assign" | "teacher.remove";
        classId: string;
        userId: string;
        expectedRevision: number;
      }
    | {
        action: "group.save";
        id?: string;
        classId: string;
        expectedRevision: number;
        name: string;
        memberIds: string[];
      }
    | { action: "group.delete"; id: string; expectedRevision: number }
    | { action: "material.create"; draft: MaterialDraft }
    | {
        action: "material.update";
        id: string;
        expectedRevision: number;
        draft: MaterialDraft;
      }
    | { action: "lesson.create"; draft: LessonDraft }
    | {
        action: "lesson.update";
        id: string;
        expectedRevision: number;
        draft: LessonDraft;
      }
    | { action: "question.create"; draft: QuestionDraft }
    | {
        action: "question.update";
        id: string;
        expectedRevision: number;
        draft: QuestionDraft;
      }
    | {
        action:
          | "material.review"
          | "material.publish"
          | "material.delete"
          | "lesson.review"
          | "lesson.publish"
          | "lesson.delete"
          | "question.review"
          | "question.delete";
        id: string;
        expectedRevision: number;
      }
    | { action: "assignment.create"; draft: AssignmentDraft }
    | {
        action: "assignment.compose";
        draft: Omit<AssignmentDraft, "questionIds">;
        blueprint: AssessmentBlueprintCell[];
        expectedClassRevision: number;
      }
    | {
        action: "assignment.retake";
        originalAssignmentId: string;
        expectedRevision: number;
        studentId: string;
        availableFrom: string;
        availableUntil: string;
        reason: string;
        sameQuestionsAcknowledged: true;
      }
    | {
        action: "assignment.update";
        id: string;
        expectedRevision: number;
        draft: AssignmentDraft;
      }
    | {
        action:
          | "assignment.review"
          | "assignment.issue"
          | "assignment.close"
          | "assignment.delete";
        id: string;
        expectedRevision: number;
      }
    | {
        action: "submission.submit";
        assignmentId: string;
        expectedRevision: number;
        answers: TeachingAnswer[];
      }
    | {
        action: "submission.grade";
        id: string;
        expectedRevision: number;
        grades: QuestionGrade[];
        feedback: string;
        confirmed: true;
        reason?: string;
      }
    | { action: "submission.publish"; id: string; expectedRevision: number }
    | {
        action: "announcement.save";
        id?: string;
        expectedRevision: number;
        classId: string | null;
        title: string;
        body: string;
      }
    | {
        action: "announcement.publish" | "announcement.delete";
        id: string;
        expectedRevision: number;
      }
    | {
        action: "event.save";
        id?: string;
        expectedRevision: number;
        classId: string;
        title: string;
        description: string;
        startAt: string;
        endAt: string;
        kind: TeachingEvent["kind"];
      }
    | { action: "event.delete"; id: string; expectedRevision: number }
    | {
        action: "settings.update";
        expectedRevision: number;
        name: string;
        timezone: string;
        allowLateSubmissions: boolean;
      }
  );
export interface TeachingMutationResult {
  state: TeachingState;
  result: {
    id?: string;
    orgId?: string;
    inviteCode?: string;
    [key: string]: unknown;
  };
  replayed: boolean;
}
export interface TeachingGenerationContext {
  userId: string;
  sessionVersion: number;
  orgId: string;
  materials: TeachingMaterial[];
  snapshot: string;
}
export const teachingLimits = {
  organizationsPerOwner: 10,
  classesPerOrg: 30,
  studentsPerClass: 200,
  materialsPerOrg: 100,
  sourceCharacters: 100000,
  contentPerOrg: 200,
  activeContentBytesPerOrg: 2 * 1024 * 1024,
  workspaceBytesPerOrg: 8 * 1024 * 1024,
  communicationBytesPerOrg: 256 * 1024,
  questionsPerAssignment: 30,
  recipientsPerAssignment: 200,
  bodyBytes: 768000,
  gradeVersionsPerSubmission: 50,
  gradeVersionsPerOrg: 10000,
  gradeHistoryBytesPerOrg: 4 * 1024 * 1024,
} as const;
