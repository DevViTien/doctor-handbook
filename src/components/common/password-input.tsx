"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Shared look of the large form inputs (48 px tall, 16 px text so iOS does not zoom). */
export const FORM_INPUT_CLASS = "h-12 bg-card px-3.5 text-base md:text-base dark:bg-card";
export const FORM_LABEL_CLASS = "text-[0.95rem] font-semibold";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type">;

/**
 * Password field with a 44 px show/hide toggle. Hidden by default; the toggle announces its
 * action ("Hiện mật khẩu" / "Ẩn mật khẩu") and its state (`aria-pressed`).
 */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn(FORM_INPUT_CLASS, "pr-13", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((shown) => !shown)}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        aria-pressed={visible}
        className="absolute top-0.5 right-0.5 grid size-11 place-items-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {visible ? (
          <EyeOffIcon className="size-5" aria-hidden />
        ) : (
          <EyeIcon className="size-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
