"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { routes } from "@/config/routes";
import { feedbackIdSchema, sendFeedbackSchema } from "@/modules/feedback/schemas";
import {
  deleteFeedback,
  markFeedbackSeen,
  sendFeedback,
} from "@/modules/feedback/server/mutations";
import { createAction, createFormAction } from "@/server/actions/create-action";
import { logger } from "@/server/logger";

/**
 * Doctor: "Gửi góp ý" (spec feedback). The browser sends only the text; the device comes from
 * the request's `User-Agent`, the deployment from the environment, the sender from the session.
 * The text is never logged.
 */
export const sendFeedbackFormAction = createFormAction(
  { name: "feedback.send", schema: sendFeedbackSchema, access: "doctor" },
  async (input, { auth }) => {
    const requestHeaders = await headers();
    const id = await sendFeedback(auth, input, {
      userAgent: requestHeaders.get("user-agent"),
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    });
    logger.info("Feedback sent", { feedbackId: id });
    revalidatePath(routes.admin.feedback);
    return { id };
  },
);

/** Admin: "Đã xem". */
export const markFeedbackSeenAction = createAction(
  { name: "feedback.markSeen", schema: feedbackIdSchema, access: "admin" },
  async ({ id }) => {
    await markFeedbackSeen(id);
    revalidatePath(routes.admin.feedback);
    return { id };
  },
);

/** Admin: "Xoá góp ý" (after the confirm dialog). */
export const deleteFeedbackAction = createAction(
  { name: "feedback.delete", schema: feedbackIdSchema, access: "admin" },
  async ({ id }) => {
    await deleteFeedback(id);
    logger.info("Feedback deleted", { feedbackId: id });
    revalidatePath(routes.admin.feedback);
    return { id };
  },
);
