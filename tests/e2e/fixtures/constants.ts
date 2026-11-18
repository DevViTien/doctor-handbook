/**
 * Values shared by `playwright.config.ts` (web server env) and the E2E fixtures. Kept free of
 * heavy imports so the config can load it.
 */

/** Pepper of the E2E web server; the fixtures hash access codes with it too. */
export const E2E_ACCESS_CODE_PEPPER = "e2e-access-code-pepper-0123456789abcdef";

/** Client IP every E2E request claims (`x-real-ip`), see playwright.config.ts. */
export const E2E_CLIENT_IP = "203.0.113.10";
