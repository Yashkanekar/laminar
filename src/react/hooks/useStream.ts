import { useState, useRef, useCallback, useEffect } from "react";
import { createStreamAdapter } from "../../core/adapter";

type RAFCallback = (timestamp: number) => void;
type RAFHandle = ReturnType<typeof setTimeout> | number;

// A simple cross-environment requestAnimationFrame and cancelAnimationFrame implementation. In a browser environment, it uses the native requestAnimationFrame. In a non-browser environment (like Node.js), it falls back to using setTimeout with a 16ms delay to approximate 60fps.
const raf = (cb: RAFCallback): RAFHandle => {
  if (typeof window === "undefined") {
    return setTimeout(() => cb(Date.now()), 16);
  }
  return window.requestAnimationFrame(cb);
};

const caf = (id: RAFHandle): void => {
  if (typeof window === "undefined") {
    clearTimeout(id as ReturnType<typeof setTimeout>);
    return;
  }
  window.cancelAnimationFrame(id as number);
};

export type StreamStatus =
  | "idle"
  | "streaming"
  | "done"
  | "error"
  | "cancelled";

export function useStream() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const bufferRef = useRef("");
  const rAF_Id = useRef<RAFHandle | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // When component unmounts, stop any ongoing streams and rAF callbacks to prevent memory leaks and React state updates on unmounted components.
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (rAF_Id.current) {
        caf(rAF_Id.current);
      }
    };
  }, []);

  const flushBufferToReact = useCallback(() => {
    if (bufferRef.current.length > 0) {
      const textToFlush = bufferRef.current;
      setText((prev) => prev + textToFlush);
      bufferRef.current = "";
    }
    rAF_Id.current = null;
  }, []);

  const start = useCallback(
    async (
      fetcherFn: Promise<Response> | (() => Promise<Response>),
      extractText?: (json: any) => string | undefined,
    ) => {
      setText("");
      setError(null);
      setStatus("streaming");
      bufferRef.current = "";

      if (rAF_Id.current) caf(rAF_Id.current);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;

      try {
        const resolvedResponse =
          typeof fetcherFn === "function" ? await fetcherFn() : await fetcherFn;
        const adapter = createStreamAdapter(resolvedResponse, extractText);

        for await (const token of adapter) {
          if (currentAbortController.signal.aborted) {
            setStatus("cancelled");
            break;
          }

          if (token.type === "text") {
            bufferRef.current += token.content;
            if (!rAF_Id.current) {
              rAF_Id.current = raf(flushBufferToReact);
            }
          } else if (token.type === "done") {
            flushBufferToReact();
            setStatus("done");
          } else if (token.type === "error") {
            setError(token.content);
            setStatus("error");
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown Stream Error");
        setStatus("error");
      }
    },
    [flushBufferToReact],
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    flushBufferToReact();
    setStatus("cancelled");
  }, [flushBufferToReact]);

  return { text, status, error, start, stop };
}
