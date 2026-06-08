import { useState, useRef, useCallback, useEffect } from "react";
import { createStreamAdapter } from "../core/adapter";

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
  const rAF_Id = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // When the component unmounts, forcefully kill the network stream and unlocks the reader.
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
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
      fetcherFn: () => Promise<Response>,
      extractText?: (json: any) => string | undefined,
    ) => {
      setText("");
      setError(null);
      setStatus("streaming");
      bufferRef.current = "";

      if (rAF_Id.current) cancelAnimationFrame(rAF_Id.current);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;

      try {
        const resolvedResponse = await fetcherFn();
        const adapter = createStreamAdapter(resolvedResponse, extractText);

        for await (const token of adapter) {
          if (currentAbortController.signal.aborted) {
            setStatus("cancelled");
            break;
          }

          if (token.type === "text") {
            bufferRef.current += token.content;
            if (!rAF_Id.current) {
              rAF_Id.current = requestAnimationFrame(flushBufferToReact);
            }
          } else if (token.type === "done") {
            flushBufferToReact(); //if the stream has ended, then flushing any remaining buffer immediately
            setStatus("done");
          } else if (token.type === "error") {
            setError(token.content);
            setStatus("error");
          }
        }
      } catch (err: any) {
        if (
          err.name !== "AbortError" &&
          !currentAbortController.signal.aborted
        ) {
          setError(err instanceof Error ? err.message : "Unknown Stream Error");
          setStatus("error");
        }
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
