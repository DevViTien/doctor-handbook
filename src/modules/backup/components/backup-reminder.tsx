"use client";

import { ClockIcon, DownloadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { DOCTOR_TOASTER_ID } from "@/config/site";
import { BackupError, downloadBackup } from "@/modules/backup/backup-client";
import { BACKUP_MESSAGES, BACKUP_REMINDER_SNOOZE_MS } from "@/modules/backup/constants";

/**
 * "Để mai" lives in this device's localStorage (design §5): a per-device convenience, so an
 * unreadable or missing value only means the reminder shows. Checked with Zod.
 */
const SNOOZE_EVENT = "doctor-handbook:backup-reminder";
const snoozeKey = (accountId: string) => `doctor-handbook:backup-reminder:${accountId}`;
const snoozedAtSchema = z.coerce.number().int().positive();

function readSnoozedAt(accountId: string): number | null {
  try {
    const parsed = snoozedAtSchema.safeParse(window.localStorage.getItem(snoozeKey(accountId)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(SNOOZE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SNOOZE_EVENT, onChange);
  };
}

/**
 * The backup reminder on the home screen (spec data-backup). The page decides whether it is due;
 * this hides it while snoozed on this device. Rendered only once localStorage has been read, so a
 * snoozed reminder never flashes. Says nothing about any patient.
 */
export function BackupReminder({ accountId, title }: { accountId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // `null` on the server and during hydration: unknown yet, render nothing.
  const snoozed = useSyncExternalStore(
    subscribe,
    () => {
      const at = readSnoozedAt(accountId);
      return at !== null && Date.now() - at < BACKUP_REMINDER_SNOOZE_MS;
    },
    () => null,
  );

  // A hidden marker says what the reminder decided, so tests (and nothing else) can tell
  // "snoozed" from "not hydrated yet".
  if (snoozed !== false || done) {
    return <span hidden data-backup-reminder={snoozed === null ? "pending" : "hidden"} />;
  }

  const snooze = () => {
    try {
      window.localStorage.setItem(snoozeKey(accountId), String(Date.now()));
    } catch {
      // Storage blocked: hiding for this visit is the best we can do.
      setDone(true);
    }
    window.dispatchEvent(new Event(SNOOZE_EVENT));
  };

  const backUp = async () => {
    setBusy(true);
    try {
      const { fileName } = await downloadBackup();
      setDone(true);
      toast.success(`${BACKUP_MESSAGES.downloaded(fileName)} ${BACKUP_MESSAGES.keepSafeShort}`, {
        toasterId: DOCTOR_TOASTER_ID,
      });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof BackupError ? error.message : BACKUP_MESSAGES.exportOffline, {
        toasterId: DOCTOR_TOASTER_ID,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Nhắc sao lưu"
      data-backup-reminder="shown"
      className="mb-3 grid gap-2.5 rounded-2xl border border-warning/35 bg-warning-bg py-3 pr-3 pl-3.5"
    >
      <div className="flex items-start gap-2.5">
        <ClockIcon className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div>
          <p className="font-bold">{title}</p>
          <p className="text-sm">Dữ liệu trên server có thể bị mất. Hãy giữ một file trên máy.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-7.5">
        <Button
          type="button"
          className="h-11 px-3.5 font-semibold"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void backUp()}
        >
          {busy ? (
            <Spinner className="size-4" label={null} />
          ) : (
            <DownloadIcon className="size-4" aria-hidden />
          )}
          {busy ? "Đang tạo file…" : "Sao lưu ngay"}
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-11 px-2 font-semibold text-foreground underline underline-offset-3"
          disabled={busy}
          onClick={snooze}
        >
          Để mai<span className="sr-only">: ẩn nhắc sao lưu trong 1 ngày</span>
        </Button>
      </div>
    </section>
  );
}
