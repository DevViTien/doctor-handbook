"use client";

import {
  CameraIcon,
  CircleAlertIcon,
  EyeIcon,
  ImageIcon,
  Trash2Icon,
  WifiOffIcon,
} from "lucide-react";
import { type ReactNode, useRef, useState, useSyncExternalStore } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { InitialsAvatar } from "@/components/common/initials-avatar";
import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActionError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { AvatarSaveError, saveAvatar } from "@/modules/patients/avatar-client";
import { type AvatarImage, AvatarImageError, toAvatarImage } from "@/modules/patients/avatar-image";
import { AVATAR_MESSAGES } from "@/modules/patients/constants";
import { removeAvatarAction } from "@/modules/patients/server/actions";

const PHONE_QUERY = "(max-width: 639px)";
function subscribeToPhone(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string; offline: boolean; retry: AvatarImage | null };

/**
 * The avatar on the patient page (spec patient-avatars, design §9): the 72 px picture (or
 * initials) with a camera badge opens "Chụp ảnh", "Chọn ảnh có sẵn", and with a picture "Xem
 * ảnh", "Xoá ảnh": a bottom sheet on phones, a menu from 640 px. The picture is shrunk on the
 * device, shown at once while saving, and a failed save keeps the old one with "Thử lại".
 */
