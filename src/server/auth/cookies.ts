import "server-only";

import { cookies } from "next/headers";

import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "./constants";

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}

/** Only callable from Server Actions and Route Handlers (Next.js restriction). */
export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

/** Only callable from Server Actions and Route Handlers (Next.js restriction). */
export async function deleteSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}
