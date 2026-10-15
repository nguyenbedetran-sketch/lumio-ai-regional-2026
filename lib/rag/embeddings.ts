import { AIError } from "../ai/contracts";
import { RAG_LIMITS } from "./types";
export const EMBEDDING_PROMPT_VERSION = "rag-embedding-v1";
export function embeddingStatus() {
  return {
    enabled:
      process.env.LUMIO_EMBEDDINGS_ENABLED === "true" &&
      !!process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    dimensions: RAG_LIMITS.dimensions,
  };
}
/** Server only. Callers must obtain explicit consent and reserve credits first. */
export async function embedTexts(
  texts: string[],
  transport: typeof fetch = fetch,
  signal: AbortSignal = AbortSignal.timeout(30000),
) {
  const config = embeddingStatus();
  if (!config.enabled) throw new AIError("EMBEDDINGS_DISABLED", 503);
  if (
    !["text-embedding-3-small", "text-embedding-3-large"].includes(config.model)
  )
    throw new AIError("INVALID_EMBEDDING_CONFIG", 503);
  if (
    !texts.length ||
    texts.length > RAG_LIMITS.chunks ||
    texts.some((t) => typeof t !== "string" || !t.trim() || t.length > 2000) ||
    texts.reduce((s, t) => s + t.length, 0) > RAG_LIMITS.documentCharacters
  )
    throw new AIError("EMBEDDING_INPUT_LIMIT", 413);
  const response = await transport("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      input: texts,
      encoding_format: "float",
      dimensions: config.dimensions,
    }),
    signal,
  });
  if (!response.ok)
    throw new AIError(
      response.status === 429
        ? "PROVIDER_RATE_LIMIT"
        : "EMBEDDING_PROVIDER_ERROR",
      response.status === 429 ? 429 : 502,
    );
  const reader = response.body?.getReader();
  if (!reader) throw new AIError("INVALID_EMBEDDING", 502);
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4 * 1024 * 1024) {
      await reader.cancel();
      throw new AIError("INVALID_EMBEDDING", 502);
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const p of parts) {
    bytes.set(p, offset);
    offset += p.length;
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AIError("INVALID_EMBEDDING", 502);
  }
  if (
    !body ||
    body.model !== config.model ||
    !Array.isArray(body.data) ||
    body.data.length !== texts.length
  )
    throw new AIError("INVALID_EMBEDDING", 502);
  const vectors: number[][] = new Array(texts.length),
    seen = new Set<number>();
  for (const raw of body.data) {
    const item = raw as { index: number; embedding: number[] };
    if (
      !Number.isInteger(item.index) ||
      item.index < 0 ||
      item.index >= texts.length ||
      seen.has(item.index) ||
      !Array.isArray(item.embedding) ||
      item.embedding.length !== config.dimensions ||
      item.embedding.some(
        (n) => typeof n !== "number" || !Number.isFinite(n),
      ) ||
      !item.embedding.some((n) => n !== 0)
    )
      throw new AIError("INVALID_EMBEDDING", 502);
    seen.add(item.index);
    vectors[item.index] = item.embedding;
  }
  const usage = body.usage as { total_tokens?: unknown } | undefined;
  return {
    vectors,
    model: config.model,
    dimensions: config.dimensions,
    totalTokens:
      typeof usage?.total_tokens === "number" &&
      Number.isFinite(usage.total_tokens)
        ? usage.total_tokens
        : undefined,
  };
}
