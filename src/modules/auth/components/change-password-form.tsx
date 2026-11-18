"use client";

import { CircleCheckIcon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { FormAlert } from "@/components/common/form-alert";
import { FORM_LABEL_CLASS, PasswordInput } from "@/components/common/password-input";
import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { PASSWORD_CHANGE_MESSAGES } from "@/modules/auth/constants";
import { changePasswordFormAction } from "@/modules/auth/server/actions";

const FIELDS = ["currentPassword", "newPassword"] as const;

/**
 * "Đổi mật khẩu" card of the doctor's Settings (spec password-change, mockup of change
 * add-password-change). Posts to a Server Action; React clears both password fields after
 * every submission, which is what we want for passwords. This device stays signed in.
 */
export function ChangePasswordForm({ username }: { username: string }) {
  const [state, formAction, isPending] = useActionState(changePasswordFormAction, null);

  const error = state && !state.ok ? state.error : null;
  const currentError = error?.fieldErrors?.currentPassword?.[0];
  const newError = error?.fieldErrors?.newPassword?.[0];
  // An error no visible field shows (rate limit, server error) must still be shown.
  const formError = error && !currentError && !newError ? error : null;

  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!error) return;
    const firstInvalid = FIELDS.find((field) => error.fieldErrors?.[field]?.[0]) ?? FIELDS[0];
    formRef.current?.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)?.focus();
  }, [error]);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      aria-labelledby="change-password-heading"
      className="grid gap-4 rounded-2xl border bg-card p-4"
    >
      <div className="grid gap-0.5">
        <h2
          id="change-password-heading"
          className="text-[0.95rem] font-semibold text-muted-foreground"
        >
          Đổi mật khẩu
        </h2>
        <p className="text-sm text-muted-foreground">
          Các thiết bị khác sẽ bị đăng xuất; thiết bị này vẫn giữ đăng nhập.
        </p>
      </div>

      {/* Lets password managers save the new password for the right account. */}
      <input type="text" name="username" value={username} autoComplete="username" readOnly hidden />

      {state?.ok ? (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-[0.95rem] font-medium"
        >
          <CircleCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          {PASSWORD_CHANGE_MESSAGES.changed}
        </p>
      ) : null}
      {formError ? <FormAlert error={formError} /> : null}

      <Field data-invalid={currentError ? true : undefined}>
        <FieldLabel htmlFor="current-password" className={FORM_LABEL_CLASS}>
          Mật khẩu hiện tại
        </FieldLabel>
        <PasswordInput
          id="current-password"
          name="currentPassword"
          autoComplete="current-password"
          enterKeyHint="next"
          aria-invalid={currentError ? true : undefined}
          aria-describedby={currentError ? "current-password-error" : undefined}
        />
        {currentError ? <FieldError id="current-password-error">{currentError}</FieldError> : null}
      </Field>

      <Field data-invalid={newError ? true : undefined}>
        <FieldLabel htmlFor="new-password" className={FORM_LABEL_CLASS}>
          Mật khẩu mới
        </FieldLabel>
        <PasswordInput
          id="new-password"
          name="newPassword"
          autoComplete="new-password"
          enterKeyHint="done"
          aria-invalid={newError ? true : undefined}
          aria-describedby={newError ? "new-password-error" : "new-password-hint"}
        />
        {newError ? (
          <FieldError id="new-password-error">{newError}</FieldError>
        ) : (
          <FieldDescription id="new-password-hint">Tối thiểu 8 ký tự.</FieldDescription>
        )}
      </Field>

      <Button type="submit" disabled={isPending} className="h-12 w-full text-base font-semibold">
        {isPending ? (
          <>
            <Spinner className="size-5" label={null} />
            Đang đổi mật khẩu…
          </>
        ) : (
          "Đổi mật khẩu"
        )}
      </Button>
    </form>
  );
}
