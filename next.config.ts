import type { NextConfig } from "next";

import packageJson from "./package.json" with { type: "json" };

const isDev = process.env.NODE_ENV !== "production";

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
  "img-src 'self' blob: data: https://*.supabase.co",
  "font-src 'self'",
  // `ws:` lets the development server's hot reload connect; not needed in production.
  `connect-src 'self' https://*.supabase.co${isDev ? " ws:" : ""}`,
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
  // Written into every backup's manifest.json (spec data-backup).
  env: { NEXT_PUBLIC_APP_VERSION: packageJson.version },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
