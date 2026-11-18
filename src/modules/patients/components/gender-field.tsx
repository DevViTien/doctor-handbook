"use client";

import { CheckIcon } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, type PointerEvent, useRef } from "react";

import { GENDERS } from "@/lib/enums";
import { GENDER_LABELS } from "@/modules/patients/constants";

type GenderFieldProps = {
  name: string;
  defaultValue: string;
  errorId?: string;
  error?: string;
};

const CLEAR_KEYS = new Set([" ", "Delete", "Backspace"]);

/**
 * Nam / Nữ / Khác as three 44 px native radios (keyboard and screen readers for free). Gender is
 * optional, so the selected one can be cleared: tap it again, or press Space / Delete on it.
 * Uncontrolled: React's form reset brings back `defaultValue`, which is how a failed save keeps
 * the choice (design §5).
 */
export function GenderField({ name, defaultValue, error, errorId }: GenderFieldProps) {
  // Value that was already checked when the pointer went down. The radio itself is visually
  // hidden, so the pointer lands on its label; the click the label forwards checks the radio
  // before any handler runs, hence remembering the state on pointerdown.
  const checkedOnPress = useRef<string | null>(null);

  const rememberChecked = (event: PointerEvent<HTMLLabelElement>) => {
    const radio = event.currentTarget.control;
    checkedOnPress.current =
      radio instanceof HTMLInputElement && radio.checked ? radio.value : null;
  };
  const clearIfPressedAgain = (event: MouseEvent<HTMLInputElement>) => {
    if (checkedOnPress.current === event.currentTarget.value) event.currentTarget.checked = false;
    checkedOnPress.current = null;
  };
  const clearWithKeyboard = (event: KeyboardEvent<HTMLInputElement>) => {
    if (CLEAR_KEYS.has(event.key) && event.currentTarget.checked) {
      event.preventDefault();
      event.currentTarget.checked = false;
    }
  };

  return (
    <fieldset className="grid gap-1.5" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1.5 text-[0.95rem] font-semibold">Giới tính</legend>
      <div className="grid grid-cols-3 gap-2">
        {GENDERS.map((gender) => (
          <label
            key={gender}
            onPointerDown={rememberChecked}
            className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-input bg-card font-medium transition-colors has-checked:border-primary has-checked:bg-primary has-checked:font-semibold has-checked:text-primary-foreground has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring motion-reduce:transition-none [&:not(:has(:checked))>svg]:hidden"
          >
            <input
              type="radio"
              name={name}
              value={gender}
              defaultChecked={defaultValue === gender}
              onClick={clearIfPressedAgain}
              onKeyDown={clearWithKeyboard}
              className="sr-only"
            />
            <CheckIcon className="size-4" aria-hidden />
            {GENDER_LABELS[gender]}
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
