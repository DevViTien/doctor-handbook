"use client";

import { useEffect } from "react";

import { startInstallPromptCapture } from "@/lib/pwa/install-prompt";

/**
 * PWA plumbing mounted once (spec app-install): registers /sw.js in production builds (never in
 * `next dev`, where a cache would serve stale code), and keeps the install prompt for Settings.
 * A blocked registration (private mode, policy) is ignored: the app works the same without it.
 */
export function PwaSetup() {
  useEffect(() => {
    const stop = startInstallPromptCapture();
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      } else {
        // A worker left by a production run on this origin would serve stale dev chunks.
        void navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => registrations.forEach((r) => void r.unregister()));
      }
    }
    return stop;
  }, []);
  return null;
}
