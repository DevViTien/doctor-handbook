"use client";

import { WifiOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { FormAlert } from "@/components/common/form-alert";
import { FORM_INPUT_CLASS, FORM_LABEL_CLASS } from "@/components/common/password-input";
import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { routes } from "@/config/routes";
import { useOnlineStatus } from "@/hooks/use-online-status";
import type { ActionResult } from "@/lib/result";
import { parseBirthInput, todayInVietnam } from "@/modules/patients/birth";
import { BirthField } from "@/modules/patients/components/birth-field";
import { DuplicateHint } from "@/modules/patients/components/duplicate-hint";
import { GenderField } from "@/modules/patients/components/gender-field";
import { PATIENT_LIMITS, PATIENT_MESSAGES } from "@/modules/patients/constants";
import { findPossibleDuplicates } from "@/modules/patients/duplicates";
import { PATIENT_FIELD_NAMES as F } from "@/modules/patients/schemas";
import {
  createPatientFormAction,
  type SavedPatient,
  updatePatientFormAction,
} from "@/modules/patients/server/actions";
import type { PatientFormValues, PatientListItem } from "@/modules/patients/types";
import { NEW_PATIENT_NAME_KEY, SEARCH_LIMITS } from "@/modules/search/constants";

type PatientFormProps =
  | { mode: "create"; initialValues: PatientFormValues; candidates: PatientListItem[] }
  | { mode: "edit"; initialValues: PatientFormValues; patientId: string; version: string };

/** What the form remembers between saves: the server's answer and what was typed. */
type PatientFormState = { result: ActionResult<SavedPatient>; values: PatientFormValues } | null;

/** Form fields in screen order: the first one with an error gets the focus. */
const FIELD_ORDER = [F.fullName, F.birth, F.gender, F.hometown, F.phone, F.patientCode, F.summary];

/** Form field name → key of `PatientFormValues`. */
const VALUE_KEYS = {
  [F.fullName]: "fullName",
  [F.birth]: "birth",
  [F.gender]: "gender",
  [F.hometown]: "hometown",
  [F.phone]: "phone",
  [F.patientCode]: "patientCode",
  [F.summary]: "summary",
} as const satisfies Record<(typeof FIELD_ORDER)[number], keyof PatientFormValues>;

const FIELD_IDS = {
  [F.fullName]: "patient-full-name",
  [F.birth]: "patient-birth",
  [F.gender]: "patient-gender",
  [F.hometown]: "patient-hometown",
  [F.phone]: "patient-phone",
  [F.patientCode]: "patient-code",
  [F.summary]: "patient-summary",
} as const;

function readValues(formData: FormData): PatientFormValues {
  const read = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    fullName: read(F.fullName),
    birth: read(F.birth),
    gender: read(F.gender),
    hometown: read(F.hometown),
    phone: read(F.phone),
    patientCode: read(F.patientCode),
    summary: read(F.summary),
  };
}

/**
 * A save that never got an answer. The actions catch every server-side error themselves, so a
 * rejected call means the request or its response was lost: the network, even when the browser
 * still claims to be online (Wi-Fi without internet). Keep everything, say why.
 */
const NETWORK_FAILURE: ActionResult<SavedPatient> = {
  ok: false,
  error: { code: "INTERNAL", message: PATIENT_MESSAGES.offline },
};

/**
 * Add and edit form of a patient (spec patient-records, design §5, mockup of change
 * add-patient-records). One "Lưu" button (or Enter), no confirmation dialog (N2).
 *
 * Nothing typed is ever lost on a failed save: the action is wrapped so a network failure becomes
 * a normal error, and every field is uncontrolled with `defaultValue` = the values in the form
 * when the answer came back (including what was typed while saving), so React's automatic
 * `form.reset()` after the action puts them back. React renders a client
 * function `action` as `javascript:throw…` before hydration, so a too-early submit sends nothing
 * (no GET with patient data in the URL).
 */
