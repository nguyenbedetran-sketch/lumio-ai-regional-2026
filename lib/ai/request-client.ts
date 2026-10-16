// Intent receipts contain only hashes and opaque IDs, never source text or AI output.
// Keep an uncertain intent across an explicit retry. Never retry paid work automatically.
const STORAGE = "lumio-paid-intents-v1";
type Intent = { hash: string; key: string; at: number };
let intents: Intent[] = [];
let loaded = false;
function readIntents() {
  if (!loaded) {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORAGE) || "[]");
      if (
        !Array.isArray(value) ||
        value.length > 64 ||
        !value.every(
          (v) =>
            v &&
            typeof v === "object" &&
            Object.keys(v).sort().join(",") === "at,hash,key" &&
            typeof v.hash === "string" &&
            /^[a-f0-9]{64}$/.test(v.hash) &&
            typeof v.key === "string" &&
            /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v.key) &&
            Number.isSafeInteger(v.at) &&
            v.at > 0,
        ) ||
        new Set(value.map((v: Intent) => v.hash)).size !== value.length ||
        new Set(value.map((v: Intent) => v.key)).size !== value.length
      )
        throw new Error("INVALID_INTENT_STORAGE");
      intents = value;
      loaded = true;
    } catch {
      throw new Error("AI_REQUEST_STORAGE_UNAVAILABLE");
    }
  }
  // Do not expire an unresolved key: its server ledger tombstone must remain
  // effective even after the short-lived receipt metadata has expired.
  return intents;
}
function persist(required = false) {
  try {
    sessionStorage.setItem(STORAGE, JSON.stringify(intents));
  } catch {
    if (required) throw new Error("AI_REQUEST_STORAGE_UNAVAILABLE");
  }
}
async function sha(value: string | ArrayBuffer) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
async function bodyStamp(body: RequestInit["body"]) {
  if (typeof body === "string") return body;
  if (body instanceof FormData) {
    const entries: [string, unknown][] = [];
    for (const [name, value] of body.entries()) {
      entries.push([
        name,
        typeof value === "string"
          ? value
          : [
              value.name,
              value.type,
              value.size,
              await sha(await value.arrayBuffer()),
            ],
      ]);
    }
    return JSON.stringify(entries);
  }
  throw new Error("INVALID_INPUT");
}
export function accountHeaders(account: string) {
  return { "X-Lumio-Account": account };
}

/** Same account + endpoint + exact payload reuses its uncertain HTTP intent. */
export async function paidFetch(
  endpoint: "/api/ai" | "/api/voice" | "/api/rag/search" | "/api/rag/documents",
  init: RequestInit,
  account = "guest",
): Promise<Response> {
  init.signal?.throwIfAborted();
  const hash = await sha(
    JSON.stringify([account, endpoint, await bodyStamp(init.body)]),
  );
  init.signal?.throwIfAborted();
  const existing = readIntents().find((v) => v.hash === hash);
  const intent = existing || { hash, key: crypto.randomUUID(), at: Date.now() };
  if (!existing) {
    // Never evict uncertain work to make room for an automatic paid retry.
    if (intents.length >= 64) throw new Error("AI_REQUEST_PENDING_LIMIT");
    intents.push(intent);
  }
  // If persistence is blocked, do not risk losing a paid request's identity.
  persist(true);
  const headers = new Headers(init.headers);
  headers.set("X-Lumio-Account", account);
  headers.set("Idempotency-Key", intent.key);
  const response = await fetch(endpoint, { ...init, headers });
  function consumed(value?: unknown) {
    const data = value as
      { error?: unknown; receipt?: { status?: string } } | undefined;
    const uncertain = [
      "AI_REQUEST_IN_PROGRESS",
      "AI_REQUEST_COMPLETED",
      "AI_REQUEST_CONFLICT",
    ].includes(String(data?.error));
    // A received body is the acknowledgement. A lost/truncated body retains the key.
    // A gateway may emit JSON 5xx after upstream settlement. Keep its original
    // key until the owned server receipt resolves that uncertain outcome.
    if (
      response.ok ||
      (!uncertain && response.status >= 400 && response.status < 500)
    ) {
      intents = readIntents().filter((v) => v.key !== intent.key);
      persist();
    }
  }
  return new Proxy(response, {
    get(target, property) {
      if (property === "json")
        return async () => {
          const data = await target.json();
          consumed(data);
          return data;
        };
      if (property === "blob")
        return async () => {
          const blob = await target.blob();
          if (target.ok) consumed();
          return blob;
        };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
