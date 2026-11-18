import { useSyncExternalStore } from "react";

/**
 * Whether and how this device can install the app (spec app-install, design §4). Chrome's
 * `beforeinstallprompt` usually fires right after the app opens, long before the doctor visits
 * Settings: `startInstallPromptCapture()` (mounted once in `AppProviders`) keeps it until used.
 */

/** `installed`: opened from the home-screen icon; `justInstalled`: installed from this browser. */
export type InstallState =
  "installed" | "justInstalled" | "prompt" | "dismissed" | "ios" | "unsupported";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
let installedNow = false;
let dismissedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Set by the inline script in the root layout, which listens before React hydrates. */
type EarlyWindow = Window & { __dhInstallPrompt?: Event };

export function startInstallPromptCapture(): () => void {
  const early = (window as EarlyWindow).__dhInstallPrompt;
  if (early) {
    deferred = early as InstallPromptEvent;
    (window as EarlyWindow).__dhInstallPrompt = undefined;
    notify();
  }
  const onPrompt = (event: Event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    dismissedNow = false;
    notify();
  };
  const onInstalled = () => {
    deferred = null;
    installedNow = true;
    notify();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

/**
 * iPhone / iPad (iPadOS reports a Mac with touch). Every browser there is WebKit, and since iOS
 * 16.4 each one adds to the home screen from its Share menu: they all get the same steps.
 */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function readInstallState(): InstallState {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  if (installedNow) return "justInstalled";
  if (deferred) return "prompt";
  if (dismissedNow) return "dismissed";
  if (isIos(navigator.userAgent, navigator.maxTouchPoints)) return "ios";
  return "unsupported";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    query.removeEventListener("change", listener);
  };
}

/** `null` on the server and during hydration: render nothing until the device is known. */
export function useInstallState(): InstallState | null {
  return useSyncExternalStore(subscribe, readInstallState, () => null);
}

/** Opens the browser's install dialog; `true` when the doctor accepted. Usable once. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") installedNow = true;
  // Chrome offers the dialog again only after a reload.
  else dismissedNow = true;
  notify();
  return outcome === "accepted";
}
