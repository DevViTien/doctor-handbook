"use client";

import { KeyRoundIcon } from "lucide-react";
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
import {
  ACCESS_CODE_INPUT_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  USAGE_NOTICE,
} from "@/modules/auth/constants";
import {
  activateAccountFormAction,
  checkActivationCodeFormAction,
  type CheckedActivationCode,
} from "@/modules/auth/server/actions";

type Step2Values = { displayName: string; username: string; acceptTerms: boolean };

/**
 * Account activation in two steps on one page (spec account-activation, design §2):
 * 1. check the code; 2. create the account. The code travels to step 2 in a hidden field (POST
 * body only, never the URL) and the server checks it again there.
 *
 * Fields are uncontrolled with a `defaultValue` captured on submit, like the login form: React
 * resets the form after every action, and this keeps what was typed (except the password).
 */
export function ActivationForm() {
  const [checkState, checkAction, isChecking] = useActionState(checkActivationCodeFormAction, null);
  const [activateState, activateAction, isActivating] = useActionState(
    activateAccountFormAction,
    null,
  );

  const [verified, setVerified] = useState<CheckedActivationCode | null>(
    checkState?.ok ? checkState.data : null,
  );
  /** An unusable code reported by step 2 (expired, revoked or used meanwhile): back to step 1. */
  const [lostCodeError, setLostCodeError] = useState<ActionError | null>(null);
  const [step2Error, setStep2Error] = useState<ActionError | null>(null);

  const [submittedCode, setSubmittedCode] = useState("");
  const [submitted, setSubmitted] = useState<Step2Values | null>(null);

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
  const [seenActivate, setSeenActivate] = useState(activateState);
  if (activateState !== seenActivate) {
    setSeenActivate(activateState);
    if (activateState && !activateState.ok) {
      if (activateState.error.code === "NOT_FOUND") {
        setVerified(null);
        setLostCodeError(activateState.error);
        // The next code may be for someone else: prefill from it, not from this attempt.
        setSubmitted(null);
      } else {
        setStep2Error(activateState.error);
      }
    }
  }

  function changeCode() {
    setVerified(null);
    setStep2Error(null);
    setSubmitted(null);
  }

  return (
    <div className="grid gap-5.5">
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-balance">Kích hoạt tài khoản</h1>
        <p className="text-[0.95rem] text-muted-foreground">
          {verified
            ? "Bước 2/2. Tạo tài khoản của bạn."
            : "Bước 1/2. Nhập mã quản trị viên gửi cho bạn."}
        </p>
      </div>

      {verified ? (
        <AccountStep
          key={verified.code}
          verified={verified}
          action={activateAction}
          isPending={isActivating}
          error={step2Error}
          submitted={submitted}
          onSubmitValues={setSubmitted}
          onChangeCode={changeCode}
        />
      ) : (
        <CodeStep
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

function CodeStep({
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
        <FieldLabel htmlFor="code" className={FORM_LABEL_CLASS}>
          Mã kích hoạt
        </FieldLabel>
        <Input
          ref={codeRef}
          id="code"
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
          aria-describedby={codeError ? "code-error" : undefined}
          className={cn(
            FORM_INPUT_CLASS,
            "h-14 text-xl font-bold tracking-[0.14em] uppercase tabular-nums placeholder:font-semibold md:text-xl",
          )}
        />
        {codeError ? <FieldError id="code-error">{codeError}</FieldError> : null}
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

const STEP2_FIELDS = ["displayName", "username", "password", "acceptTerms"] as const;

function AccountStep({
  verified,
  action,
  isPending,
  error,
  submitted,
  onSubmitValues,
  onChangeCode,
}: {
  verified: CheckedActivationCode;
  action: (formData: FormData) => void;
  isPending: boolean;
  error: ActionError | null;
  submitted: Step2Values | null;
  onSubmitValues: (values: Step2Values) => void;
  onChangeCode: () => void;
}) {
  const fieldErrors = error?.fieldErrors;
  const errorFor = (field: (typeof STEP2_FIELDS)[number]) => fieldErrors?.[field]?.[0];
  const hasFieldError = STEP2_FIELDS.some((field) => errorFor(field));
  // An error no visible field shows (rate limit, server error) must still be shown.
  const formError = error && !hasFieldError ? error : null;

  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!error) return;
    const firstInvalid = STEP2_FIELDS.find((field) => error.fieldErrors?.[field]?.[0]);
    const target = firstInvalid ?? "password";
    formRef.current?.querySelector<HTMLInputElement>(`[name="${target}"]`)?.focus();
  }, [error]);

  const displayNameError = errorFor("displayName");
  const usernameError = errorFor("username");
  const passwordError = errorFor("password");
  const termsError = errorFor("acceptTerms");

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        onSubmitValues({
          displayName: String(data.get("displayName") ?? ""),
          username: String(data.get("username") ?? ""),
          acceptTerms: data.get("acceptTerms") === "on",
        });
      }}
      noValidate
      className="grid gap-4.5"
    >
      <input type="hidden" name="code" value={verified.code} />

      <div className="flex items-center gap-3 rounded-xl bg-muted px-3.5 py-3">
        <KeyRoundIcon className="size-5 shrink-0 text-primary" aria-hidden />
        <div className="grid min-w-0 flex-1 text-[0.95rem]">
          <strong className="wrap-break-word">Mã cho {verified.recipientName}</strong>
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

      <Field data-invalid={displayNameError ? true : undefined}>
        <FieldLabel htmlFor="displayName" className={FORM_LABEL_CLASS}>
          Họ tên
        </FieldLabel>
        <Input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={submitted?.displayName ?? verified.recipientName}
          maxLength={DISPLAY_NAME_MAX_LENGTH + 20}
          autoComplete="name"
          enterKeyHint="next"
          aria-invalid={displayNameError ? true : undefined}
          aria-describedby={displayNameError ? "displayName-error" : undefined}
          className={FORM_INPUT_CLASS}
        />
        {displayNameError ? (
          <FieldError id="displayName-error">{displayNameError}</FieldError>
        ) : null}
      </Field>

      <Field data-invalid={usernameError ? true : undefined}>
        <FieldLabel htmlFor="new-username" className={FORM_LABEL_CLASS}>
          Tên đăng nhập
        </FieldLabel>
        <Input
          id="new-username"
          name="username"
          type="text"
          defaultValue={submitted?.username ?? ""}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          aria-invalid={usernameError ? true : undefined}
          aria-describedby={usernameError ? "username-error" : "username-hint"}
          className={FORM_INPUT_CLASS}
        />
        {usernameError ? (
          <FieldError id="username-error">{usernameError}</FieldError>
        ) : (
          <FieldDescription id="username-hint">
            3–32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới. Ví dụ: bs.tran
          </FieldDescription>
        )}
      </Field>

      <Field data-invalid={passwordError ? true : undefined}>
        <FieldLabel htmlFor="new-password" className={FORM_LABEL_CLASS}>
          Mật khẩu
        </FieldLabel>
        <PasswordInput
          id="new-password"
          name="password"
          autoComplete="new-password"
          enterKeyHint="done"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? "password-error" : "password-hint"}
        />
        {passwordError ? (
          <FieldError id="password-error">{passwordError}</FieldError>
        ) : (
          <FieldDescription id="password-hint">Tối thiểu 8 ký tự.</FieldDescription>
        )}
      </Field>

      <section aria-labelledby="usage-notice-title" className="rounded-xl bg-muted px-4 py-3.5">
        <h2 id="usage-notice-title" className="mb-1.5 text-[0.95rem] font-bold">
          Trước khi bắt đầu
        </h2>
        <ul className="grid list-disc gap-1 pl-4.5 text-[0.94rem]">
          {USAGE_NOTICE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <Field data-invalid={termsError ? true : undefined}>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
          <input
            type="checkbox"
            name="acceptTerms"
            defaultChecked={submitted?.acceptTerms ?? false}
            aria-invalid={termsError ? true : undefined}
            aria-describedby={termsError ? "acceptTerms-error" : undefined}
            className={cn(
              "size-5.5 shrink-0 accent-primary",
              termsError && "outline-2 outline-offset-2 outline-destructive",
            )}
          />
          Tôi đã đọc và đồng ý
        </label>
        {termsError ? <FieldError id="acceptTerms-error">{termsError}</FieldError> : null}
      </Field>

      <Button type="submit" disabled={isPending} className="h-12 w-full text-base font-semibold">
        {isPending ? (
          <>
            <Spinner className="size-5" label={null} />
            Đang tạo tài khoản…
          </>
        ) : (
          "Tạo tài khoản"
        )}
      </Button>
    </form>
  );
}
