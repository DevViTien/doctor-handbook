import { describe, expect, it } from "vitest";

import {
  AUTH_ATTEMPT_RETENTION_MS,
  CODE_ENTRY_FAILURE_WINDOW_MS,
  CODE_ENTRY_MAX_FAILURES_PER_IP,
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_MAX_FAILURES_PER_IP,
  LOGIN_MAX_FAILURES_PER_USERNAME,
} from "@/server/auth/constants";

describe("login rate-limit constants", () => {
  it("keeps the failure window within what the daily cron retains", () => {
    expect(LOGIN_FAILURE_WINDOW_MS).toBeLessThanOrEqual(AUTH_ATTEMPT_RETENTION_MS);
  });

  it("matches the thresholds of spec account-session", () => {
    expect(LOGIN_MAX_FAILURES_PER_USERNAME).toBe(5);
    expect(LOGIN_MAX_FAILURES_PER_IP).toBe(20);
    expect(LOGIN_FAILURE_WINDOW_MS).toBe(15 * 60 * 1000);
  });
});

describe("activation code rate-limit constants", () => {
  it("keeps the failure window within what the daily cron retains", () => {
    expect(CODE_ENTRY_FAILURE_WINDOW_MS).toBeLessThanOrEqual(AUTH_ATTEMPT_RETENTION_MS);
  });

  it("matches the thresholds of spec account-activation", () => {
    expect(CODE_ENTRY_MAX_FAILURES_PER_IP).toBe(10);
    expect(CODE_ENTRY_FAILURE_WINDOW_MS).toBe(15 * 60 * 1000);
  });
});
