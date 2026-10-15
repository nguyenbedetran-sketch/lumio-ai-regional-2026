export type CaptionCue = { start: number; end: number; text: string };
export function parseCaptions(raw: string): CaptionCue[] {
  if (raw.length > 200000) throw new Error("CAPTIONS_TOO_LARGE");
  const time = (s: string) => {
    const p = s.replace(",", ".").split(":").map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  };
  const cues: CaptionCue[] = [];
  for (const block of raw
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const index = lines.findIndex((line) =>
      /^(?:\d{2,}:)?\d{2}:\d{2}[.,]\d{3}\s+-->/.test(line),
    );
    if (index < 0) continue;
    const match = lines[index].match(
      /^((?:\d{2,}:)?\d{2}:\d{2}[.,]\d{3})\s+-->\s+((?:\d{2,}:)?\d{2}:\d{2}[.,]\d{3})/,
    );
    if (!match) continue;
    const start = time(match[1]),
      end = time(match[2]);
    // Captions are rendered as text only; strip cue markup, not execute it.
    const text = lines
      .slice(index + 1)
      .join(" ")
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .trim();
    if (Number.isFinite(start) && end > start && start >= 0 && text)
      cues.push({ start, end, text });
    if (cues.length > 3000) throw new Error("CAPTIONS_TOO_LARGE");
  }
  if (!cues.length) throw new Error("INVALID_CAPTIONS");
  return cues;
}
export function captionText(cues: CaptionCue[]): string {
  return cues
    .map((cue) => {
      const hours = Math.floor(cue.start / 3600),
        minutes = Math.floor((cue.start % 3600) / 60),
        seconds = Math.floor(cue.start % 60);
      return `[${hours ? String(hours).padStart(2, "0") + ":" : ""}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}] ${cue.text}`;
    })
    .join("\n");
}
