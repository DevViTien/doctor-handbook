"use client";

import { CornerDownRightIcon } from "lucide-react";

import { FORM_INPUT_CLASS, FORM_LABEL_CLASS } from "@/components/common/password-input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type BirthParse, type CalendarDay, describeBirthReading } from "@/modules/patients/birth";

type BirthFieldProps = {
  id: string;
  name: string;
  defaultValue: string;
  /** How the current text reads, computed by the form from what is being typed. */
  parsed: BirthParse;
  today: CalendarDay;
  /** Error returned by the server on the last save. */
  error?: string;
  onTextChange: (text: string) => void;
};

/**
 * "Năm sinh hoặc tuổi" with the line that shows how the app understood it ("45t" → "Năm sinh
 * 1981 · 45 tuổi"), the one accent of the form (mockup of change add-patient-records). While the
 * text cannot be read, the hint stays; the error only appears after a save, to not nag mid-typing.
 */
export function BirthField({
  id,
  name,
  defaultValue,
  parsed,
  today,
  error,
  onTextChange,
}: BirthFieldProps) {
  const reading = parsed.kind === "ok" ? describeBirthReading(parsed, today) : null;
  const describedBy = error ? `${id}-error` : reading ? `${id}-reading` : `${id}-hint`;

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id} className={FORM_LABEL_CLASS}>
        Năm sinh hoặc tuổi
      </FieldLabel>
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue}
        onChange={(event) => onTextChange(event.target.value)}
        autoComplete="off"
        enterKeyHint="done"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={FORM_INPUT_CLASS}
      />
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : reading ? (
        <p
          id={`${id}-reading`}
          aria-live="polite"
          className="flex items-center gap-2 rounded-r-lg border-l-3 border-primary bg-muted px-2.5 py-1.5 text-[0.92rem] font-semibold tabular-nums"
        >
          <CornerDownRightIcon className="size-4 shrink-0 text-primary" aria-hidden />
          {reading}
        </p>
      ) : (
        <FieldDescription id={`${id}-hint`}>Ví dụ: 1979, 45t hoặc 12/03/1979</FieldDescription>
      )}
    </Field>
  );
}
