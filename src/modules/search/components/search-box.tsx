"use client";

import { MicIcon, SearchIcon, XIcon } from "lucide-react";
import { useRef } from "react";

import { cn } from "@/lib/utils";
import { SEARCH_LIMITS, SEARCH_MESSAGES } from "@/modules/search/constants";

type SearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
  /** Voice search; `null` when the browser cannot do it (no mic button at all). */
  voice: { listening: boolean; onToggle: () => void } | null;
};

const ICON_BUTTON =
  "relative grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-3 focus-visible:outline-ring";

/**
 * The search field of the list page (mockup of change add-patient-search): the one accent of the
 * page, 52 px tall, primary focus ring, a clear button and the mic, which turns solid primary
 * with a slow ring while listening (no ring with reduced motion).
 */
export function SearchBox({ value, onChange, voice }: SearchBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex h-13 items-center gap-1 rounded-xl border border-input bg-card pr-1 pl-3 focus-within:border-2 focus-within:border-primary focus-within:pl-[11px]">
      <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, SEARCH_LIMITS.maxLength))}
        aria-label="Tìm bệnh nhân"
        placeholder={SEARCH_MESSAGES.placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Xoá từ khoá"
          className={ICON_BUTTON}
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
        >
          <XIcon className="size-5" aria-hidden />
        </button>
      ) : null}
      {voice ? (
        <button
          type="button"
          aria-label={voice.listening ? "Dừng nghe" : "Tìm bằng giọng nói"}
          aria-pressed={voice.listening}
          onClick={voice.onToggle}
          className={cn(
            ICON_BUTTON,
            voice.listening &&
              "bg-primary text-primary-foreground after:absolute after:-inset-1 after:animate-ping after:rounded-xl after:border-2 after:border-primary after:opacity-40 after:[animation-duration:1.6s] hover:bg-primary hover:text-primary-foreground motion-reduce:after:animate-none",
          )}
        >
          <MicIcon className="size-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
