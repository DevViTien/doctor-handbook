"use client";

import { KeyRoundIcon, LogOutIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { FormAlert } from "@/components/common/form-alert";
import {
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  PasswordInput,
} from "@/components/common/password-input";
import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/date/format";
import type { ActionError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { ACCESS_CODE_INPUT_MAX_LENGTH } from "@/modules/auth/constants";
import {
  type CheckedPasswordResetCode,
  checkPasswordResetCodeFormAction,
  resetPasswordFormAction,
} from "@/modules/auth/server/actions";

/**
 * Password reset in two steps on one page (spec password-reset, design §2), like activation:
 * 1. check the code; 2. set the new password. The code travels to step 2 in a hidden field
 * (POST body only) and the server checks it again there.
 */
export function PasswordResetForm() {
  const [checkState, checkAction, isChecking] = useActionState(
    checkPasswordResetCodeFormAction,
    null,
  );
  const [resetState, resetAction, isResetting] = useActionState(resetPasswordFormAction, null);

  const [verified, setVerified] = useState<CheckedPasswordResetCode | null>(
    checkState?.ok ? checkState.data : null,
  );
  /** An unusable code reported by step 2 (expired, revoked or used meanwhile): back to step 1. */
  const [lostCodeError, setLostCodeError] = useState<ActionError | null>(null);
  const [step2Error, setStep2Error] = useState<ActionError | null>(null);
  const [submittedCode, setSubmittedCode] = useState("");

  // React to each new action result during render (no effect, no extra paint).
  const [seenCheck, setSeenCheck] = useState(checkState);
  if (checkState !== seenCheck) {
    setSeenCheck(checkState);
    setLostCodeError(null);
    if (checkState?.ok) {
      setVerified(checkState.data);
      setStep2Error(null);
    }
  }
  const [seenReset, setSeenReset] = useState(resetState);
  if (resetState !== seenReset) {
    setSeenReset(resetState);
    if (resetState && !resetState.ok) {
      if (resetState.error.code === "NOT_FOUND") {
        setVerified(null);
        setLostCodeError(resetState.error);
      } else {
        setStep2Error(resetState.error);
      }
    }
  }

  return (
    <div className="grid gap-5.5">
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Đặt lại mật khẩu</h1>
        <p className="text-[0.95rem] text-muted-foreground">
          {verified
            ? "Bước 2/2. Đặt mật khẩu mới."
            : "Bước 1/2. Nhập mã quản trị viên gửi cho bạn."}
        </p>
      </div>

      {verified ? (
        <NewPasswordStep
          key={verified.code}
          verified={verified}
          action={resetAction}
          isPending={isResetting}
          error={step2Error}
          onChangeCode={() => {
            setVerified(null);
            setStep2Error(null);
          }}
        />
      ) : (
        <ResetCodeStep
          action={checkAction}
          isPending={isChecking}
          error={lostCodeError ?? (checkState && !checkState.ok ? checkState.error : null)}
          defaultCode={submittedCode}
          onSubmitCode={(code) => {
            setSubmittedCode(code);
            setLostCodeError(null);
          }}
        />
      )}
    </div>
  );
}

function ResetCodeStep({
  action,
  isPending,
  error,
  defaultCode,
  onSubmitCode,
}: {
  action: (formData: FormData) => void;
  isPending: boolean;
  error: ActionError | null;
  defaultCode: string;
  onSubmitCode: (code: string) => void;
}) {
  const codeError = error?.code === "VALIDATION_FAILED" ? error.fieldErrors?.code?.[0] : undefined;
  const formError = error && !codeError ? error : null;

  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (error) codeRef.current?.focus();
  }, [error]);

  return (
    <form
      action={action}
      onSubmit={(event) =>
        onSubmitCode(String(new FormData(event.currentTarget).get("code") ?? ""))
      }
      noValidate
      className="grid gap-4.5"
    >
      {formError ? <FormAlert error={formError} /> : null}

      <Field data-invalid={codeError ? true : undefined}>
        <FieldLabel htmlFor="reset-code" className={FORM_LABEL_CLASS}>
          Mã đặt lại mật khẩu
        </FieldLabel>
        <Input
          ref={codeRef}
          id="reset-code"
          name="code"
          type="text"
          defaultValue={defaultCode}
          placeholder="XXXX-XXXX"
          maxLength={ACCESS_CODE_INPUT_MAX_LENGTH}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          // Justified: the page has a single field to fill first (iOS ignores it anyway).
          autoFocus
          aria-invalid={codeError ? true : undefined}
          aria-describedby={codeError ? "reset-code-error" : undefined}
          className={cn(
            FORM_INPUT_CLASS,
            "h-14 text-xl font-bold tracking-[0.14em] uppercase tabular-nums placeholder:font-semibold md:text-xl",
          )}
        />
        {codeError ? <FieldError id="reset-code-error">{codeError}</FieldError> : null}
      </Field>

      <Button type="submit" disabled={isPending} className="h-12 w-full text-base font-semibold">
        {isPending ? (
          <>
            <Spinner className="size-5" label={null} />
            Đang kiểm tra mã…
          </>
        ) : (
          "Tiếp tục"
        )}
      </Button>
    </form>
  );
}

