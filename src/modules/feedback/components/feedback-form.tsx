"use client";

import { CircleCheckIcon, ShieldAlertIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { FormAlert } from "@/components/common/form-alert";
import { FORM_LABEL_CLASS } from "@/components/common/password-input";
import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { isStaleActionError } from "@/lib/pwa/app-update";
import type { ActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";
import { FEEDBACK_LIMITS, FEEDBACK_MESSAGES } from "@/modules/feedback/constants";
import { sendFeedbackFormAction } from "@/modules/feedback/server/actions";

type Sent = { id: string };
type FeedbackFormState = { result: ActionResult<Sent>; content: string } | null;

/** A send that never got an answer: the request or its response was lost (the network). */
const NETWORK_FAILURE: ActionResult<Sent> = {
  ok: false,
  error: { code: "INTERNAL", message: FEEDBACK_MESSAGES.offline },
};

/** An older page than the live app: sending again would never work. */
const STALE_PAGE: ActionResult<Sent> = {
  ok: false,
  error: { code: "INTERNAL", message: FEEDBACK_MESSAGES.stale },
};

const CONTENT_ID = "feedback-content";
const length = (value: string) => value.normalize("NFC").trim().length;

/**
 * "Góp ý" form of a doctor (spec feedback, mockup of change add-feedback). One text box, one
 * button, no dialog (N2). Nothing typed is lost on a failed send: the action is wrapped so a
 * network failure becomes a normal error, and the box is uncontrolled with `defaultValue` = its
 * text when the answer came back, so React's automatic `form.reset()` puts it back. Only a
 * successful send empties it.
 */
export function FeedbackForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (_previous: FeedbackFormState, formData: FormData): Promise<FeedbackFormState> => {
      let result: ActionResult<Sent>;
      try {
        result = await sendFeedbackFormAction(null, formData);
      } catch (error) {
        result = isStaleActionError(error) ? STALE_PAGE : NETWORK_FAILURE;
      }
      const current = formRef.current ? new FormData(formRef.current) : formData;
      return { result, content: result.ok ? "" : String(current.get("content") ?? "") };
    },
    null,
  );

  // Live length for the counter; follows the box when the answer comes back (derived during
  // render, not in an effect).
  const [typed, setTyped] = useState(0);
  // "Đã gửi" only until the doctor types again (even if the box is emptied afterwards).
  const [editedSinceAnswer, setEditedSinceAnswer] = useState(false);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setTyped(length(state?.content ?? ""));
    setEditedSinceAnswer(false);
  }

  const error = state && !state.result.ok ? state.result.error : null;
  const contentError = error?.fieldErrors?.content?.[0];
  const formError = error && !contentError ? error : null;
  const sent = state?.result.ok === true && !editedSinceAnswer;
  const over = typed - FEEDBACK_LIMITS.content;

  useEffect(() => {
    if (contentError) contentRef.current?.focus();
  }, [contentError, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      aria-label="Gửi góp ý"
      className="grid gap-3.5 rounded-2xl border bg-card p-4"
    >
      {sent ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg bg-secondary px-3.5 py-3 text-[0.95rem] font-semibold"
        >
          <CircleCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <span>{FEEDBACK_MESSAGES.sent}</span>
        </div>
      ) : null}
      {formError ? <FormAlert error={formError} /> : null}

      <Field data-invalid={contentError ? true : undefined}>
        <FieldLabel htmlFor={CONTENT_ID} className={FORM_LABEL_CLASS}>
          Nội dung góp ý
        </FieldLabel>
        <p
          id="feedback-privacy"
          className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2.5 text-sm"
        >
          <ShieldAlertIcon className="mt-px size-4 shrink-0 text-primary" aria-hidden />
          <span>{FEEDBACK_MESSAGES.privacy}</span>
        </p>
        <Textarea
          ref={contentRef}
          id={CONTENT_ID}
          name="content"
          defaultValue={state?.content ?? ""}
          onChange={(event) => {
            setTyped(length(event.target.value));
            setEditedSinceAnswer(true);
          }}
          readOnly={isPending}
          rows={6}
          placeholder="Ví dụ: Tìm bằng giọng nói hay nhận sai tên có dấu."
          aria-invalid={contentError ? true : undefined}
          aria-describedby={cn(
            "feedback-privacy",
            contentError ? "feedback-content-error" : "feedback-count",
          )}
          className="min-h-42 bg-card px-3.5 py-3 text-base leading-normal md:text-base dark:bg-card"
        />
        <div className="flex items-baseline gap-3 text-sm">
          {contentError ? (
            <FieldError id="feedback-content-error">{contentError}</FieldError>
          ) : null}
          <span
            id="feedback-count"
            className={cn(
              "ml-auto whitespace-nowrap tabular-nums",
              over > 0 ? "font-semibold text-destructive" : "text-muted-foreground",
            )}
          >
            {typed.toLocaleString("vi-VN")}/{FEEDBACK_LIMITS.content.toLocaleString("vi-VN")}
            {over > 0 ? ` · quá ${over.toLocaleString("vi-VN")} ký tự` : null}
          </span>
        </div>
      </Field>

      <Button type="submit" disabled={isPending} className="h-12 w-full text-base font-semibold">
        {isPending ? (
          <>
            <Spinner className="size-5" label={null} />
            Đang gửi…
          </>
        ) : (
          "Gửi góp ý"
        )}
      </Button>
    </form>
  );
}
