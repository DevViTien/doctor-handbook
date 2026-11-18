"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { FormAlert } from "@/components/common/form-alert";
import {
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  PasswordInput,
} from "@/components/common/password-input";
import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginFormAction } from "@/modules/auth/server/actions";

/**
 * Login form (spec account-session, mockup of change add-account-login).
 *
 * Posts to a Server Action through `<form action>`: works before hydration and never puts the
 * password in the URL.
 *
 * After every action React calls `form.reset()`, which puts each field back to its *default*
 * value — and a controlled input is not re-rendered when its state did not change (Safari then
 * shows an empty field). So both fields are uncontrolled: on submit the username becomes the
 * input's `defaultValue`, so the reset restores it, while the password resets to empty.
 */
export function LoginForm({ next }: { next?: string | undefined }) {
  const [state, formAction, isPending] = useActionState(loginFormAction, null);
  const [submittedUsername, setSubmittedUsername] = useState("");

  const error = state && !state.ok ? state.error : null;
  const fieldErrors = error?.code === "VALIDATION_FAILED" ? error.fieldErrors : undefined;
  const usernameError = fieldErrors?.username?.[0];
  const passwordError = fieldErrors?.password?.[0];
  // A validation error that no visible field shows must still be shown, never fail silently.
  const formError =
    error && (error.code !== "VALIDATION_FAILED" || (!usernameError && !passwordError))
      ? error
      : null;

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // After a failed attempt, put the cursor where the fix is: the invalid field, otherwise the
  // (now cleared) password so the doctor can retype it straight away.
  useEffect(() => {
    if (!error) return;
    if (usernameError) usernameRef.current?.focus();
    else passwordRef.current?.focus();
  }, [error, usernameError]);

  return (
    <form
      action={formAction}
      onSubmit={(event) =>
        setSubmittedUsername(String(new FormData(event.currentTarget).get("username") ?? ""))
      }
      noValidate
      className="grid gap-4.5"
    >
      {formError ? <FormAlert error={formError} /> : null}

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field data-invalid={usernameError ? true : undefined}>
        <FieldLabel htmlFor="username" className={FORM_LABEL_CLASS}>
          Tên đăng nhập
        </FieldLabel>
        <Input
          ref={usernameRef}
          id="username"
          name="username"
          type="text"
          defaultValue={submittedUsername}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          // Justified: a sign-in screen with a single primary field (iOS ignores it anyway).
          autoFocus
          aria-invalid={usernameError ? true : undefined}
          aria-describedby={usernameError ? "username-error" : undefined}
          className={FORM_INPUT_CLASS}
        />
        {usernameError ? <FieldError id="username-error">{usernameError}</FieldError> : null}
      </Field>

      <Field data-invalid={passwordError ? true : undefined}>
        <FieldLabel htmlFor="password" className={FORM_LABEL_CLASS}>
          Mật khẩu
        </FieldLabel>
        <PasswordInput
          ref={passwordRef}
          id="password"
          name="password"
          autoComplete="current-password"
          enterKeyHint="go"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? "password-error" : undefined}
        />
        {passwordError ? <FieldError id="password-error">{passwordError}</FieldError> : null}
      </Field>

      <Button type="submit" disabled={isPending} className="h-12 w-full text-base font-semibold">
        {isPending ? (
          <>
            <Spinner className="size-5" label={null} />
            Đang đăng nhập…
          </>
        ) : (
          "Đăng nhập"
        )}
      </Button>
    </form>
  );
}
