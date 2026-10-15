import type { MetadataRoute } from "next";
import { publicIndexing, publicOrigin } from "../lib/metadata";

export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin();
  if (!origin || !publicIndexing()) return [];
  // The home route is the private learning workspace, not a public marketing page.
  return ["/privacy", "/terms", "/data-deletion"].map((path) => ({
    url: `${origin}${path}`,
  }));
}
