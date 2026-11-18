"use client";

import {
  ArchiveIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
  UploadIcon,
  UsersIcon,
  WifiOffIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { formatDate, formatDateTime } from "@/lib/date/format";
import { cn } from "@/lib/utils";
import { unpackBackup } from "@/modules/backup/archive";
import {
  BackupConflictError,
  BackupError,
  discardImportUploads,
  downloadBackup,
  sendImport,
  uploadImportImages,
} from "@/modules/backup/backup-client";
import { BACKUP_LIMITS, BACKUP_MESSAGES, PRE_IMPORT_SUFFIX } from "@/modules/backup/constants";
import { describeCounts } from "@/modules/backup/format";
import type { BackupCounts, BackupFile, BackupImage, ImportResult } from "@/modules/backup/types";

type Picked = { file: BackupFile; images: BackupImage[]; fileName: string; size: number };
type Step = "backup" | "images" | "import";
type Progress = { done: number; total: number };

type ImportState =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "rejected"; message: string; newer: boolean }
  | ({ kind: "ready" } & Picked)
  | ({ kind: "running"; step: Step; progress: Progress | null } & Picked)
  | ({ kind: "failed"; backedUp: boolean; message: string; offline: boolean } & Picked)
  | { kind: "done"; result: ImportResult; preImportFile: string | null };

const SOLID_DESTRUCTIVE =
  "bg-destructive text-primary-foreground hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90";
const WIDE = "h-12 w-full text-base font-semibold";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

const countsOf = (file: BackupFile): BackupCounts => file.manifest.counts;

/**
 * "Nhập dữ liệu" (spec data-import, design §4): pick a `.zip`, check it here, show its summary,
 * confirm only when data would be replaced, save a backup of the current data first, then
 * replace everything in one request (all or nothing on the server).
 */
