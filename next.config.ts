import type { NextConfig } from "next";

import packageJson from "./package.json" with { type: "json" };

const isDev = process.env.NODE_ENV !== "production";

/**
 * Origin of Supabase Storage (avatars are loaded from and uploaded to it directly). From
 * `SUPABASE_URL` at build time, so E2E can point at its fake Storage; any Supabase project
 * otherwise.
 */
const storageOrigin = (() => {
  try {
    return new URL(process.env.SUPABASE_URL ?? "").origin;
  } catch {
    return "https://*.supabase.co";
  }
})();

/**
 * Content Security Policy.
 * - Supabase is the only third-party origin: private images are served via signed URLs
 *   and uploads go straight from the browser to Supabase Storage.
 * - `unsafe-inline` for scripts is required by Next.js unless nonces are used;
 *   `unsafe-eval` is only needed by React in development.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${storageOrigin}`,
  "font-src 'self'",
  // `ws:` lets the development server's hot reload connect; not needed in production.
  `connect-src 'self' ${storageOrigin}${isDev ? " ws:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // HTTPS only exists on Vercel; sending HSTS from a local http server is pointless.
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000" }]),
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera: patient avatars. Microphone: voice search.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  poweredByHeader: false,
  // Version skew: every build gives Server Actions new IDs. With the deployment id, a client-side
  // navigation across deployments becomes a full page load, and an open page can compare itself
  // with the live deployment (src/lib/pwa/app-update.ts). Unset outside Vercel.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
  env: {
    // Written into every backup's manifest.json (spec data-backup).
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_DEPLOYMENT_ID: process.env.VERCEL_DEPLOYMENT_ID ?? "",
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must always be checked for a new version (spec app-install).
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
