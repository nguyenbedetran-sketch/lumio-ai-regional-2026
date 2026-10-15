import type { MetadataRoute } from "next";
import { publicIndexing, publicOrigin } from "../lib/metadata";

export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  if (!publicIndexing()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: ["/privacy", "/terms", "/data-deletion"],
      disallow: ["/", "/admin", "/api/", "/preview-mobile.html"],
    },
    sitemap: `${publicOrigin()}/sitemap.xml`,
  };
}
