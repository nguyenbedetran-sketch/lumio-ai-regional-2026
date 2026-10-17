import type { MetadataRoute } from "next";

/** Public install metadata only; no private routes, shortcuts, tokens, or offline cache. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Lumio AI",
    short_name: "Lumio",
    description: "Học từ tài liệu, ghi chú và bài luyện tập của bạn.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#101916",
    theme_color: "#101916",
    lang: "vi",
    icons: [
      {
        src: "/brand/lumio-logo.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
