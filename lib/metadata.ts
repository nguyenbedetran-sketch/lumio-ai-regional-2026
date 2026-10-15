import type { Metadata } from "next";

const description =
  "Lumio AI giúp bạn học từ tài liệu, ghi chú, thẻ ghi nhớ và bài luyện tập trong một không gian tập trung.";

// Canonicals and structured data are emitted only after the operator supplies a
// real HTTPS origin. Local, private and example URLs must never become public SEO.
export function publicOrigin(): string | null {
  try {
    const raw = process.env.NEXT_PUBLIC_SITE_URL;
    if (!raw) return null;
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      !host.includes(".") ||
      host.includes(":") ||
      /^\d[\d.]+$/.test(host) ||
      /(^|\.)(localhost|local|internal|test|invalid|example\.com|example\.org|example\.net)$/.test(
        host,
      )
    )
      return null;
    url.hostname = host;
    return url.origin;
  } catch {
    return null;
  }
}
export function publicIndexing(): boolean {
  return (
    process.env.LUMIO_PUBLIC_INDEXING === "true" && publicOrigin() !== null
  );
}
export function pageMetadata({
  title,
  description: pageDescription,
  path,
  privatePage = false,
}: {
  title: string;
  description: string;
  path: string;
  privatePage?: boolean;
}): Metadata {
  const origin = publicOrigin(),
    index = publicIndexing() && !privatePage;
  return {
    title,
    description: pageDescription,
    ...(origin
      ? { alternates: { canonical: new URL(path, origin).href } }
      : {}),
    robots: { index, follow: index, noarchive: !index },
    openGraph: {
      title: `${title} · Lumio AI`,
      description: pageDescription,
      type: "website",
      locale: "vi_VN",
      siteName: "Lumio AI",
      ...(origin ? { url: new URL(path, origin).href } : {}),
    },
    twitter: {
      card: "summary",
      title: `${title} · Lumio AI`,
      description: pageDescription,
    },
  };
}
export const siteMetadata: Metadata = {
  ...pageMetadata({
    title: "Học tập theo cách của bạn",
    description,
    path: "/",
    privatePage: true,
  }),
  title: {
    default: "Lumio AI · Học tập theo cách của bạn",
    template: "%s · Lumio AI",
  },
  applicationName: "Lumio AI",
  icons: { icon: "/brand/lumio-logo.png", apple: "/brand/lumio-logo.png" },
  ...(publicOrigin() ? { metadataBase: new URL(publicOrigin()!) } : {}),
};
export function publicSiteSchema(): string | null {
  const origin = publicOrigin();
  if (!origin || !publicIndexing()) return null;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: "Lumio AI",
        url: origin,
        description,
        inLanguage: ["vi", "en", "zh-CN", "ja", "ko"],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${origin}/#application`,
        name: "Lumio AI",
        url: origin,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web browser",
        description,
      },
    ],
  }).replace(/</g, "\\u003c");
}
