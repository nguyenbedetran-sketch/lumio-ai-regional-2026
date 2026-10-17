import type { NextConfig } from "next";
export default function config(phase: string): NextConfig {
  return {
    output: "standalone",
    serverExternalPackages: ["unpdf", "fflate", "htmlparser2", "libsql"],
    // The isolated document worker resolves fflate's Node export at runtime.
    // Next's trace otherwise omits lib/node.cjs from the standalone package.
    outputFileTracingIncludes: {
      "/*": [
        "./scripts/database-worker.cjs",
        "./scripts/database-child.cjs",
        "./scripts/database-errors.cjs",
        "./node_modules/@libsql/**/*",
        "./node_modules/.pnpm/libsql@*/node_modules/libsql/**/*",
        "./node_modules/.pnpm/libsql@*/node_modules/@neon-rs/**/*",
        "./node_modules/.pnpm/libsql@*/node_modules/detect-libc/**/*",
        "./node_modules/.pnpm/libsql@*/node_modules/@libsql/**/*",
        "./node_modules/.pnpm/@libsql+*/node_modules/@libsql/**/*",
      ],
      "/api/ingest-document": [
        "./node_modules/fflate/**/*",
        "./node_modules/.pnpm/fflate@*/node_modules/fflate/**/*",
      ],
    },
    distDir: phase === "phase-development-server" ? ".next-dev" : ".next",
    devIndicators: false,
    async headers() {
      // Framing protection only: outbound YouTube/PDF frames, microphone,
      // workers and the prepaint theme script retain their existing behavior.
      // A complete script/connect CSP needs a separate compatibility rollout.
      const browserHeaders = [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ];
      const privateHeaders = [
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      ];
      return [{ source: "/:path*", headers: browserHeaders }, ...["/", "/admin/:path*", "/teacher/:path*", "/classroom/:path*", "/api/:path*", "/preview-mobile.html"].map(
        (source) => ({ source, headers: privateHeaders }),
      )];
    },
    experimental: {
      webpackBuildWorker: false,
      cpus: 1,
      // Next 15 static generation sends function-valued config to its worker.
      // Child-process workers support that transport; worker_threads do not.
      workerThreads: phase === "phase-development-server",
    },
  };
}
