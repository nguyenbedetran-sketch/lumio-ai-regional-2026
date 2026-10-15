import type { RagHit } from "./types";
const stop = new Set(
  "a an the is are was were to of in on for and or what why how with by be as this that does do can please bài học câu hỏi cho tôi mình bạn là có của và hay các những về thì được với nào gì sao thế hãy cần".split(
    " ",
  ),
);
export function terms(text: string): string[] {
  return (
    text
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .match(/[a-z0-9]+/g) || []
  );
}
const stopNormalized = new Set([...stop].flatMap(terms));
export function queryTerms(text: string) {
  return [...new Set(terms(text).filter((t) => !stopNormalized.has(t)))].slice(
    0,
    40,
  );
}
export function lexicalRank(rows: RagHit[], query: string): RagHit[] {
  const q = queryTerms(query);
  if (!q.length || !rows.length) return [];
  const docs = rows.map((r) => terms(r.text + " " + r.documentTitle));
  const average = docs.reduce((s, t) => s + t.length, 0) / docs.length || 1;
  const df = new Map(
    q.map((t) => [t, docs.filter((tokens) => tokens.includes(t)).length]),
  );
  return rows
    .map((row, i) => {
      const tokens = docs[i];
      let score = 0;
      for (const t of q) {
        const freq = tokens.filter((x) => x === t).length;
        if (!freq) continue;
        const idf = Math.log(
          1 + (rows.length - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5),
        );
        score +=
          (idf * (freq * 2.2)) /
          (freq + 1.2 * (0.25 + (0.75 * tokens.length) / average));
      }
      return { ...row, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId));
}
export function cosine(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) return -1;
  let dot = 0,
    x = 0,
    y = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    x += a[i] * a[i];
    y += b[i] * b[i];
  }
  return x && y ? dot / Math.sqrt(x * y) : -1;
}
export function hybridRank(lexical: RagHit[], semantic: RagHit[]) {
  const scores = new Map<string, RagHit>();
  for (const list of [lexical, semantic])
    list.forEach((hit, i) => {
      const old = scores.get(hit.chunkId);
      scores.set(hit.chunkId, {
        ...hit,
        score: (old?.score || 0) + 1 / (60 + i + 1),
      });
    });
  return [...scores.values()].sort(
    (a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId),
  );
}
export function diverseHits(rows: RagHit[], limit = 6) {
  const selected: RagHit[] = [],
    seen = new Set<string>();
  for (const hit of rows)
    if (!seen.has(hit.documentId)) {
      selected.push(hit);
      seen.add(hit.documentId);
      if (selected.length === limit) return selected;
    }
  for (const hit of rows)
    if (!selected.some((s) => s.chunkId === hit.chunkId)) {
      selected.push(hit);
      if (selected.length === limit) break;
    }
  return selected;
}
/** A narrow warning for explicit contradictory numeric assignments, not semantic verification. */
export function potentialConflict(hits: RagHit[]) {
  const facts = new Map<string, Set<string>>();
  for (const h of hits)
    for (const m of h.text.matchAll(
      /([^.!?\n=]{3,70})\s*=\s*(-?\d+(?:[.,]\d+)?)/g,
    )) {
      const key = terms(m[1]).join(" "),
        v = m[2].replace(",", ".");
      const set = facts.get(key) || new Set();
      set.add(v);
      facts.set(key, set);
    }
  return [...facts.values()].some((s) => s.size > 1);
}
