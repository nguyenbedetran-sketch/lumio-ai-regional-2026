export type OutboundDisclosure = {
  action:
    | "chat"
    | "summary"
    | "quiz"
    | "flashcards"
    | "lesson"
    | "transcription"
    | "speech";
  sourceCharacters?: number;
  questionCharacters?: number;
  historyMessages?: number;
  mediaKind?: "image" | "pdf" | "audio" | "video";
  videoUrl?: boolean;
  /** True only when using the authenticated, retained tutor session endpoint. */
  tutorSession?: boolean;
};
export type OutboundCategory =
  | "source"
  | "question"
  | "history"
  | "image"
  | "pdf"
  | "audio"
  | "video"
  | "videoUrl"
  | "speechText"
  | "options";
/** The caller supplies prepared-payload facts, never raw source text or credentials. */
export function outboundCategories(
  input: OutboundDisclosure,
): OutboundCategory[] {
  const categories: OutboundCategory[] = [];
  if (input.action === "transcription") return ["audio", "options"];
  if (input.action === "speech") return ["speechText", "options"];
  const positive = (n: number | undefined) =>
    typeof n === "number" && Number.isFinite(n) && n > 0;
  if (positive(input.sourceCharacters)) categories.push("source");
  if (positive(input.questionCharacters)) categories.push("question");
  if (input.action === "chat" && positive(input.historyMessages))
    categories.push("history");
  if (
    input.mediaKind &&
    ["image", "pdf", "audio", "video"].includes(input.mediaKind)
  )
    categories.push(input.mediaKind);
  if (input.videoUrl) categories.push("videoUrl");
  categories.push("options");
  return categories;
}
