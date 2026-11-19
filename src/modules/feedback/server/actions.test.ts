import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";
import { FEEDBACK_MESSAGES } from "@/modules/feedback/constants";
import {
  deleteFeedbackAction,
  markFeedbackSeenAction,
  sendFeedbackFormAction,
} from "@/modules/feedback/server/actions";
import {
  deleteFeedback,
  markFeedbackSeen,
  sendFeedback,
} from "@/modules/feedback/server/mutations";
import { getSessionToken } from "@/server/auth/cookies";
import { type AuthContext, validateSessionToken } from "@/server/auth/session";
import { logger } from "@/server/logger";

// Real guards (requireAccess), fake session lookup: tests the access rules end to end.
vi.mock("@/server/auth/cookies", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ validateSessionToken: vi.fn() }));
vi.mock("@/modules/feedback/server/mutations", () => ({
  sendFeedback: vi.fn(),
  markFeedbackSeen: vi.fn(),
  deleteFeedback: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const admin: AuthContext = {
  sessionId: "s-admin",
  account: { id: "account-admin", role: "admin", username: "admin", displayName: "Quản trị" },
};
const lan: AuthContext = {
  sessionId: "s-lan",
  account: { id: "account-lan", role: "doctor", username: "bs.lan", displayName: "BS. Lan" },
};

function signedInAs(auth: AuthContext | null) {
  vi.mocked(getSessionToken).mockResolvedValue(auth ? "token" : undefined);
  vi.mocked(validateSessionToken).mockResolvedValue(auth);
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const FEEDBACK_ID = "3e0c7d2a-5b1f-4c8e-9a6d-7f2e1b0c9d8a";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

describe("sendFeedbackFormAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInAs(lan);
    vi.mocked(headers).mockResolvedValue(new Headers({ "user-agent": IPHONE }));
    vi.mocked(sendFeedback).mockResolvedValue(FEEDBACK_ID);
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_test123");
  });

  it("Gửi góp ý: saves the trimmed text with the device and deployment, from the session", async () => {
    const result = await sendFeedbackFormAction(
      null,
      form({ content: "  Tìm bằng giọng nói hay nhận sai tên  " }),
    );

    expect(result).toEqual({ ok: true, data: { id: FEEDBACK_ID } });
    expect(sendFeedback).toHaveBeenCalledWith(
      lan,
      { content: "Tìm bằng giọng nói hay nhận sai tên" },
      { userAgent: IPHONE, deploymentId: "dpl_test123" },
    );
  });

  it("Gửi góp ý mạo danh bác sĩ khác: an account id in the form is ignored", async () => {
    await sendFeedbackFormAction(
      null,
      form({ content: "Góp ý", accountId: "account-minh", account_id: "account-minh" }),
    );

    const [auth, input] = vi.mocked(sendFeedback).mock.calls[0] ?? [];
    expect(auth).toBe(lan);
    expect(input).toEqual({ content: "Góp ý" });
  });

  it("Nội dung không vào log: no log call carries the text", async () => {
    const info = vi.spyOn(logger, "info");
    const error = vi.spyOn(logger, "error");
    const warn = vi.spyOn(logger, "warn");

    await sendFeedbackFormAction(null, form({ content: "Lỗi ở màn hình ghi chú" }));
    vi.mocked(sendFeedback).mockRejectedValueOnce(new Error("db down"));
    await sendFeedbackFormAction(null, form({ content: "Lỗi ở màn hình ghi chú" }));

    const logged = JSON.stringify([...info.mock.calls, ...error.mock.calls, ...warn.mock.calls]);
    expect(info).toHaveBeenCalledWith("Feedback sent", { feedbackId: FEEDBACK_ID });
    expect(logged).not.toContain("Lỗi ở màn hình ghi chú");
  });

  it("Chưa gõ gì / Quá dài: field errors, nothing saved", async () => {
    const empty = await sendFeedbackFormAction(null, form({ content: "   " }));
    const long = await sendFeedbackFormAction(null, form({ content: "a".repeat(2001) }));

    expect(empty).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    if (!empty.ok) expect(empty.error.fieldErrors?.content).toEqual([FEEDBACK_MESSAGES.empty]);
    if (!long.ok) expect(long.error.fieldErrors?.content).toEqual([FEEDBACK_MESSAGES.tooLong]);
    expect(sendFeedback).not.toHaveBeenCalled();
  });

  it("Vượt 20 góp ý trong 24 giờ: the limit message reaches the form", async () => {
    vi.mocked(sendFeedback).mockRejectedValue(
      new AppError("RATE_LIMITED", FEEDBACK_MESSAGES.rateLimited),
    );

    const result = await sendFeedbackFormAction(null, form({ content: "Góp ý" }));

    expect(result).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED", message: FEEDBACK_MESSAGES.rateLimited },
    });
  });

  it.each([
    ["admin", admin, "FORBIDDEN"],
    ["no session", null, "UNAUTHENTICATED"],
  ] as const)(
    "Admin hoặc người chưa đăng nhập gửi góp ý: %s is refused",
    async (_label, auth, code) => {
      signedInAs(auth);

      const result = await sendFeedbackFormAction(null, form({ content: "Góp ý" }));

      expect(result).toMatchObject({ ok: false, error: { code } });
      expect(sendFeedback).not.toHaveBeenCalled();
    },
  );
});

describe("admin feedback actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInAs(admin);
    vi.mocked(markFeedbackSeen).mockResolvedValue();
    vi.mocked(deleteFeedback).mockResolvedValue();
  });

  it("Đánh dấu đã xem / Xoá góp ý: the admin acts on the id", async () => {
    await expect(markFeedbackSeenAction({ id: FEEDBACK_ID })).resolves.toEqual({
      ok: true,
      data: { id: FEEDBACK_ID },
    });
    await expect(deleteFeedbackAction({ id: FEEDBACK_ID })).resolves.toEqual({
      ok: true,
      data: { id: FEEDBACK_ID },
    });
    expect(markFeedbackSeen).toHaveBeenCalledWith(FEEDBACK_ID);
    expect(deleteFeedback).toHaveBeenCalledWith(FEEDBACK_ID);
  });

  it("Góp ý đã bị xoá ở nơi khác: NOT_FOUND keeps its message", async () => {
    vi.mocked(deleteFeedback).mockRejectedValue(
      new AppError("NOT_FOUND", FEEDBACK_MESSAGES.notFound),
    );

    await expect(deleteFeedbackAction({ id: FEEDBACK_ID })).resolves.toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: FEEDBACK_MESSAGES.notFound },
    });
  });

  it.each([
    ["doctor", lan, "FORBIDDEN"],
    ["no session", null, "UNAUTHENTICATED"],
  ] as const)(
    "Bác sĩ gửi lệnh đánh dấu hoặc xoá góp ý: %s is refused",
    async (_label, auth, code) => {
      signedInAs(auth);

      await expect(markFeedbackSeenAction({ id: FEEDBACK_ID })).resolves.toMatchObject({
        ok: false,
        error: { code },
      });
      await expect(deleteFeedbackAction({ id: FEEDBACK_ID })).resolves.toMatchObject({
        ok: false,
        error: { code },
      });
      expect(markFeedbackSeen).not.toHaveBeenCalled();
      expect(deleteFeedback).not.toHaveBeenCalled();
    },
  );
});
