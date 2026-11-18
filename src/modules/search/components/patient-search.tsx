"use client";

import {
  CircleAlertIcon,
  FileTextIcon,
  LoaderCircleIcon,
  MicIcon,
  MicOffIcon,
  NotebookIcon,
  PhoneIcon,
  PlusIcon,
  SearchXIcon,
  WifiOffIcon,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { PersonRow } from "@/components/common/person-row";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { SearchBox } from "@/modules/search/components/search-box";
import {
  MATCH_LABELS,
  NEW_PATIENT_NAME_KEY,
  SEARCH_LIMITS,
  SEARCH_MESSAGES,
} from "@/modules/search/constants";
import { fetchDeepSearch } from "@/modules/search/deep-search-client";
import { useSpeechSearch } from "@/modules/search/hooks/use-speech-search";
import { indexPatients, rankLocal, searchTokens } from "@/modules/search/match";
import type { DeepSearchResult, MatchKind, SearchablePatient } from "@/modules/search/types";

/** The answer of the deep search for one normalized query. */
type DeepState =
  | { key: string; result: DeepSearchResult }
  | { key: string; failed: "offline" }
  | { key: string; failed: "error"; message: string };

const MATCH_ICONS: Record<MatchKind, typeof PhoneIcon> = {
  phone: PhoneIcon,
  patientCode: FileTextIcon,
  summary: FileTextIcon,
  notes: NotebookIcon,
};

function MatchHint({ kind }: { kind: MatchKind }) {
  const Icon = MATCH_ICONS[kind];
  return (
    <span className="mt-0.5 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-primary">
      <Icon className="size-3.5" aria-hidden />
      {MATCH_LABELS[kind]}
    </span>
  );
}

function StatusLine({
  tone,
  icon: Icon,
  children,
}: {
  tone: "muted" | "listen" | "warn" | "error";
  icon: typeof PhoneIcon;
  children: string;
}) {
  return (
    <p
      role="status"
      className={cn(
        "mt-2 flex min-h-5 items-center gap-1.5 px-0.5 text-sm",
        tone === "muted" && "text-muted-foreground",
        tone === "listen" && "font-semibold text-primary",
        tone === "warn" && "text-warning",
        tone === "error" && "text-destructive",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          Icon === LoaderCircleIcon && "animate-spin motion-reduce:animate-none",
        )}
        aria-hidden
      />
      {children}
    </p>
  );
}

/**
 * The list page with search (spec patient-search, mockup of change add-patient-search):
 * - instant filtering by name and hometown, in the browser, on every keystroke;
 * - a debounced deep search on the server (phone, patient code, summary, notes) that returns
 *   ids and match kinds only, merged under the local results with a "Khớp …" hint;
 * - "Có phải bạn tìm…?" near names, "Không thấy bệnh nhân nào khớp" with a prefilled add;
 * - voice input that simply types into the box.
 * The query lives in this component only: never in the URL, the title or storage.
 */
export function PatientSearch({
  patients,
  notice,
}: {
  patients: SearchablePatient[];
  /** Shown between the title and the search box while not searching (the backup reminder). */
  notice?: ReactNode;
}) {
  const [query, setQueryState] = useState("");
  const [deep, setDeep] = useState<DeepState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const setQuery = (text: string) => setQueryState(text.slice(0, SEARCH_LIMITS.maxLength));
  const speech = useSpeechSearch(setQuery);

  const indexed = useMemo(() => indexPatients(patients), [patients]);
  const byId = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);

  const tokens = searchTokens(query);
  const key = tokens.join(" ");
  const searching = tokens.length > 0;
  const local = rankLocal(indexed, tokens);

  const debounced = useDebouncedValue(query, SEARCH_LIMITS.debounceMs);
  const debouncedKey = searchTokens(debounced).join(" ");
  const wantsDeep = debouncedKey.length >= SEARCH_LIMITS.deepMinLength;

  // A name left by an add that never opened must not prefill a later, unrelated add.
  useEffect(() => {
    try {
      sessionStorage.removeItem(NEW_PATIENT_NAME_KEY);
    } catch {
      // Storage blocked: nothing was stored either.
    }
  }, []);

  // Deep search for the settled query, through an abortable request: a newer query cancels the
  // older one, and a request still unanswered after 10 s counts as offline (then retried).
  useEffect(() => {
    if (!wantsDeep) return;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, SEARCH_LIMITS.timeoutMs);

    fetchDeepSearch(debounced.trim(), controller.signal).then(
      (response) => {
        setDeep(
          response.ok
            ? { key: debouncedKey, result: response.data }
            : {
                key: debouncedKey,
                failed: "error",
                message:
                  response.error.code === "UNAUTHENTICATED"
                    ? response.error.message
                    : SEARCH_MESSAGES.failed,
              },
        );
      },
      () => {
        // Aborted by a newer query (cleanup): nothing to report.
        if (timedOut || !controller.signal.aborted) {
          setDeep({ key: debouncedKey, failed: "offline" });
        }
      },
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [wantsDeep, debounced, debouncedKey, attempt]);

  const current = deep?.key === key ? deep : null;
  const offlineForCurrent = current !== null && "failed" in current && current.failed === "offline";

  // Offline: retry when the network comes back, and every 15 s (an `online` event may come
  // before the link really works, and then never again). Re-armed by every failed attempt.
  useEffect(() => {
    if (!offlineForCurrent) return;
    const again = () => setAttempt((count) => count + 1);
    window.addEventListener("online", again);
    const interval = setInterval(again, SEARCH_LIMITS.retryMs);
    return () => {
      window.removeEventListener("online", again);
      clearInterval(interval);
    };
  }, [offlineForCurrent, current]);

  const deepPending = key.length >= SEARCH_LIMITS.deepMinLength && current === null;
  // While the answer for this query is on its way, keep the previous one when the query only
  // grew or shrank, so rows found by phone or notes do not blink away on every keystroke.
  const previous =
    deepPending &&
    deep !== null &&
    "result" in deep &&
    (key.startsWith(deep.key) || deep.key.startsWith(key))
      ? deep.result
      : null;
  const deepResult = current && "result" in current ? current.result : previous;

  const localIds = new Set(local.map((p) => p.id));
  const deepKinds = new Map(deepResult?.matches.map((match) => [match.id, match.kinds]) ?? []);
  const deepOnly = patients.filter((p) => !localIds.has(p.id) && deepKinds.has(p.id));
  const results = [...local, ...deepOnly];
  const suggestions =
    results.length === 0 ? (deepResult?.suggestions ?? []).flatMap((id) => byId.get(id) ?? []) : [];
  const settled = key.length < SEARCH_LIMITS.deepMinLength || current !== null;
  const nothing = searching && results.length === 0 && suggestions.length === 0 && settled;

  // The microphone line while listening; afterwards the deep search line wins over a past
  // microphone error, which typing also clears.
  const status = speech.listening ? (
    <StatusLine tone="listen" icon={MicIcon}>
      {SEARCH_MESSAGES.listening}
    </StatusLine>
  ) : current && "failed" in current ? (
    current.failed === "offline" ? (
      <StatusLine tone="warn" icon={WifiOffIcon}>
        {SEARCH_MESSAGES.offline}
      </StatusLine>
    ) : (
      <StatusLine tone="error" icon={CircleAlertIcon}>
        {current.message}
      </StatusLine>
    )
  ) : deepPending ? (
    <StatusLine tone="muted" icon={LoaderCircleIcon}>
      {SEARCH_MESSAGES.searchingDeep}
    </StatusLine>
  ) : speech.error ? (
    <StatusLine tone="error" icon={MicOffIcon}>
      {speech.error}
    </StatusLine>
  ) : null;

  const row = (patient: SearchablePatient, kind?: MatchKind) => (
    <li key={patient.id}>
      <PersonRow
        href={patient.href}
        name={patient.fullName}
        meta={patient.meta}
        avatarSrc={patient.avatarSrc}
        hint={kind ? <MatchHint kind={kind} /> : undefined}
      />
    </li>
  );

  return (
    <>
      {/* Title and search stay on top while scrolling: change the query with one hand. */}
      <div className="sticky top-0 z-20 -mx-4 bg-background px-4 pb-2.5">
        <header className="flex items-baseline justify-between gap-3 pt-4 pb-3">
          <h1 className="text-xl font-semibold tracking-tight">Bệnh nhân</h1>
          <p className="text-sm whitespace-nowrap text-muted-foreground" aria-live="polite">
            {!searching
              ? `${patients.length} bệnh nhân`
              : results.length === 0 && deepPending
                ? SEARCH_MESSAGES.searching
                : `${results.length} kết quả`}
          </p>
        </header>
        {/* Hidden, not unmounted: a backup in progress keeps its state while searching. */}
        {notice ? <div hidden={searching}>{notice}</div> : null}
        <SearchBox
          value={query}
          onChange={(text) => {
            setQuery(text);
            speech.clearError();
          }}
          voice={
            speech.supported
              ? {
                  listening: speech.listening,
                  onToggle: speech.listening ? speech.stop : speech.start,
                }
              : null
          }
        />
        {status}
      </div>

      {results.length > 0 ? (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {local.map((patient) => row(patient))}
          {deepOnly.map((patient) => row(patient, deepKinds.get(patient.id)?.[0]))}
        </ul>
      ) : suggestions.length > 0 ? (
        <section aria-labelledby="search-suggestions">
          <h2 id="search-suggestions" className="mx-0.5 mt-3.5 mb-2 text-[0.95rem] font-bold">
            {SEARCH_MESSAGES.suggestionsTitle}
          </h2>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {suggestions.map((patient) => row(patient))}
          </ul>
        </section>
      ) : nothing ? (
        <EmptyState
          className="rounded-2xl border bg-card"
          icon={SearchXIcon}
          title={SEARCH_MESSAGES.noneTitle}
          description={
            offlineForCurrent
              ? "Tên và quê đã được lọc trên máy. Có mạng lại sẽ tự tìm trong ghi chú."
              : `Họ tên sẽ được điền sẵn: ${query.trim()}`
          }
          action={
            offlineForCurrent ? undefined : (
              <Button asChild className="h-12 px-5 text-base font-semibold">
                <Link
                  href={routes.doctor.newPatient}
                  onClick={() => {
                    // Carried to the add form inside this tab only, never in the URL.
                    try {
                      sessionStorage.setItem(
                        NEW_PATIENT_NAME_KEY,
                        JSON.stringify({ name: query.trim(), at: Date.now() }),
                      );
                    } catch {
                      // Storage blocked: the form simply opens empty.
                    }
                  }}
                >
                  <PlusIcon className="size-5" aria-hidden />
                  Thêm bệnh nhân
                </Link>
              </Button>
            )
          }
        />
      ) : null}
    </>
  );
}
