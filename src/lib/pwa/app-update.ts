import { unstable_isUnrecognizedActionError } from "next/navigation";
import { useSyncExternalStore } from "react";

/**
 * "A newer deployment is live" (version skew). Every build gives Server Actions new IDs, so a page
 * loaded before a deploy can no longer save anything: Next answers its actions with
 * `x-nextjs-action-not-found: 1`. Detected in one place for every action (form or object call):
 *
 * - `fetch` is wrapped once: any response carrying that header marks the update;
 * - when the app comes back to the foreground or online, `/api/health` tells which deployment is
 *   live, compared with the one that built this page (on Vercel only), so the doctor is told
 *   before typing rather than after.
 *
 * Client-side navigations are covered by Next itself: with `deploymentId` set (next.config.ts) a
 * navigation across deployments becomes a full page load.
 */

/** Deployment that built this page; empty outside Vercel (no check then). */
export const BUILD_DEPLOYMENT_ID = process.env.NEXT_PUBLIC_DEPLOYMENT_ID ?? "";

/** Sonner id of the lasting "Tải lại" toast (one at a time). */
export const UPDATE_TOAST_ID = "app-update";

const ACTION_NOT_FOUND_HEADER = "x-nextjs-action-not-found";
const HEALTH_URL = "/api/health";

let updateAvailable = false;
const listeners = new Set<() => void>();

export function markUpdateAvailable(): void {
  if (updateAvailable) return;
  updateAvailable = true;
  listeners.forEach((listener) => listener());
}

/** A Server Action that the live deployment does not know: this page is from an older one. */
export function isStaleActionError(error: unknown): boolean {
  return unstable_isUnrecognizedActionError(error);
}

export function isNewerDeployment(liveId: unknown, buildId: string = BUILD_DEPLOYMENT_ID): boolean {
  return typeof liveId === "string" && liveId !== "" && buildId !== "" && liveId !== buildId;
}

export function startUpdateWatch(): () => void {
  const originalFetch = window.fetch;
  const watchedFetch: typeof window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (response.headers.get(ACTION_NOT_FOUND_HEADER) === "1") markUpdateAvailable();
    return response;
  };
  window.fetch = watchedFetch;

  const check = async () => {
    if (!BUILD_DEPLOYMENT_ID || updateAvailable || document.visibilityState !== "visible") return;
    try {
      const response = await originalFetch(HEALTH_URL, { cache: "no-store" });
      const body = (await response.json()) as { deploymentId?: unknown };
      if (isNewerDeployment(body.deploymentId)) markUpdateAvailable();
    } catch {
      // Offline or a bad answer: checked again on the next return to the app.
    }
  };
  const onVisibility = () => void check();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onVisibility);

  return () => {
    if (window.fetch === watchedFetch) window.fetch = originalFetch;
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", onVisibility);
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => updateAvailable,
    () => false,
  );
}

/** Shown wherever a save was refused because the page is older than the live app. */
export const APP_UPDATE_MESSAGES = {
  title: "Ứng dụng vừa có bản mới",
  toast: "Ứng dụng vừa có bản mới. Tải lại trang để lưu tiếp.",
  reload: "Tải lại",
  reloadPage: "Tải lại trang",
  boundary: "Tải lại trang để dùng tiếp.",
  patientForm:
    "Chưa lưu được vì ứng dụng vừa có bản mới. Chép lại phần vừa gõ, tải lại trang rồi lưu lại.",
} as const;
