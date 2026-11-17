"use client";

import { LogOutIcon } from "lucide-react";
import { useActionState } from "react";

import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/modules/auth/server/actions";

type LogoutButtonProps = {
  /** "outline": full-width button in Settings. "ghost": compact button in the admin top bar. */
  variant?: "outline" | "ghost";
  className?: string;
};

/** One-button form posting to `logoutAction`: works without JavaScript, never asks to confirm. */
export function LogoutButton({ variant = "outline", className }: LogoutButtonProps) {
  const [, formAction, isPending] = useActionState(logoutAction, null);

  return (
    <form action={formAction} className={cn(variant === "outline" && "w-full")}>
      <Button
        type="submit"
        variant={variant}
        disabled={isPending}
        className={cn(
          variant === "outline"
            ? "h-12 w-full border-input bg-card text-base font-semibold"
            : "h-10 px-2.5",
          className,
        )}
      >
        {isPending ? (
          <Spinner className="size-5" label={null} />
        ) : (
          <LogOutIcon className="size-5" aria-hidden />
        )}
        Đăng xuất
      </Button>
    </form>
  );
}
