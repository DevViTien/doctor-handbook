"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import {
  APP_UPDATE_MESSAGES,
  startUpdateWatch,
  UPDATE_TOAST_ID,
  useUpdateAvailable,
} from "@/lib/pwa/app-update";
import { startInstallPromptCapture } from "@/lib/pwa/install-prompt";

/**
 * PWA plumbing mounted once (spec app-install): registers /sw.js in production builds (never in
 * `next dev`, where a cache would serve stale code), keeps the install prompt for Settings, and
 * tells the doctor when a newer deployment is live (`app-update.ts`). A blocked registration
 * (private mode, policy) is ignored: the app works the same without it.
 */
export function PwaSetup() {
  const updateAvailable = useUpdateAvailable();

  useEffect(() => {
    const stopPrompt = startInstallPromptCapture();
    const stopUpdates = startUpdateWatch();
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
    return () => {
      stopPrompt();
      stopUpdates();
    };
  }, []);

  useEffect(() => {
    if (!updateAvailable) return;
    // Stays until the doctor reloads: saving cannot work on this page any more.
    toast(APP_UPDATE_MESSAGES.toast, {
      id: UPDATE_TOAST_ID,
      duration: Infinity,
      action: { label: APP_UPDATE_MESSAGES.reload, onClick: () => window.location.reload() },
    });
  }, [updateAvailable]);

  return null;
}
