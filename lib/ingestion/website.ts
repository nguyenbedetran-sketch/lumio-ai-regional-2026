import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { Parser } from "htmlparser2";
import { AIError } from "../ai/contracts";

export const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 50000;
export function publicIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false; // IPv6 is deliberately not used by this fetcher.
  const [a, b, c] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 &&
      (b === 168 ||
        (b === 0 && (c === 0 || c === 2)) ||
        (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}
export function publicURL(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new AIError("INVALID_URL");
  }
  if (
    raw.length > 4000 ||
    !["https:", "http:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.port ||
    !u.hostname.includes(".") ||
    /(?:^|\.)(localhost|local|internal|invalid|test|onion)$/.test(u.hostname) ||
    (isIP(u.hostname.replace(/^\[|\]$/g, "")) !== 0 && !publicIPv4(u.hostname))
  )
    throw new AIError("URL_NOT_PUBLIC", 400);
  u.hash = "";
  return u;
}
type Address = { address: string; family: number };
type Hop = {
  status: number;
  location?: string;
  contentType: string;
  body: string;
};
export type IngestTransport = {
  resolve: (hostname: string) => Promise<Address[]>;
  request: (
    url: URL,
    pinnedAddress: string,
    signal: AbortSignal,
  ) => Promise<Hop>;
};
const defaultTransport: IngestTransport = {
  resolve: (hostname) =>
    lookup(hostname, { all: true, family: 4, verbatim: true }),
  request: (url, address, signal) =>
    new Promise((resolve, reject) => {
      const request = url.protocol === "https:" ? httpsRequest : httpRequest;
      // Connect directly to the validated address: no second DNS lookup/rebinding window.
      // The original hostname remains the HTTP Host and TLS SNI/certificate identity.
      const req = request(
        {
          protocol: url.protocol,
          hostname: address,
          servername: url.hostname,
          port: url.protocol === "https:" ? 443 : 80,
          path: url.pathname + url.search,
          method: "GET",
          agent: false,
          signal,
          maxHeaderSize: 16384,
          rejectUnauthorized: true,
          headers: {
            Host: url.host,
            "User-Agent": "LumioLearning/1.0 (user-requested text extraction)",
            Accept: "text/html,text/plain",
            "Accept-Encoding": "identity",
          },
        },
        (res) => {
          const status = res.statusCode || 502;
          if ([301, 302, 303, 307, 308].includes(status)) {
            res.destroy();
            resolve({
              status,
              location: res.headers.location,
              contentType: "",
              body: "",
            });
            return;
          }
          const type = String(res.headers["content-type"] || "")
            .split(";")[0]
            .toLowerCase();
          if (
            status !== 200 ||
            !["text/html", "text/plain", "application/xhtml+xml"].includes(type)
          ) {
            res.destroy();
            reject(
              new AIError(
                status === 200 ? "UNSUPPORTED_PAGE" : "PAGE_UNAVAILABLE",
                422,
              ),
            );
            return;
          }
          if (
            (res.headers["content-encoding"] &&
              res.headers["content-encoding"] !== "identity") ||
            Number(res.headers["content-length"]) > MAX_PAGE_BYTES
          ) {
            res.destroy();
            reject(new AIError("PAGE_TOO_LARGE", 413));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_PAGE_BYTES) {
              res.destroy(new AIError("PAGE_TOO_LARGE", 413));
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () =>
            resolve({
              status,
              contentType: type,
              body: Buffer.concat(chunks).toString("utf8"),
            }),
          );
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.end();
    }),
};
export function extractHTML(html: string): {
  title: string;
  text: string;
  truncated: boolean;
} {
  const excluded = new Set([
    "script",
    "style",
    "noscript",
    "template",
    "svg",
    "canvas",
    "iframe",
    "object",
    "embed",
    "nav",
    "footer",
    "header",
    "form",
    "button",
    "input",
    "select",
    "textarea",
  ]);
  const blocks = new Set([
    "p",
    "div",
    "section",
    "article",
    "main",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "li",
    "br",
    "tr",
    "blockquote",
  ]);
  const stack: { tag: string; hidden: boolean }[] = [];
  let headDepth = 0,
    tagCount = 0;
  let title = "",
    text = "",
    titleDepth = false;
  const parser = new Parser(
    {
      onopentag(tag, attrs) {
        if (++tagCount > 50000 || stack.length >= 256)
          throw new AIError("PAGE_COMPLEX", 422);
        if (tag === "head") headDepth++;
        const hidden =
          excluded.has(tag) ||
          !!stack.at(-1)?.hidden ||
          "hidden" in attrs ||
          attrs["aria-hidden"] === "true" ||
          /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attrs.style || "");
        stack.push({ tag, hidden });
        if (tag === "title") titleDepth = true;
        if (!hidden && blocks.has(tag)) text += "\n";
      },
      ontext(chunk) {
        if (titleDepth) title += chunk;
        else if (
          !stack.at(-1)?.hidden &&
          headDepth === 0 &&
          text.length < MAX_TEXT + 5000
        )
          text += chunk;
      },
      onclosetag(tag) {
        if (tag === "head") headDepth = Math.max(0, headDepth - 1);
        const current = stack.pop();
        if (tag === "title") titleDepth = false;
        if (!current?.hidden && blocks.has(tag)) text += "\n";
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  const cleaned = text
    .replace(/[\t \f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    title: title.trim().slice(0, 160),
    text: cleaned.slice(0, MAX_TEXT),
    truncated: cleaned.length > MAX_TEXT,
  };
}
export async function extractWebsite(
  raw: string,
  transport: IngestTransport = defaultTransport,
) {
  const signal = AbortSignal.timeout(15000);
  const timed = <T>(work: Promise<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      const fail = () => reject(new AIError("PAGE_TIMEOUT", 504));
      if (signal.aborted) return fail();
      signal.addEventListener("abort", fail, { once: true });
      work
        .then(resolve, reject)
        .finally(() => signal.removeEventListener("abort", fail));
    });
  let url = publicURL(raw);
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const addresses = isIP(url.hostname)
        ? [{ address: url.hostname, family: 4 }]
        : await timed(transport.resolve(url.hostname));
      if (
        !addresses.length ||
        addresses.some((a) => a.family !== 4 || !publicIPv4(a.address))
      )
        throw new AIError("URL_NOT_PUBLIC", 400);
      const result = await timed(
        transport.request(url, addresses[0].address, signal),
      );
      if ([301, 302, 303, 307, 308].includes(result.status)) {
        if (!result.location || redirects === 3)
          throw new AIError("TOO_MANY_REDIRECTS", 422);
        url = publicURL(new URL(result.location, url).href);
        continue;
      }
      if (result.status !== 200) throw new AIError("PAGE_UNAVAILABLE", 422);
      if (Buffer.byteLength(result.body) > MAX_PAGE_BYTES)
        throw new AIError("PAGE_TOO_LARGE", 413);
      const extracted =
        result.contentType === "text/plain"
          ? {
              title: url.hostname,
              text: result.body.slice(0, MAX_TEXT).trim(),
              truncated: result.body.length > MAX_TEXT,
            }
          : extractHTML(result.body);
      if (extracted.text.length < 40) throw new AIError("PAGE_EMPTY", 422);
      return {
        ...extracted,
        url: url.href,
        fetchedAt: new Date().toISOString(),
        kind: "website" as const,
      };
    }
    throw new AIError("TOO_MANY_REDIRECTS", 422);
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError(
      signal.aborted ? "PAGE_TIMEOUT" : "PAGE_UNAVAILABLE",
      signal.aborted ? 504 : 422,
    );
  }
}
