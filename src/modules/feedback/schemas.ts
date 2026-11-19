import { z } from "zod";

import { FEEDBACK_LIMITS, FEEDBACK_MESSAGES } from "@/modules/feedback/constants";

/**
 * Send feedback: only the text. Device, time and deployment are read on the server, and the
 * sender always comes from the session; any other field a browser sends is dropped.
 */
export const sendFeedbackSchema = z.object({
  content: z
    .string(FEEDBACK_MESSAGES.empty)
    .transform((value) => value.normalize("NFC").trim())
    .pipe(
      z
        .string()
        .min(1, FEEDBACK_MESSAGES.empty)
        .max(FEEDBACK_LIMITS.content, FEEDBACK_MESSAGES.tooLong),
    ),
});

/** Mark seen / delete: the feedback to act on. */
export const feedbackIdSchema = z.object({ id: z.uuid() });

export type SendFeedbackInput = z.input<typeof sendFeedbackSchema>;
export type FeedbackIdInput = z.input<typeof feedbackIdSchema>;
