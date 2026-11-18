"use client";

import {
  CircleCheckIcon,
  DownloadIcon,
  InfoIcon,
  ShareIcon,
  SmartphoneIcon,
  SquarePlusIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { promptInstall, useInstallState } from "@/lib/pwa/install-prompt";

const KEY =
  "mx-0.5 inline-grid size-7 place-items-center rounded-lg border bg-muted align-middle text-primary";

/**
 * "Cài ứng dụng lên màn hình chính" in Settings (spec app-install, design §4): what the doctor can
 * do on THIS device. Chrome/Edge: a button opening the browser's install dialog. iPhone browsers
 * have no such dialog: two steps with the Share button. Already installed, or another browser:
 * one line. Rendered only once the device is known (no flash of the wrong state).
 */
export function InstallAppRow() {
  const state = useInstallState();
  const [busy, setBusy] = useState(false);
  if (state === null) return null;

  return (
    <section
      aria-labelledby="install-heading"
      className="mt-4 grid gap-3 rounded-2xl border bg-card py-3.5 pr-3.5 pl-4"
    >
      <h2 id="install-heading" className="flex items-center gap-3 font-semibold">
        <SmartphoneIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        Cài ứng dụng lên màn hình chính
      </h2>

      {state === "prompt" ? (
        <>
          <p className="text-[0.92rem] text-muted-foreground">
            Mở app bằng một chạm từ màn hình chính, toàn màn hình như mọi ứng dụng.
          </p>
          <Button
            type="button"
            className="h-12 w-full text-base font-semibold"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await promptInstall();
              } finally {
                setBusy(false);
              }
            }}
          >
            <DownloadIcon className="size-5" aria-hidden />
            Cài ứng dụng
          </Button>
        </>
      ) : null}

      {state === "ios" ? (
        <ol className="grid gap-2.5" aria-label="Cách cài trên iPhone">
          <li className="flex items-center gap-2.5">
            <span className="grid size-6.5 shrink-0 place-items-center rounded-full border text-[0.8rem] font-bold">
              1
            </span>
            <span>
              Bấm nút Chia sẻ
              <span className={KEY} aria-hidden>
                <ShareIcon className="size-4" />
              </span>
              của trình duyệt
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="grid size-6.5 shrink-0 place-items-center rounded-full border text-[0.8rem] font-bold">
              2
            </span>
            <span>
              Chọn
              <span className={KEY} aria-hidden>
                <SquarePlusIcon className="size-4" />
              </span>
              <b>Thêm vào MH chính</b>
            </span>
          </li>
        </ol>
      ) : null}

      {state === "installed" ? (
        <p className="flex items-center gap-2 font-semibold" role="status">
          <CircleCheckIcon className="size-5 text-primary" aria-hidden />
          Bạn đang dùng ứng dụng đã cài
        </p>
      ) : null}

      {state === "justInstalled" ? (
        <p className="flex items-center gap-2 font-semibold" role="status">
          <CircleCheckIcon className="size-5 text-primary" aria-hidden />
          Đã cài trên máy này. Mở app từ màn hình chính.
        </p>
      ) : null}

      {state === "dismissed" ? (
        <p className="flex items-start gap-2 text-[0.92rem] text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          Chưa cài. Tải lại trang để cài lại.
        </p>
      ) : null}

      {state === "unsupported" ? (
        <p className="flex items-start gap-2 text-[0.92rem] text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          Trình duyệt này chưa cho cài trực tiếp. Trên điện thoại, mở trang này bằng Chrome
          (Android) hoặc Safari (iPhone) để cài.
        </p>
      ) : null}
    </section>
  );
}
