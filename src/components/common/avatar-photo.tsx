"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A private picture laid over the initials (spec patient-avatars). Loaded only when it scrolls
 * into view (`loading="lazy"`); until it arrives, or when it fails, the initials underneath show.
 * Decorative: the name is always next to it.
 */
export function AvatarPhoto({ src, className }: { src: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a private, signed, redirected URL
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={cn("absolute inset-0 size-full rounded-full object-cover", className)}
    />
  );
}
