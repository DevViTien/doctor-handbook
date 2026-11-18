"use client";

import { CheckIcon, CopyIcon, InfoIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { FormAlert } from "@/components/common/form-alert";
import { FORM_INPUT_CLASS, FORM_LABEL_CLASS } from "@/components/common/password-input";
import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { formatDateTime } from "@/lib/date/format";
import { cn } from "@/lib/utils";
import { RECIPIENT_NAME_MAX_LENGTH } from "@/modules/admin/constants";
import { createAccessCodeFormAction, type IssuedAccessCode } from "@/modules/admin/server/actions";

const CARD_CLASS = "grid gap-3.5 rounded-2xl border bg-card p-4";

/**
 * "Tạo mã kích hoạt" card plus the card of the code just issued (spec access-codes, mockup of
 * change add-account-activation). The code only exists in this component's state: reloading
 * the page loses it by design (only its hash is stored).
 */
export function CreateAccessCodeForm() {
  const [state, formAction, isPending] = useActionState(createAccessCodeFormAction, null);
  const [submittedName, setSubmittedName] = useState("");

  // Keep the last issued code on screen when a later submission fails (e.g. an empty name):
  // losing it would force the admin to revoke it. Derived during render, not in an effect.
  // Seeded from `state` too: without JavaScript the page is rendered with the action result.
  const [issued, setIssued] = useState<IssuedAccessCode | null>(state?.ok ? state.data : null);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setIssued(state.data);
  }

  const error = state && !state.ok ? state.error : null;
  const nameError =
    error?.code === "VALIDATION_FAILED" ? error.fieldErrors?.recipientName?.[0] : undefined;
  const formError = error && !nameError ? error : null;

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (nameError) nameRef.current?.focus();
  }, [nameError, state]);

  return (
    <div className="grid min-w-0 gap-4">
      <form
        action={formAction}
        onSubmit={(event) =>
          setSubmittedName(String(new FormData(event.currentTarget).get("recipientName") ?? ""))
        }
        noValidate
        className={CARD_CLASS}
        aria-labelledby="create-code-title"
      >
        <div className="grid gap-1">
          <h2 id="create-code-title" className="text-[1.05rem] font-bold">
            Tạo mã kích hoạt
          </h2>
          <p className="text-sm text-muted-foreground">Mỗi mã tạo được một tài khoản bác sĩ.</p>
        </div>

        {formError ? <FormAlert error={formError} /> : null}

        <Field data-invalid={nameError ? true : undefined}>
          <FieldLabel htmlFor="recipientName" className={FORM_LABEL_CLASS}>
            Tên người nhận
          </FieldLabel>
          <Input
            ref={nameRef}
            id="recipientName"
            name="recipientName"
            type="text"
            // A failed submission keeps what was typed; a successful one clears the field.
            defaultValue={state?.ok ? "" : submittedName}
            placeholder="Ví dụ: BS. Trần Thị B"
            autoComplete="off"
            maxLength={RECIPIENT_NAME_MAX_LENGTH + 20}
            enterKeyHint="done"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "recipientName-error" : "recipientName-hint"}
            className={FORM_INPUT_CLASS}
          />
          {nameError ? (
            <FieldError id="recipientName-error">{nameError}</FieldError>
          ) : (
            <FieldDescription id="recipientName-hint">Để biết mã này gửi cho ai.</FieldDescription>
          )}
        </Field>

        <Button type="submit" disabled={isPending} className="h-12 w-full text-base font-semibold">
          {isPending ? (
            <>
              <Spinner className="size-5" label={null} />
              Đang tạo mã…
            </>
          ) : (
            "Tạo mã"
          )}
        </Button>
      </form>

      {issued ? <IssuedCodeCard key={issued.code} issued={issued} /> : null}
    </div>
  );
}

const subscribeToNothing = () => () => {};

/** The freshly issued code: the one emphasized element of the screen (design §6). */
function IssuedCodeCard({ issued }: { issued: IssuedAccessCode }) {
  // The app's own origin, so the link always matches where the admin is (no config needed).
  const origin = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => "",
  );
  const expiresAt = formatDateTime(issued.expiresAt);
  const message =
    `Mã kích hoạt ${siteConfig.name}: ${issued.code}\n` +
    `Mở ${origin}${routes.auth.activate} để tạo tài khoản. ` +
    `Mã dùng một lần, hết hạn lúc ${expiresAt}.`;

  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (copyState !== "copied") return;
    const timer = setTimeout(() => setCopyState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copyState]);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  const copied = copyState === "copied";

  return (
    <section
      aria-labelledby="issued-code-title"
      className={cn(CARD_CLASS, "border-2 border-primary")}
    >
      <h2 id="issued-code-title" className="text-[1.05rem] font-bold">
        Mã vừa tạo
      </h2>
      <p className="text-[0.95rem] wrap-break-word">
        Cho <strong>{issued.recipientName}</strong>
      </p>
      <p
        translate="no"
        data-testid="issued-code"
        className="rounded-xl border-2 border-dashed border-primary px-3 py-3.5 text-center text-[1.75rem] leading-tight font-bold tracking-[0.16em] tabular-nums select-all"
      >
        {issued.code}
      </p>
      <p className="-mt-1 text-center text-sm text-muted-foreground">Hết hạn {expiresAt}</p>

      <Button
        type="button"
        variant={copied ? "outline" : "default"}
        onClick={copyMessage}
        className={cn(
          "h-12 w-full text-base font-semibold",
          copied && "border-input bg-card dark:bg-card",
        )}
      >
        {copied ? (
          <CheckIcon className="size-5" aria-hidden />
        ) : (
          <CopyIcon className="size-5" aria-hidden />
        )}
        {copied ? "Đã sao chép" : "Sao chép tin nhắn"}
      </Button>
      <p className="rounded-lg bg-muted px-3 py-2.5 text-[0.85rem] wrap-break-word whitespace-pre-wrap text-muted-foreground">
        {message}
      </p>
      <p className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2.5 text-sm font-medium text-warning">
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        Mã chỉ hiện một lần. Tải lại trang là không xem lại được.
      </p>
      <p role="status" className="sr-only">
        {copied ? "Đã sao chép tin nhắn" : ""}
      </p>
      {copyState === "failed" ? (
        <FormAlert
          error={{ code: "INTERNAL", message: "Không sao chép được. Hãy chọn và sao chép mã." }}
        />
      ) : null}
    </section>
  );
}