export function PatientAvatar({
  patientId,
  name,
  avatarUrl,
  children,
}: {
  patientId: string;
  name: string;
  avatarUrl: string | null;
  /** Name and meta lines, shown next to the picture with the save status under them. */
  children: ReactNode;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState(avatarUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<Pick<ActionError, "code" | "message"> | null>(
    null,
  );
  const isPhone = useSyncExternalStore(
    subscribeToPhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
  const saving = status.kind === "saving";

  const save = async (image: AvatarImage) => {
    const url = URL.createObjectURL(image.blob);
    setPreview(url);
    setStatus({ kind: "saving" });
    try {
      setSrc(await saveAvatar(patientId, image));
      setStatus({ kind: "idle" });
    } catch (error) {
      const offline = error instanceof AvatarSaveError ? error.offline : true;
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : AVATAR_MESSAGES.offline,
        offline,
        // A refusal (patient gone, moved to the trash) would only fail again.
        retry: offline ? image : null,
      });
    } finally {
      setPreview(null);
      URL.revokeObjectURL(url);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (camera.current) camera.current.value = "";
    if (gallery.current) gallery.current.value = "";
    if (!file) return;
    try {
      await save(await toAvatarImage(file));
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof AvatarImageError ? error.message : AVATAR_MESSAGES.unreadable,
        offline: false,
        retry: null,
      });
    }
  };

  const remove = async () => {
    setRemoving(true);
    setRemoveError(null);
    try {
      const result = await removeAvatarAction({ patientId });
      if (!result.ok) {
        setRemoveError(result.error);
        return;
      }
      setSrc(null);
      setStatus({ kind: "idle" });
      setConfirmingRemove(false);
    } catch {
      setRemoveError({ code: "INTERNAL", message: AVATAR_MESSAGES.removeOffline });
    } finally {
      setRemoving(false);
    }
  };

  type OptionKey = "camera" | "gallery" | "view" | "remove";
  const options: { key: OptionKey; label: string; icon: typeof CameraIcon; danger?: boolean }[] = [
    { key: "camera", label: "Chụp ảnh", icon: CameraIcon },
    { key: "gallery", label: "Chọn ảnh có sẵn", icon: ImageIcon },
    ...(src
      ? ([
          { key: "view", label: "Xem ảnh", icon: EyeIcon },
          { key: "remove", label: "Xoá ảnh", icon: Trash2Icon, danger: true },
        ] as const)
      : []),
  ];

  /** Runs a choice; only ever called from a click (file pickers need that user gesture). */
  function choose(key: OptionKey) {
    if (key === "camera") camera.current?.click();
    else if (key === "gallery") gallery.current?.click();
    else if (key === "view") setViewing(true);
    else {
      setRemoveError(null);
      setConfirmingRemove(true);
    }
  }

  const trigger = (
    <button
      type="button"
      aria-label="Ảnh đại diện"
      aria-haspopup={isPhone ? "dialog" : "menu"}
      disabled={saving}
      onClick={isPhone ? () => setSheetOpen(true) : undefined}
      className="relative size-18 shrink-0 rounded-full focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-progress"
    >
      <InitialsAvatar
        name={name}
        src={preview ?? src}
        className={cn("size-18 text-[1.35rem]", saving && "opacity-60")}
      />
      {saving ? (
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white">
          <Spinner className="size-6" label={null} />
        </span>
      ) : null}
      <span className="absolute -right-0.5 -bottom-0.5 grid size-7 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground">
        <CameraIcon className="size-3.5" aria-hidden />
      </span>
    </button>
  );

  return (
    <div className="flex min-w-0 items-center gap-3.5 pt-2 pb-4">
      {isPhone ? (
        trigger
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-60 p-1.5">
            {options.map((option) => (
              <DropdownMenuItem
                key={option.key}
                onSelect={() => choose(option.key)}
                className={cn(
                  "min-h-11 gap-2.5 px-3 text-base font-semibold",
                  option.danger && "text-destructive focus:text-destructive",
                )}
              >
                <option.icon
                  className={cn(
                    "size-5",
                    option.danger ? "text-destructive" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="grid min-w-0 gap-0.5">
        {children}
        {status.kind === "saving" ? (
          <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Spinner className="size-4" label={null} />
            {AVATAR_MESSAGES.saving}
          </p>
        ) : null}
        {status.kind === "error" ? (
          <p
            role="alert"
            className="flex flex-wrap items-center gap-x-1.5 text-sm font-semibold text-destructive"
          >
            {status.offline ? (
              <WifiOffIcon className="size-4 shrink-0" aria-hidden />
            ) : (
              <CircleAlertIcon className="size-4 shrink-0" aria-hidden />
            )}
            {status.message}
            {status.retry ? (
              <button
                type="button"
                onClick={() => {
                  if (status.kind === "error" && status.retry) void save(status.retry);
                }}
                className="min-h-8 px-1 font-bold underline underline-offset-3 focus-visible:outline-3 focus-visible:outline-ring"
              >
                {AVATAR_MESSAGES.retry}
              </button>
            ) : null}
          </p>
        ) : null}
      </div>

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Chụp ảnh đại diện"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Chọn ảnh đại diện có sẵn"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />

      {/* Phones: the choices as a bottom sheet, within thumb reach. */}
      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="gap-0.5 p-2.5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none"
        >
          <span className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-border" aria-hidden />
          <DialogTitle className="mx-2 mb-1.5 text-base font-bold">Ảnh đại diện</DialogTitle>
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setSheetOpen(false);
                choose(option.key);
              }}
              className={cn(
                "flex min-h-13 items-center gap-3 rounded-xl px-3 text-left text-base font-semibold hover:bg-muted focus-visible:outline-3 focus-visible:outline-ring",
                option.danger && "text-destructive",
              )}
            >
              <option.icon
                className={cn(
                  "size-5",
                  option.danger ? "text-destructive" : "text-muted-foreground",
                )}
                aria-hidden
              />
              {option.label}
            </button>
          ))}
        </DialogContent>
      </Dialog>

      <Dialog open={viewing} onOpenChange={setViewing}>
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="gap-3 p-3 sm:max-w-sm"
        >
          <DialogTitle className="sr-only">Ảnh đại diện</DialogTitle>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- a private, signed, redirected URL
            <img
              src={src}
              alt="Ảnh đại diện"
              className="aspect-square w-full rounded-xl object-cover"
            />
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            onClick={() => setViewing(false)}
          >
            Đóng
          </Button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmingRemove}
        onOpenChange={(open) => {
          if (!open && !removing) setConfirmingRemove(false);
        }}
        title="Xoá ảnh đại diện?"
        description="Ảnh sẽ bị xoá hẳn. Trang sẽ hiện lại chữ cái đầu."
        confirmLabel="Xoá ảnh"
        cancelLabel="Không xoá"
        destructive
        pending={removing}
        error={removeError}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
