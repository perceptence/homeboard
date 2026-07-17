"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speak a task instead of filling in a form.
 *
 * The browser transcribes; OUR engine reads it (see parse.ts). That split
 * matters: nothing here understands anything, it just turns air into a string
 * and hands it to the same parser the typed field uses. One brain, two doors —
 * so speech can never drift from what typing does.
 *
 * Progressive enhancement, deliberately: `supported` is false on Firefox and in
 * every non-secure context, and the caller must keep typing available. Voice is
 * the fast path, never the only path.
 */

/* The Web Speech API isn't in TS's DOM lib, and it's still vendor-prefixed. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const getSR = (): (new () => SpeechRecognitionLike) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | null;
};

export function useDictation(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  // The callback changes every render (it closes over state) — keep it in a ref
  // so the recognition instance isn't torn down mid-sentence.
  const cb = useRef(onFinal);
  cb.current = onFinal;

  // Feature detection must run on the CLIENT: rendering a mic during SSR and
  // then removing it on hydration is a layout jump and a mismatch warning.
  useEffect(() => setSupported(!!getSR()), []);

  const stop = useCallback(() => {
    rec.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const SR = getSR();
    if (!SR) return;
    rec.current?.abort();

    const r = new SR();
    r.lang = navigator.language || "en-GB";
    r.continuous = false;
    r.interimResults = true; // live text while talking — silence looks broken

    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setHeard(text);
      // `isFinal` is the browser deciding you've stopped talking. That's the
      // moment to hand off — not onend, which also fires on cancel.
      if (e.results[e.results.length - 1].isFinal) {
        cb.current(text.trim());
        setListening(false);
      }
    };
    r.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "Microphone blocked — allow it in your browser, or just type."
          : e.error === "no-speech"
            ? "Didn't catch that."
            : "Couldn't listen just now.",
      );
      setListening(false);
    };
    r.onend = () => setListening(false);

    rec.current = r;
    setHeard("");
    setError(null);
    setListening(true);
    r.start();
  }, []);

  // A live microphone must not outlive the sheet that opened it.
  useEffect(() => () => rec.current?.abort(), []);

  return { supported, listening, heard, error, start, stop };
}
