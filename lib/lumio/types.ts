import type { StudyArtifact } from "../ai/summary";
import type { SourceEvidence, SourceReference } from "../ai/grounding";
export type ContentKind = "text" | "pdf" | "image" | "audio" | "video" | "link";
export type Flashcard = {
  id: string;
  front: string;
  back: string;
  references?: SourceReference[];
};
export type Question = {
  id: string;
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  topic?: string;
  references?: SourceReference[];
};
export type Attempt = {
  date: string;
  score: number;
  total: number;
  answers?: {
    questionId: string;
    selected: number;
    correct: boolean;
    topic?: string;
  }[];
};
export type LearningItem = {
  id: string;
  title: string;
  kind: ContentKind;
  spaceId: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  text: string;
  sourceEvidence?: SourceEvidence;
  url?: string;
  sourceInfo?: {
    kind: "website" | "captions" | "manual";
    url?: string;
    fetchedAt: string;
    title?: string;
    truncated?: boolean;
    filename?: string;
  };
  blob?: Blob;
  fileName?: string;
  notes: string;
  cards: Flashcard[];
  questions: Question[];
  attempts: Attempt[];
  favorite: boolean;
  artifacts?: StudyArtifact[];
};
export type Space = { id: string; name: string; color: string };
export type LibraryState = {
  version: 1;
  items: LearningItem[];
  spaces: Space[];
};
export type ProviderStatus = {
  competitionPreview?: boolean;
  publicDemo?: boolean;
  desktop?: boolean;
  google: boolean;
  facebook: boolean;
  ai: boolean;
  capabilities?: {
    tutor: boolean;
    summary: boolean;
    media: boolean;
    transcription: boolean;
    speech: boolean;
  };
};
export const emptyLibrary: LibraryState = { version: 1, items: [], spaces: [] };
export function safeLink(input: string): string {
  const url = new URL(input);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("INVALID_URL");
  return url.href;
}
export const uid = () => crypto.randomUUID();
export function createItem(
  values: Pick<LearningItem, "title" | "kind"> & Partial<LearningItem>,
): LearningItem {
  return {
    id: uid(),
    spaceId: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    text: "",
    notes: "",
    cards: [],
    questions: [],
    attempts: [],
    favorite: false,
    ...values,
  };
}
