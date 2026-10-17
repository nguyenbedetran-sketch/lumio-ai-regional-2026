import type { RagHit } from "./types";
const stop = new Set(
  "a an the is are was were to of in on for and or what why how with by be as this that does do can please bài học câu hỏi cho tôi mình bạn là có của và hay các những về thì được với nào gì sao thế hãy cần".split(
    " ",
  ),
);
/** Deterministic lexical bounds, independent of host ICU/dictionaries. */
export const LEXICAL_TOKEN_LIMITS = {
  inputCharacters: 120000,
  queryCharacters: 4000,
  terms: 8192,
  queryTerms: 40,
  termCharacters: 64,
} as const;
const eastAsian =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u30fc]/u;
/**
 * Keep Latin/Vietnamese accent folding, but preserve kana voicing and composed
 * Hangul. East Asian runs use overlapping bigrams, not a claimed word/morpheme
 * model. Document unigrams also permit a deliberate one-character query.
 * These search tokens never replace the original text or citation offsets.
 */
function tokenize(text: string, query = false): string[] {
  const result: string[] = [];
  const emit = (value: string) => {
    if (
      value &&
      value.length <= LEXICAL_TOKEN_LIMITS.termCharacters &&
      result.length < LEXICAL_TOKEN_LIMITS.terms
    )
      result.push(value);
  };
  const flush = (run: string, cjk: boolean) => {
    if (!cjk) {
      emit(run.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d"));
      return;
    }
    const chars = Array.from(run);
    if (chars.length === 1) {
      emit(run);
      return;
    }
    if (chars.length > 2) emit(run);
    for (
      let i = 1;
      i < chars.length && result.length < LEXICAL_TOKEN_LIMITS.terms;
      i++
    )
      emit(chars[i - 1] + chars[i]);
    // Multi-character queries require a bigram/full run rather than matching
    // every passage containing one common character or Korean syllable.
    if (!query) for (const char of chars) emit(char);
  };
  const normalized = text
    .slice(
      0,
      query
        ? LEXICAL_TOKEN_LIMITS.queryCharacters
        : LEXICAL_TOKEN_LIMITS.inputCharacters,
    )
    .normalize("NFKC")
    .toLowerCase();
  for (const match of normalized.matchAll(/[\p{L}\p{N}\p{M}\u30fc]+/gu)) {
    let run = "",
      cjk = false;
    for (const char of match[0]) {
      const nextCjk = eastAsian.test(char);
      if (run && nextCjk !== cjk) {
        flush(run, cjk);
        run = "";
      }
      run += char;
      cjk = nextCjk;
      if (result.length >= LEXICAL_TOKEN_LIMITS.terms) break;
    }
    if (run) flush(run, cjk);
    if (result.length >= LEXICAL_TOKEN_LIMITS.terms) break;
  }
  return result;
}
export function terms(text: string): string[] {
  return tokenize(text);
}
const stopNormalized = new Set([...stop].flatMap(terms));
export function queryTerms(text: string) {
  return [
    ...new Set(tokenize(text, true).filter((t) => !stopNormalized.has(t))),
  ].slice(0, LEXICAL_TOKEN_LIMITS.queryTerms);
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
/** Narrow literal comparisons, not semantic verification or a source filter.
 * Cardinal directions require the same explicit direction attribute and a bare
 * value ending the sentence; different subjects/qualifiers are not merged. */
export function potentialConflict(hits: RagHit[]) {
  const facts = new Map<string, Set<string>>();
  const add = (key: string, value: string) => {
    const set = facts.get(key) || new Set();
    set.add(value);
    facts.set(key, set);
  };
  for (const h of hits)
    for (const m of h.text.matchAll(
      /([^.!?\n=]{3,70})\s*=\s*(-?\d+(?:[.,]\d+)?)/g,
    )) {
      add("numeric:" + terms(m[1]).join(" "), m[2].replace(",", "."));
    }
  const directions: Record<string, string> = {
    east: "east", west: "west", north: "north", south: "south",
    đông: "east", tây: "west", bắc: "north", nam: "south",
  };
  for (const h of hits)
    for (const m of h.text.normalize("NFC").matchAll(
      /(?:^|[.!?\n])\s*([^.!?\n=]{3,70}?)\s+(is|là)\s+(east|west|north|south|đông|tây|bắc|nam)(?=\s*(?:[.!?\n]|$))/giu,
    )) {
      const subject = m[1].trim().toLowerCase();
      if (
        (m[2].toLowerCase() === "is" && /\bdirection$/.test(subject)) ||
        (m[2].toLowerCase() === "là" && /(?:^|\s)hướng(?:\s|$)/u.test(subject))
      ) add("direction:" + subject.replace(/\s+/g, " "), directions[m[3].toLowerCase()]);
    }
  return [...facts.values()].some((s) => s.size > 1);
}
