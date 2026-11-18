import type { Route } from "next";

/**
 * Single source of truth for application paths.
 * Never hard-code a path string in components: import it from here so that renaming a
 * route is a one-line change (and `typedRoutes` catches typos at build time).
 */
export const routes = {
  home: "/",
  auth: {
    login: "/login",
    activate: "/activate",
    resetPassword: "/reset-password",
  },
  doctor: {
    patients: "/patients",
    newPatient: "/patients/new",
    /** Patient pages carry only the random id, never patient data (spec patient-records). */
    patient: (id: string) => `/patients/${id}` as Route,
    editPatient: (id: string) => `/patients/${id}/edit` as Route,
    todos: "/todos",
    settings: "/settings",
    trash: "/settings/trash",
  },
  admin: {
    root: "/admin",
    accessCodes: "/admin/access-codes",
    accounts: "/admin/accounts",
  },
  api: {
    health: "/api/health",
    /** Deep patient search (POST, JSON body): the query never goes in the URL. */
    patientSearch: "/api/patients/search",
    /** Drops a dead session cookie, then sends the user to login (see guards.ts). */
    clearSession: "/api/auth/clear-session",
    cron: "/api/cron",
  },
} as const;

/** Paths reachable without a session. Matched by prefix. */
const PUBLIC_PATH_PREFIXES: readonly string[] = [
  routes.auth.login,
  routes.auth.activate,
  routes.auth.resetPassword,
  routes.api.health,
  routes.api.clearSession,
  // Cron routes authenticate with CRON_SECRET instead of a session.
  routes.api.cron,
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/** Login URL that brings the user back to `nextPath` afterwards. */
export function buildLoginPath(nextPath?: string | null): string {
  if (!nextPath || nextPath === routes.home) return routes.auth.login;
  return `${routes.auth.login}?${new URLSearchParams({ next: nextPath }).toString()}`;
}
