import { youtubeURL } from "../ingestion/youtube";

export type TeachingResourceProvider = "youtube" | "canva" | "google-slides" | "powerpoint" | "external";
export type SafeTeachingResource =
  | { valid: false; reason: "invalid-url" | "unsafe-url" }
  | { valid: true; provider: TeachingResourceProvider; href: string; host: string; insecure: boolean; videoId?: string; embedUrl?: string; startSeconds?: number };

function timestamp(value: string | null): number | undefined {
  if (!value || value.length > 24) return;
  if (/^\d{1,6}$/.test(value)) { const seconds = Number(value); return seconds <= 86400 ? seconds : undefined; }
  const parts = /^(?:(\d{1,2})h)?(?:(\d{1,3})m)?(?:(\d{1,3})s)?$/.exec(value);
  if (!parts || !parts.slice(1).some(Boolean)) return;
  const seconds = Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0);
  return seconds <= 86400 ? seconds : undefined;
}

/** URL inspection only: no fetch, redirects, provider API or private-resource access. */
export function inspectTeachingResourceURL(value: unknown): SafeTeachingResource {
  if (typeof value !== "string" || !value.trim() || value.length > 4000 || /[\u0000-\u001f\u007f]/.test(value)) return { valid: false, reason: "invalid-url" };
  let url: URL;
  try { url = new URL(value.trim()); } catch { return { valid: false, reason: "invalid-url" }; }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return { valid: false, reason: "unsafe-url" };
  const host = url.hostname.toLowerCase();
  const canonical = youtubeURL(url.href);
  const nocookieId = ["youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host) && !url.port
    ? /^\/embed\/([\w-]{11})\/?$/.exec(url.pathname)?.[1] : undefined;
  const videoId = canonical ? new URL(canonical).searchParams.get("v") || undefined : nocookieId;
  if (videoId) {
    const startSeconds = timestamp(url.searchParams.get("t")) ?? timestamp(url.searchParams.get("start")) ?? timestamp(url.hash.replace(/^#t=/, ""));
    const suffix = startSeconds ? "&start=" + startSeconds : "";
    return { valid: true, provider: "youtube", host: "www.youtube.com", insecure: false, videoId, ...(startSeconds !== undefined ? { startSeconds } : {}), href: `https://www.youtube.com/watch?v=${videoId}${startSeconds ? "&t=" + startSeconds : ""}`, embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?controls=1&playsinline=1&rel=0&cc_load_policy=1${suffix}` };
  }
  let provider: TeachingResourceProvider = "external";
  if (["canva.com", "www.canva.com"].includes(host) && /^\/design\/[A-Za-z0-9_-]+(?:\/|$)/.test(url.pathname)) provider = "canva";
  else if (host === "docs.google.com" && /^\/presentation\/(?:u\/\d+\/)?d\/(?:e\/)?[A-Za-z0-9_-]+(?:\/|$)/.test(url.pathname)) provider = "google-slides";
  else if (["powerpoint.cloud.microsoft", "powerpoint.office.com"].includes(host) || /\.pptx?$/i.test(url.pathname)) provider = "powerpoint";
  return { valid: true, provider, href: url.href, host: url.host, insecure: url.protocol === "http:" };
}

export function teachingResourceTime(seconds: number): string {
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 86400) return "";
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