function NewPasswordStep({
  verified,
  action,
  isPending,
  error,
  onChangeCode,
}: {
  verified: CheckedPasswordResetCode;
  action: (formData: FormData) => void;
  isPending: boolean;
  error: ActionError | null;
  onChangeCode: () => void;
}) {
  const passwordError =
    error?.code === "VALIDATION_FAILED" ? error.fieldErrors?.password?.[0] : undefined;
  const formError = error && !passwordError ? error : null;

  const passwordRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (error) passwordRef.current?.focus();
  }, [error]);

  return (
    <form action={action} noValidate className="grid gap-4.5">
      <input type="hidden" name="code" value={verified.code} />
      {/* Lets password managers save the new password for the right account. */}
      <input
        type="text"
        name="username"
        value={verified.username}
        autoComplete="username"
        readOnly
        hidden
      />

      <div className="flex items-center gap-3 rounded-xl bg-muted px-3.5 py-3">
        <KeyRoundIcon className="size-5 shrink-0 text-primary" aria-hidden />
        <div className="grid min-w-0 flex-1 text-[0.95rem]">
          <strong className="wrap-break-word">
            Đặt lại mật khẩu cho <span translate="no">{verified.username}</span>
          </strong>
          <span className="text-sm text-muted-foreground">
            Hết hạn {formatDateTime(verified.expiresAt)}
          </span>
        </div>
        <Button
          type="button"
          variant="link"
          onClick={onChangeCode}
          className="h-11 shrink-0 px-1.5 text-[0.9rem] font-semibold underline underline-offset-3"
        >
          Đổi mã
        </Button>
      </div>

      {formError ? <FormAlert error={formError} /> : null}

      <Field data-invalid={passwordError ? true : undefined}>
        <FieldLabel htmlFor="reset-password" className={FORM_LABEL_CLASS}>
          Mật khẩu mới
        </FieldLabel>
        <PasswordInput
          ref={passwordRef}
          id="reset-password"
          name="password"
          autoComplete="new-password"
          enterKeyHint="done"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? "reset-password-error" : "reset-password-hint"}
        />
        {passwordError ? (
          <FieldError id="reset-password-error">{passwordError}</FieldError>
        ) : (
          <FieldDescription id="reset-password-hint">Tối thiểu 8 ký tự.</FieldDescription>
        )}
      </Field>

      <p className="flex items-start gap-2 text-[0.9rem] text-muted-foreground">
        <LogOutIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        Mọi thiết bị đang đăng nhập tài khoản này sẽ bị đăng xuất.
      </p>

      <Button type="submit" disabled={isPending} className="h-12 w-full text-base font-semibold">
        {isPending ? (
          <>
            <Spinner className="size-5" label={null} />
            Đang đặt mật khẩu…
          </>
        ) : (
          "Đặt mật khẩu mới"
        )}
      </Button>
    </form>
  );
}
