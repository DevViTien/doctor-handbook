"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { SEARCH_MESSAGES } from "@/modules/search/constants";

/**
 * The minimal part of the Web Speech API used here. The DOM lib of TypeScript does not ship a
 * standard `SpeechRecognition` type, so this is declared locally instead of adding `@types`.
 */
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

const noSubscription = () => () => undefined;

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": SEARCH_MESSAGES.micDenied,
  "service-not-allowed": SEARCH_MESSAGES.micDenied,
  "no-speech": SEARCH_MESSAGES.noSpeech,
  network: SEARCH_MESSAGES.speechNetwork,
};

/**
 * Voice search (spec patient-search "Tìm bằng giọng nói", teckstack.md §4.8): Vietnamese
 * recognition from the browser; the words are handed to `onTranscript` as they come, so the list
 * filters exactly as when typing. `supported` is false on the server and in browsers without the
 * API, so the mic button only appears after hydration, where it can work.
 */
export function useSpeechSearch(onTranscript: (text: string) => void) {
  const supported = useSyncExternalStore(
    noSubscription,
    () => getRecognition() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const stop = useCallback(() => {
    recognition.current?.stop();
    // Some browsers never fire `onend` after `stop()`: do not leave the button "listening".
    setListening(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const start = useCallback(() => {
    const Recognition = getRecognition();
    if (!Recognition) return;
    recognition.current?.abort();

    const instance = new Recognition();
    instance.lang = "vi-VN";
    instance.interimResults = true;
    instance.continuous = false;
    instance.maxAlternatives = 1;
    instance.onresult = (event) => {
      // Several results (Safari, some Android builds) are separate phrases: keep a space.
      const text = Array.from(event.results, (result) => result[0]?.transcript ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      onTranscriptRef.current(text);
    };
    instance.onerror = (event) => {
      // "aborted": the doctor stopped it, or the page left; nothing to report.
      if (event.error !== "aborted") {
        setError(ERROR_MESSAGES[event.error] ?? SEARCH_MESSAGES.speechFailed);
      }
    };
    instance.onend = () => {
      setListening(false);
      if (recognition.current === instance) recognition.current = null;
    };

    recognition.current = instance;
    setError(null);
    setListening(true);
    try {
      instance.start();
    } catch {
      setListening(false);
      setError(SEARCH_MESSAGES.speechFailed);
    }
  }, []);

  // Leaving the page while listening: stop the microphone.
  useEffect(() => () => recognition.current?.abort(), []);

  return { supported, listening, error, start, stop, clearError };
}
