"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { sendAllNoteDrafts } from "@/modules/patients/note-sync";

/**
 * Renders nothing. Sends the notes left on this device by the signed-in account when any doctor
 * page opens (client-side navigations included: the layout itself does not remount), when the
 * network comes back, and when the app returns to the foreground — so a note
 * written offline reaches the server even if the doctor never reopens that patient (spec
 * patient-notes "Rời trang khi chưa gửi được", design §4). Mounted once in the doctor layout.
 */
export function NoteDraftSync({ accountId }: { accountId: string }) {
  const pathname = usePathname();

  // Every page the doctor opens.
  useEffect(() => {
    void sendAllNoteDrafts(accountId);
  }, [accountId, pathname]);

  useEffect(() => {
    const sync = () => void sendAllNoteDrafts(accountId);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [accountId]);

  return null;
}
