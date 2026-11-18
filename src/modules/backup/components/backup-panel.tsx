"use client";

import { CircleCheckIcon, DownloadIcon, ShieldIcon, WifiOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormAlert } from "@/components/common/form-alert";
import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { BackupError, downloadBackup } from "@/modules/backup/backup-client";
import { BACKUP_MESSAGES } from "@/modules/backup/constants";

type PanelState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; fileName: string }
  | { kind: "error"; message: string; offline: boolean };

/** "Bảo vệ file" line shown under every download button (D18, §8.4). */
export function KeepFileSafe() {
  return (
    <p className="flex items-start gap-2.5 rounded-lg bg-muted px-3 py-2.5 text-sm">
      <ShieldIcon className="mt-0.5 size-4.5 shrink-0 text-muted-foreground" aria-hidden />
      <span>{BACKUP_MESSAGES.keepSafe}</span>
    </p>
  );
}

/**
 * The "Sao lưu" card (spec data-backup): last backup, what the account holds, the download
 * button and the keep-safe notice. Texts come from the server page; a refresh after a download
 * shows the new date.
 */
export function BackupPanel({
  lastBackup,
  neverBackedUp,
  holdings,
}: {
  /** "Lần sao lưu gần nhất: 3 ngày trước (16/11/2026)" or "Chưa sao lưu lần nào". */
  lastBackup: string;
  neverBackedUp: boolean;
  /** "Đang có 132 bệnh nhân (3 trong thùng rác), 845 ghi chú, 0 việc". */
  holdings: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<PanelState>({ kind: "idle" });

  const download = async () => {
    setState({ kind: "busy" });
    try {
      const { fileName } = await downloadBackup();
      setState({ kind: "done", fileName });
      router.refresh();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof BackupError ? error.message : BACKUP_MESSAGES.exportOffline,
        offline: error instanceof BackupError ? error.offline : true,
      });
    }
  };

  return (
    <section aria-labelledby="backup-heading" className="grid gap-4 rounded-2xl border bg-card p-4">
      <h2 id="backup-heading" className="text-[1.02rem] font-bold">
        Sao lưu
      </h2>
      <div className="grid gap-1">
        <p className={neverBackedUp ? "font-semibold text-warning" : "font-semibold"}>
          {lastBackup}
        </p>
        <p className="text-[0.92rem] text-muted-foreground tabular-nums">{holdings}</p>
      </div>

      {state.kind === "done" ? (
        <div role="status" className="flex items-start gap-2.5 rounded-lg border px-3.5 py-3">
          <CircleCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="grid min-w-0 gap-0.5">
            <b className="font-bold [overflow-wrap:anywhere]">
              {BACKUP_MESSAGES.downloaded(state.fileName)}
            </b>
            <span className="text-sm text-muted-foreground">{BACKUP_MESSAGES.keepSafeShort}</span>
          </div>
        </div>
      ) : null}
      {state.kind === "error" ? (
        state.offline ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-3.5 py-3 text-[0.95rem] font-medium text-destructive"
          >
            <WifiOffIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span>{state.message}</span>
          </div>
        ) : (
          <FormAlert error={{ code: "INTERNAL", message: state.message }} />
        )
      ) : null}

      <Button
        type="button"
        className="h-12 w-full text-base font-semibold"
        disabled={state.kind === "busy"}
        aria-busy={state.kind === "busy"}
        onClick={() => void download()}
      >
        {state.kind === "busy" ? (
          <>
            <Spinner className="size-5" label={null} />
            Đang tạo file…
          </>
        ) : (
          <>
            <DownloadIcon className="size-5" aria-hidden />
            Tải file sao lưu
          </>
        )}
      </Button>
      <KeepFileSafe />
    </section>
  );
}
