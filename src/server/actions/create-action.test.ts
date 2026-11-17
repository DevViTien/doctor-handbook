import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import { createAction } from "@/server/actions/create-action";
import { getCurrentAuth, requireAccess } from "@/server/auth/guards";
import type { AuthContext } from "@/server/auth/session";

vi.mock("@/server/auth/guards", () => ({
  getCurrentAuth: vi.fn(),
  requireAccess: vi.fn(),
}));

const doctorAuth: AuthContext = {
  sessionId: "session-1",
  account: { id: "account-1", role: "doctor", username: "bs.lan", displayName: "BS. Lan" },
};

const schema = z.object({ content: z.string().trim().min(1) });

describe("createAction", () => {
  beforeEach(() => {
    vi.mocked(requireAccess).mockResolvedValue(doctorAuth);
    vi.mocked(getCurrentAuth).mockResolvedValue(null);
  });

  it("passes parsed input and auth context to the handler", async () => {
    const action = createAction({ name: "test.ok", schema }, async (input, { auth }) => ({
      content: input.content,
      owner: auth.account.id,
    }));

    await expect(action({ content: "  hello " })).resolves.toEqual({
      ok: true,
      data: { content: "hello", owner: "account-1" },
    });
    expect(requireAccess).toHaveBeenCalledWith("doctor");
  });

  it("returns field errors when validation fails", async () => {
    const handler = vi.fn();
    const action = createAction({ name: "test.invalid", schema }, handler);

    const result = await action({ content: "   " });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.fieldErrors?.content).toBeDefined();
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it("maps AppError to its code", async () => {
    vi.mocked(requireAccess).mockRejectedValue(new AppError("UNAUTHENTICATED"));
    const action = createAction({ name: "test.denied", schema }, async () => "never");

    const result = await action({ content: "x" });

    expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("hides unexpected errors behind INTERNAL", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const action = createAction({ name: "test.crash", schema }, async () => {
      throw new Error("database exploded");
    });

    const result = await action({ content: "x" });

    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    if (!result.ok) expect(result.error.message).not.toContain("database");
  });

  it("does not require a session for public actions", async () => {
    const action = createAction(
      { name: "test.public", schema, access: "public" },
      async (_input, { auth }) => auth,
    );

    await expect(action({ content: "x" })).resolves.toEqual({ ok: true, data: null });
    expect(requireAccess).not.toHaveBeenCalled();
  });
});
