import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";
import { FEEDBACK_MESSAGES } from "@/modules/feedback/constants";
import {
  deleteFeedback,
  markFeedbackSeen,
  sendFeedback,
} from "@/modules/feedback/server/mutations";
import type { AuthContext } from "@/server/auth/session";
import type { DbExecutor } from "@/server/db/client";

vi.mock("@/server/db/client", () => ({ getDb: vi.fn() }));

const lan: AuthContext = {
  sessionId: "s-lan",
  account: { id: "account-lan", role: "doctor", username: "bs.lan", displayName: "BS. Lan" },
};
const META = { userAgent: "UA", deploymentId: "dpl_1" };

describe("sendFeedback", () => {
  let inserted: Record<string, unknown>[];
  let lockMode: string | undefined;

  /** A transaction answering the account lock, then the 24-hour count, recording inserts. */
  function fakeDb(recent: number, accountExists = true): DbExecutor {
    let selects = 0;
    const tx = {
      select: () => ({
        from: () => ({
          where: () => {
            selects += 1;
            if (selects === 1) {
              return {
                for: async (mode: string) => {
                  lockMode = mode;
                  return accountExists ? [{ id: lan.account.id }] : [];
                },
              };
            }
            return Promise.resolve([{ total: recent }]);
          },
        }),
      }),
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          returning: async () => {
            inserted.push(values);
            return [{ id: "new-id" }];
          },
        }),
      }),
    };
    return { transaction: async <T>(run: (t: typeof tx) => Promise<T>) => run(tx) } as never;
  }

  beforeEach(() => {
    inserted = [];
    lockMode = undefined;
  });

  it("Gửi góp ý: signs it with the session's account, after locking that account", async () => {
    await expect(sendFeedback(lan, { content: "Góp ý" }, META, fakeDb(3))).resolves.toBe("new-id");

    expect(lockMode).toBe("no key update");
    expect(inserted).toEqual([
      { accountId: "account-lan", content: "Góp ý", userAgent: "UA", deploymentId: "dpl_1" },
    ]);
  });

  it("keeps at most 400 characters of the user agent, and stores missing meta as null", async () => {
    await sendFeedback(
      lan,
      { content: "Góp ý" },
      { userAgent: "x".repeat(900), deploymentId: "" },
      fakeDb(0),
    );
    await sendFeedback(
      lan,
      { content: "Góp ý" },
      { userAgent: null, deploymentId: null },
      fakeDb(0),
    );

    expect(String(inserted[0]?.userAgent)).toHaveLength(400);
    expect(inserted[0]?.deploymentId).toBeNull();
    expect(inserted[1]).toMatchObject({ userAgent: null, deploymentId: null });
  });

  it("Vượt 20 góp ý trong 24 giờ: the 21st is refused and nothing is inserted", async () => {
    await expect(sendFeedback(lan, { content: "Góp ý" }, META, fakeDb(19))).resolves.toBe("new-id");
    await expect(sendFeedback(lan, { content: "Góp ý" }, META, fakeDb(20))).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: FEEDBACK_MESSAGES.rateLimited,
    });
    expect(inserted).toHaveLength(1);
  });

  it("refuses an account that no longer exists", async () => {
    await expect(
      sendFeedback(lan, { content: "Góp ý" }, META, fakeDb(0, false)),
    ).rejects.toBeInstanceOf(AppError);
    expect(inserted).toHaveLength(0);
  });
});

describe("markFeedbackSeen", () => {
  function fakeDb(updated: boolean, exists: boolean): DbExecutor {
    return {
      update: () => ({
        set: () => ({ where: () => ({ returning: async () => (updated ? [{ id: "f" }] : []) }) }),
      }),
      select: () => ({ from: () => ({ where: async () => (exists ? [{ id: "f" }] : []) }) }),
    } as never;
  }

  it("Đánh dấu đã xem: marks an unseen feedback", async () => {
    await expect(markFeedbackSeen("f", fakeDb(true, true))).resolves.toBeUndefined();
  });

  it("an already seen feedback is fine", async () => {
    await expect(markFeedbackSeen("f", fakeDb(false, true))).resolves.toBeUndefined();
  });

  it("a feedback that is gone is NOT_FOUND", async () => {
    await expect(markFeedbackSeen("f", fakeDb(false, false))).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: FEEDBACK_MESSAGES.notFound,
    });
  });
});

describe("deleteFeedback", () => {
  const fakeDb = (deleted: boolean): DbExecutor =>
    ({
      delete: () => ({ where: () => ({ returning: async () => (deleted ? [{ id: "f" }] : []) }) }),
    }) as never;

  it("Xoá góp ý: deletes it", async () => {
    await expect(deleteFeedback("f", fakeDb(true))).resolves.toBeUndefined();
  });

  it("Góp ý đã bị xoá ở nơi khác: NOT_FOUND", async () => {
    await expect(deleteFeedback("f", fakeDb(false))).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: FEEDBACK_MESSAGES.notFound,
    });
  });
});