export function PatientForm(props: PatientFormProps) {
  const router = useRouter();
  const online = useOnlineStatus();
  const today = useMemo(() => todayInVietnam(), []);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (_previous: PatientFormState, formData: FormData): Promise<PatientFormState> => {
      let result: ActionResult<SavedPatient>;
      try {
        result =
          props.mode === "create"
            ? await createPatientFormAction(null, formData)
            : await updatePatientFormAction(null, formData);
      } catch {
        result = NETWORK_FAILURE;
      }

      // Back must never return to the form that was just saved.
      if (result.ok) router.replace(routes.doctor.patient(result.data.id));

      // Fields stay editable while saving: keep what is in the form NOW, not the submitted copy.
      const values = readValues(formRef.current ? new FormData(formRef.current) : formData);
      return { result, values };
    },
    null,
  );

  const values = state?.values ?? props.initialValues;
  const error = state && !state.result.ok ? state.result.error : null;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];
  const formError = error && !FIELD_ORDER.some((name) => fieldError(name)) ? error : null;

  // Live copies of two fields, only for the birth reading and the duplicate hint.
  const [fullNameText, setFullNameText] = useState(values.fullName);
  const [birthText, setBirthText] = useState(values.birth);
  const parsedBirth = parseBirthInput(birthText, today);
  const duplicates =
    props.mode === "create"
      ? findPossibleDuplicates(props.candidates, {
          fullName: fullNameText,
          birthYear: parsedBirth.kind === "ok" ? parsedBirth.birthYear : null,
        })
      : [];

  // Adding: the cursor waits in "Họ tên" (spec "Form bệnh nhân dùng tốt trên điện thoại"),
  // prefilled with the name searched for on the list, carried in this tab's sessionStorage
  // (spec patient-search "Không thấy bệnh nhân nào"), read once and removed.
  useEffect(() => {
    if (props.mode !== "create") return;
    const input = formRef.current?.querySelector<HTMLInputElement>(`[name="${F.fullName}"]`);
    input?.focus();
    const prefill = setTimeout(() => {
      let name: string | null = null;
      try {
        const stored = JSON.parse(sessionStorage.getItem(NEW_PATIENT_NAME_KEY) ?? "null") as {
          name?: unknown;
          at?: unknown;
        } | null;
        sessionStorage.removeItem(NEW_PATIENT_NAME_KEY);
        // Only a fresh value: a stale one belongs to an add that never opened.
        if (
          typeof stored?.name === "string" &&
          typeof stored.at === "number" &&
          Date.now() - stored.at < SEARCH_LIMITS.prefillMaxAgeMs
        ) {
          name = stored.name.slice(0, PATIENT_LIMITS.fullName);
        }
      } catch {
        // Storage blocked or garbage: nothing to prefill.
      }
      if (name && input && !input.value) {
        input.value = name;
        setFullNameText(name);
      }
    }, 0);
    return () => clearTimeout(prefill);
  }, [props.mode]);

  // After a failed save: focus the first field in error, or the form-level message.
  useEffect(() => {
    if (!error) return;
    const firstInvalid = FIELD_ORDER.find((name) => error.fieldErrors?.[name]?.[0]);
    const target = firstInvalid
      ? formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
      : formRef.current?.querySelector<HTMLElement>("[data-form-error]");
    target?.focus();
  }, [error]);

  const textField = (
    name: (typeof FIELD_ORDER)[number],
    label: string,
    options: {
      hint?: string;
      type?: "tel";
      spellCheck?: false;
      onChange?: (value: string) => void;
    } = {},
  ) => {
    const id = FIELD_IDS[name];
    const message = fieldError(name);
    const describedBy = message ? `${id}-error` : options.hint ? `${id}-hint` : undefined;
    return (
      <Field data-invalid={message ? true : undefined}>
        <FieldLabel htmlFor={id} className={FORM_LABEL_CLASS}>
          {label}
          {name === F.fullName ? (
            <span className="text-[0.82rem] font-medium text-muted-foreground">bắt buộc</span>
          ) : null}
        </FieldLabel>
        <Input
          id={id}
          name={name}
          type={options.type ?? "text"}
          defaultValue={values[VALUE_KEYS[name]]}
          onChange={
            options.onChange ? (event) => options.onChange?.(event.target.value) : undefined
          }
          autoComplete="off"
          spellCheck={options.spellCheck}
          enterKeyHint="done"
          aria-invalid={message ? true : undefined}
          aria-describedby={describedBy}
          className={FORM_INPUT_CLASS}
        />
        {message ? (
          <FieldError id={`${id}-error`}>{message}</FieldError>
        ) : options.hint ? (
          <FieldDescription id={`${id}-hint`}>{options.hint}</FieldDescription>
        ) : null}
      </Field>
    );
  };

  const summaryError = fieldError(F.summary);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      // Keeps a focused field clear of the sticky "Lưu" bar and the bottom navigation.
      className="grid gap-4.5 pt-1 [&_:is(input,textarea)]:scroll-mb-36"
    >
      {props.mode === "edit" ? (
        <>
          <input type="hidden" name="patientId" value={props.patientId} />
          <input type="hidden" name="version" value={props.version} />
        </>
      ) : null}

      {online ? null : (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-lg bg-warning-bg px-3.5 py-3 text-[0.95rem] font-medium text-warning"
        >
          <WifiOffIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
          {PATIENT_MESSAGES.offlineNotice}
        </p>
      )}
      {formError ? (
        <div data-form-error tabIndex={-1} className="grid gap-1 outline-none">
          <FormAlert error={formError} />
          {formError.code === "CONFLICT" ? (
            <Button
              type="button"
              variant="link"
              className="h-11 justify-self-start px-0 font-semibold"
              onClick={() => window.location.reload()}
            >
              Tải lại trang
            </Button>
          ) : null}
        </div>
      ) : null}

      {textField(F.fullName, "Họ tên", { onChange: setFullNameText })}

      <BirthField
        id={FIELD_IDS[F.birth]}
        name={F.birth}
        defaultValue={values.birth}
        parsed={parsedBirth}
        today={today}
        // A server error about an older text must not hide how the new text reads.
        error={birthText === values.birth ? fieldError(F.birth) : undefined}
        onTextChange={setBirthText}
      />

      <DuplicateHint matches={duplicates} today={today} />

      <GenderField
        name={F.gender}
        defaultValue={values.gender}
        error={fieldError(F.gender)}
        errorId={`${FIELD_IDS[F.gender]}-error`}
      />

      {textField(F.hometown, "Quê quán")}
      {textField(F.phone, "Số điện thoại", { type: "tel", spellCheck: false })}
      {textField(F.patientCode, "Mã bệnh nhân", {
        hint: "Mã ở phần mềm phòng khám, để tra lại hồ sơ chính thức.",
        spellCheck: false,
      })}

      <Field data-invalid={summaryError ? true : undefined}>
        <FieldLabel htmlFor={FIELD_IDS[F.summary]} className={FORM_LABEL_CLASS}>
          Tóm tắt
        </FieldLabel>
        <Textarea
          id={FIELD_IDS[F.summary]}
          name={F.summary}
          defaultValue={values.summary}
          autoComplete="off"
          rows={6}
          aria-invalid={summaryError ? true : undefined}
          aria-describedby={summaryError ? "patient-summary-error" : "patient-summary-hint"}
          className="min-h-38 bg-card px-3.5 py-3 text-base leading-normal md:text-base dark:bg-card"
        />
        {summaryError ? (
          <FieldError id="patient-summary-error">{summaryError}</FieldError>
        ) : (
          <FieldDescription id="patient-summary-hint">
            Tiền sử, dị ứng, điều cần nhớ. Chỉ hiện khi mở chi tiết.
          </FieldDescription>
        )}
      </Field>

      {/* Stays above the fixed bottom navigation while the form scrolls (thumb zone). */}
      <div className="sticky bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 -mx-4 border-t bg-card px-4 py-2.5">
        <Button type="submit" disabled={isPending} className="h-12 w-full text-base font-semibold">
          {isPending ? (
            <>
              <Spinner className="size-5" label={null} />
              Đang lưu…
            </>
          ) : (
            "Lưu"
          )}
        </Button>
      </div>
    </form>
  );
}
