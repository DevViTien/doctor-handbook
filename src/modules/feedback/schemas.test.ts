import { describe, expect, it } from "vitest";

import { FEEDBACK_MESSAGES } from "@/modules/feedback/constants";
import { feedbackIdSchema, sendFeedbackSchema } from "@/modules/feedback/schemas";

const firstError = (input: unknown) => {
  const result = sendFeedbackSchema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message;
};

describe("sendFeedbackSchema", () => {
  it("trims the text", () => {
    expect(sendFeedbackSchema.parse({ content: "  Nút lưu khó bấm \n" })).toEqual({
      content: "Nút lưu khó bấm",
    });
  });

  it("refuses empty or blank text", () => {
    expect(firstError({ content: "" })).toBe(FEEDBACK_MESSAGES.empty);
    expect(firstError({ content: "   \n " })).toBe(FEEDBACK_MESSAGES.empty);
    expect(firstError({})).toBe(FEEDBACK_MESSAGES.empty);
  });

  it("accepts 2000 characters and refuses 2001, counted after trimming", () => {
    expect(firstError({ content: `  ${"a".repeat(2000)}  ` })).toBeNull();
    expect(firstError({ content: "a".repeat(2001) })).toBe(FEEDBACK_MESSAGES.tooLong);
  });

  it("drops any other field, such as an account id", () => {
    const parsed = sendFeedbackSchema.parse({
      content: "Góp ý",
      accountId: "11111111-1111-4111-8111-111111111111",
    });
    expect(parsed).toEqual({ content: "Góp ý" });
  });
});

describe("feedbackIdSchema", () => {
  it("only takes a UUID", () => {
    expect(feedbackIdSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
    expect(feedbackIdSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111" }).success).toBe(
      true,
    );
  });
});