export function ImportPanel({
  username,
  current,
}: {
  username: string;
  /** What the account holds now (patients include the trash). */
  current: BackupCounts;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({ kind: "idle" });
  const [confirming, setConfirming] = useState(false);
  // Name of the backup saved before this import (kept for "Thử lại", which does not save again).
  const [preImportFile, setPreImportFile] = useState<string | null>(null);
  const hasData = current.patients + current.notes + current.todos > 0;

  // Leaving while an import runs is safe (all or nothing), but the doctor would not see the
  // result: ask the browser to confirm first.
  const running = state.kind === "running";
  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  const pick = () => input.current?.click();

  const onFile = async (chosen: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!chosen) return;
    if (chosen.size > BACKUP_LIMITS.fileBytes) {
      setState({ kind: "rejected", message: BACKUP_MESSAGES.fileTooLarge, newer: false });
      return;
    }
    setState({ kind: "reading" });
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await chosen.arrayBuffer());
    } catch {
      setState({ kind: "rejected", message: BACKUP_MESSAGES.fileBroken, newer: false });
      return;
    }
    const result = unpackBackup(bytes);
    if (!result.ok) {
      const message =
        result.reason === "newer"
          ? BACKUP_MESSAGES.fileNewer
          : result.reason === "tooLarge"
            ? BACKUP_MESSAGES.fileTooLarge
            : BACKUP_MESSAGES.fileBroken;
      setState({ kind: "rejected", message, newer: result.reason === "newer" });
      return;
    }
    setPreImportFile(null);
    setState({
      kind: "ready",
      file: result.file,
      images: result.images,
      fileName: chosen.name,
      size: chosen.size,
    });
  };

  const run = async (from: Picked, backedUp: boolean) => {
    // Only the file itself: `from` may be a whole state object, whose `kind` must not leak in.
    const picked: Picked = {
      file: from.file,
      images: from.images,
      fileName: from.fileName,
      size: from.size,
    };
    let saved = backedUp;
    let preImport = backedUp ? preImportFile : null;
    if (!saved && hasData) {
      setState({ kind: "running", step: "backup", progress: null, ...picked });
      try {
        const { fileName } = await downloadBackup({ suffix: PRE_IMPORT_SUFFIX });
        preImport = fileName;
        setPreImportFile(fileName);
        saved = true;
      } catch (error) {
        // Offline, or refused (session over, data too large…): say which, never import.
        const refused = error instanceof BackupError && !error.offline;
        setState({
          kind: "failed",
          backedUp: false,
          message: refused
            ? BACKUP_MESSAGES.preImportBackupRefused(error.message)
            : BACKUP_MESSAGES.preImportBackupFailed,
          offline: !refused,
          ...picked,
        });
        return;
      }
    }

    // The file's pictures go to storage first; nothing changes if one cannot be uploaded.
    let uploaded: { paths: Record<string, string>; uploaded: string[] } = {
      paths: {},
      uploaded: [],
    };
    if (picked.images.length > 0) {
      setState({
        kind: "running",
        step: "images",
        progress: { done: 0, total: picked.images.length },
        ...picked,
      });
      try {
        uploaded = await uploadImportImages(picked.images, (done, total) =>
          setState({ kind: "running", step: "images", progress: { done, total }, ...picked }),
        );
      } catch (error) {
        setState({
          kind: "failed",
          backedUp: saved,
          message:
            error instanceof BackupError ? error.message : BACKUP_MESSAGES.imagesUploadFailed,
          offline: error instanceof BackupError ? error.offline : true,
          ...picked,
        });
        return;
      }
    }

    setState({ kind: "running", step: "import", progress: null, ...picked });
    try {
      const result = await sendImport(picked.file, saved, uploaded.paths);
      setState({ kind: "done", result, preImportFile: preImport });
      router.refresh();
    } catch (error) {
      // Only after a definite refusal: a lost answer or a timeout may still commit on the server,
      // and the pictures it points at must then exist. Orphans of a failed try stay unreachable.
      if (error instanceof BackupError && !error.offline) {
        void discardImportUploads(uploaded.uploaded);
      }
      if (error instanceof BackupConflictError) {
        // Data appeared since this page loaded (another device, a page restored by "Back"):
        // fresh counts make the next try ask first and save a backup.
        router.refresh();
        setState({ kind: "rejected", message: error.message, newer: false });
        return;
      }
      setState({
        kind: "failed",
        backedUp: saved,
        message: error instanceof BackupError ? error.message : BACKUP_MESSAGES.importOffline,
        offline: error instanceof BackupError ? error.offline : true,
        ...picked,
      });
    }
  };

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept=".zip,application/zip"
      className="hidden"
      aria-label="Chọn file sao lưu"
      onChange={(event) => void onFile(event.target.files?.[0])}
    />
  );

  const pickButton = (label: string) => (
    <Button type="button" variant="outline" className={WIDE} onClick={pick}>
      <UploadIcon className="size-5" aria-hidden />
      {label}
    </Button>
  );

  let body: React.ReactNode;
  switch (state.kind) {
    case "idle":
    case "reading":
      body = (
        <>
          <p className="text-[0.95rem] text-muted-foreground">
            Thay toàn bộ dữ liệu trong sổ bằng dữ liệu của một file sao lưu.
          </p>
          {state.kind === "reading" ? (
            <Button type="button" variant="outline" className={WIDE} disabled aria-busy>
              <Spinner className="size-5" label={null} />
              Đang đọc file…
            </Button>
          ) : (
            pickButton("Chọn file sao lưu")
          )}
        </>
      );
      break;
    case "rejected":
      body = (
        <>
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-3.5 py-3 text-[0.95rem] font-medium text-destructive"
          >
            {state.newer ? (
              <RefreshCwIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
            ) : (
              <CircleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
            )}
            <span>{state.message}</span>
          </div>
          {pickButton("Chọn file khác")}
        </>
      );
      break;
    case "ready":
    case "running":
    case "failed": {
      const otherAccount = state.file.manifest.account.username !== username;
      body = (
        <>
          <FileSummary picked={state} />
          {state.kind === "ready" ? (
            <>
              {otherAccount ? (
                <p className="flex items-start gap-2.5 rounded-lg bg-warning-bg px-3.5 py-3 text-[0.95rem] font-medium text-warning">
                  <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <span>File này của tài khoản {state.file.manifest.account.username}.</span>
                </p>
              ) : null}
              {hasData ? (
                <p className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-3.5 py-3 text-[0.95rem] font-medium text-destructive">
                  <CircleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <span>
                    Toàn bộ dữ liệu hiện tại ({describeCounts(current)}) sẽ bị thay thế. App sẽ tải
                    về một file sao lưu dữ liệu hiện tại trước.
                  </span>
                </p>
              ) : null}
              <div className="grid gap-2">
                <Button
                  type="button"
                  className={cn(WIDE, hasData && SOLID_DESTRUCTIVE)}
                  onClick={() => (hasData ? setConfirming(true) : void run(state, false))}
                >
                  {hasData ? null : <UploadIcon className="size-5" aria-hidden />}
                  Nhập dữ liệu
                </Button>
                {pickButton("Chọn file khác")}
              </div>
            </>
          ) : (
            <>
              <ImportSteps
                withBackup={hasData}
                withImages={state.images.length > 0}
                current={state.kind === "running" ? state.step : null}
                progress={state.kind === "running" ? state.progress : null}
                backupDone={state.kind === "running" ? state.step !== "backup" : state.backedUp}
              />
              {state.kind === "running" ? (
                <p className="text-sm text-muted-foreground">
                  Đừng đóng trang. Lỗi giữa chừng thì dữ liệu hiện tại còn nguyên.
                </p>
              ) : (
                <>
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-3.5 py-3 text-[0.95rem] font-medium text-destructive"
                  >
                    {state.offline ? (
                      <WifiOffIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
                    ) : (
                      <CircleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
                    )}
                    <span>{state.message}</span>
                  </div>
                  <div className="grid gap-2">
                    <Button
                      type="button"
                      className={cn(WIDE, hasData && SOLID_DESTRUCTIVE)}
                      onClick={() => void run(state, state.backedUp)}
                    >
                      <RefreshCwIcon className="size-5" aria-hidden />
                      Thử lại
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={WIDE}
                      onClick={() => setState({ kind: "idle" })}
                    >
                      Huỷ
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </>
      );
      break;
    }
    case "done":
      body = (
        <>
          <div role="status" className="flex items-start gap-2.5 rounded-lg border px-3.5 py-3">
            <CircleCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="grid min-w-0 gap-0.5">
              <b className="font-bold">Đã nhập {describeCounts(state.result)}.</b>
              {state.preImportFile ? (
                <span className="text-sm [overflow-wrap:anywhere] text-muted-foreground">
                  File sao lưu dữ liệu cũ: {state.preImportFile}
                </span>
              ) : null}
            </div>
          </div>
          <Button asChild className={WIDE}>
            <Link href={routes.doctor.patients}>
              <UsersIcon className="size-5" aria-hidden />
              Xem danh sách bệnh nhân
            </Link>
          </Button>
          {pickButton("Chọn file sao lưu khác")}
        </>
      );
      break;
  }

  return (
    <section aria-labelledby="import-heading" className="grid gap-4 rounded-2xl border bg-card p-4">
      <h2 id="import-heading" className="text-[1.02rem] font-bold">
        Nhập dữ liệu
      </h2>
      {body}
      {fileInput}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Thay thế toàn bộ dữ liệu?"
        description={`${describeCounts(current)} đang có sẽ bị thay bằng dữ liệu trong file. App sẽ tải về một file sao lưu dữ liệu hiện tại trước khi thay.`}
        confirmLabel="Thay thế dữ liệu"
        cancelLabel="Không nhập"
        destructive
        onConfirm={() => {
          setConfirming(false);
          if (state.kind === "ready") void run(state, false);
        }}
      />
    </section>
  );
}

/** The file being imported: its date large, its counts in tabular figures (the one accent). */
function FileSummary({ picked }: { picked: Picked }) {
  const { manifest } = picked.file;
  const counts = countsOf(picked.file);
  const time = formatDateTime(manifest.exportedAt).split(" ")[1];
  return (
    <div
      role="group"
      aria-label={`File sao lưu ngày ${formatDate(manifest.exportedAt)}: ${describeCounts(counts)}`}
      className="grid gap-3 rounded-xl border border-l-4 border-l-primary bg-muted px-3.5 pt-3.5 pb-3"
    >
      <p className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground">
        <ArchiveIcon className="size-5 text-primary" aria-hidden />
        File sao lưu ngày
      </p>
      <p className="-mt-1.5 text-[1.6rem] leading-tight font-bold tracking-tight tabular-nums">
        {formatDate(manifest.exportedAt)}{" "}
        <small className="text-[0.95rem] font-medium tracking-normal text-muted-foreground">
          lúc {time}
        </small>
      </p>
      <dl className="grid grid-cols-4 gap-1.5">
        {(
          [
            ["bệnh nhân", counts.patients],
            ["ghi chú", counts.notes],
            ["việc", counts.todos],
            ["ảnh", picked.images.length],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="grid rounded-lg border bg-card px-2.5 py-2">
            <dt className="order-2 text-[0.8125rem] text-muted-foreground">{label}</dt>
            <dd className="order-1 text-lg font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[0.8125rem] [overflow-wrap:anywhere] text-muted-foreground">
        {picked.fileName}, {formatSize(picked.size)}
      </p>
    </div>
  );
}

function ImportSteps({
  withBackup,
  withImages,
  current,
  progress,
  backupDone,
}: {
  withBackup: boolean;
  withImages: boolean;
  current: Step | null;
  progress: Progress | null;
  backupDone: boolean;
}) {
  const order: Step[] = ["backup", "images", "import"];
  const steps = order.filter(
    (step) => (step !== "backup" || withBackup) && (step !== "images" || withImages),
  );
  const stateOf = (step: Step): "done" | "doing" | "todo" => {
    if (step === "backup" && backupDone) return "done";
    if (current === null) return "todo";
    if (step === current) return "doing";
    return order.indexOf(step) < order.indexOf(current) ? "done" : "todo";
  };
  const label = (step: Step, doing: boolean) => {
    if (step === "backup")
      return doing ? "Đang sao lưu dữ liệu hiện tại…" : "Sao lưu dữ liệu hiện tại";
    if (step === "images") {
      return doing && progress
        ? BACKUP_MESSAGES.uploadingImages(progress.done, progress.total)
        : "Tải ảnh lên";
    }
    return doing ? "Đang nhập dữ liệu từ file…" : "Nhập dữ liệu từ file";
  };
  return (
    <ol className="grid gap-2.5" aria-live="polite">
      {steps.map((step, index) => {
        const state = stateOf(step);
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-2.5 font-medium tabular-nums",
              state === "todo" && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border bg-card text-sm font-bold",
                state === "done" && "border-primary bg-primary text-primary-foreground",
                state === "doing" && "border-primary text-primary",
              )}
              aria-hidden
            >
              {state === "done" ? (
                <CheckIcon className="size-4" />
              ) : state === "doing" ? (
                <Spinner className="size-4" label={null} />
              ) : (
                index + 1
              )}
            </span>
            {label(step, state === "doing")}
          </li>
        );
      })}
    </ol>
  );
}
