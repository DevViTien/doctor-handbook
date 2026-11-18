"use client";

import { CheckIcon, CopyIcon, InfoIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { FormAlert } from "@/components/common/form-alert";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { formatDateTime } from "@/lib/date/format";
import { cn } from "@/lib/utils";
import type { IssuedAccessCode } from "@/modules/admin/server/actions";

const subscribeToNothing = () => () => {};

/** The chat message the admin pastes into Zalo. The link never contains the code. */
function buildMessage(issued: IssuedAccessCode, origin: string, expiresAt: string): string {
  if (issued.kind === "password_reset") {
    return (
      `Mã đặt lại mật khẩu ${siteConfig.name} cho ${issued.username ?? issued.recipientName}: ` +
      `${issued.code}\n` +
      `Mở ${origin}${routes.auth.resetPassword} để đặt mật khẩu mới. ` +
      `Mã dùng một lần, hết hạn lúc ${expiresAt}.`
    );
  }
  return (
    `Mã kích hoạt ${siteConfig.name}: ${issued.code}\n` +
    `Mở ${origin}${routes.auth.activate} để tạo tài khoản. ` +
    `Mã dùng một lần, hết hạn lúc ${expiresAt}.`
  );
}

/**
 * The freshly issued code (activation or password reset) with its "Sao chép tin nhắn" button:
 * the one emphasized element of the admin screens. The code exists only here: only its hash is
 * stored, so it is shown once.
 */
export function IssuedCodeDetails({ issued }: { issued: IssuedAccessCode }) {
  // The app's own origin, so the link always matches where the admin is (no config needed).
  const origin = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => "",
  );
  const expiresAt = formatDateTime(issued.expiresAt);
  const message = buildMessage(issued, origin, expiresAt);
  const isReset = issued.kind === "password_reset";

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
    <div className="grid gap-3.5">
      <p
        translate="no"
        data-testid="issued-code"
        className="rounded-xl border-2 border-dashed border-primary px-3 py-3.5 text-center text-[1.75rem] leading-tight font-bold tracking-[0.16em] tabular-nums select-all"
      >
        {issued.code}
      </p>
      <p className="-mt-1 text-center text-sm text-muted-foreground">
        {isReset && issued.username ? (
          <>
            Cho{" "}
            <strong translate="no" className="text-foreground">
              {issued.username}
            </strong>{" "}
            ·{" "}
          </>
        ) : null}
        Hết hạn {expiresAt}
      </p>

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
        {isReset
          ? "Mã chỉ hiện một lần. Mã đặt lại cũ của tài khoản này (nếu có) đã bị huỷ."
          : "Mã chỉ hiện một lần. Tải lại trang là không xem lại được."}
      </p>
      <p role="status" className="sr-only">
        {copied ? "Đã sao chép tin nhắn" : ""}
      </p>
      {copyState === "failed" ? (
        <FormAlert
          error={{ code: "INTERNAL", message: "Không sao chép được. Hãy chọn và sao chép mã." }}
        />
      ) : null}
    </div>
  );
}
