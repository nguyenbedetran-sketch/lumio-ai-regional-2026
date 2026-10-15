// Canonicalize only a single public-video URL. No remote requests happen here.
export function youtubeURL(value: string): string | null {
  try {
    const u = new URL(value);
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      u.port
    )
      return null;
    const host = u.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else
        id =
          u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})\/?$/)?.[1] ||
          null;
    }
    return id && /^[\w-]{11}$/.test(id)
      ? `https://www.youtube.com/watch?v=${id}`
      : null;
  } catch {
    return null;
  }
}
