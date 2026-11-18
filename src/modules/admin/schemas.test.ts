import { describe, expect, it } from "vitest";

import { ADMIN_MESSAGES } from "@/modules/admin/constants";
import { createAccessCodeSchema, revokeAccessCodeSchema } from "@/modules/admin/schemas";

describe("createAccessCodeSchema", () => {
  it("trims the recipient name", () => {
    expect(createAccessCodeSchema.parse({ recipientName: "  BS. Trần Thị B " })).toEqual({
      recipientName: "BS. Trần Thị B",
    });
  });

  it.each(["", "   ", undefined])("Bỏ trống tên người nhận (%j)", (recipientName) => {
    const result = createAccessCodeSchema.safeParse({ recipientName });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["recipientName"],
      message: ADMIN_MESSAGES.recipientRequired,
    });
  });

  it("rejects names longer than 80 characters with a Vietnamese message", () => {
    const result = createAccessCodeSchema.safeParse({ recipientName: "a".repeat(81) });
    expect(result.error?.issues[0]?.message).toBe(ADMIN_MESSAGES.recipientTooLong);
    expect(createAccessCodeSchema.safeParse({ recipientName: "a".repeat(80) }).success).toBe(true);
  });
});

describe("revokeAccessCodeSchema", () => {
  it("only accepts a UUID", () => {
    expect(revokeAccessCodeSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
    expect(
      revokeAccessCodeSchema.safeParse({ id: "0b9f4f0e-4a43-4c9e-9a51-3d3a8a9a6f10" }).success,
    ).toBe(true);
  });
});
