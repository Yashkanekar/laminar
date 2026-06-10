import { useState, useRef, useCallback } from "react";
import { parse } from "partial-json";
import { createStreamAdapter } from "../core/adapter";
import type { StreamStatus } from "./hooks/useStream";

export function useStreamingJSON<T = any>() {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const bufferRef = useRef("");
  const rAF_Id = useRef<number | null>(null);
  const isCancelledRef = useRef(false);

  const flushBufferToReact = useCallback(() => {
    if (bufferRef.current.length > 0) {
      try {
        // partial-json evaluates the broken string string, closes any open quotes/brackets/braces, and returns a valid JavaScript object.
        const parsedObject = parse(bufferRef.current);
        setData(parsedObject as T);
      } catch (err) {
        // If a chunk splits a primitive type completely unpredictably, dont throw the error and try again on the next frame.
      }
    }
    rAF_Id.current = null;
  }, []);

  const start = useCallback(
    async (
      response: Response | Promise<Response>,
      extractText?: (json: any) => string | undefined,
    ) => {
      setData(null);
      setError(null);
      setStatus("streaming");
      bufferRef.current = "";
      isCancelledRef.current = false;

      if (rAF_Id.current) cancelAnimationFrame(rAF_Id.current);

      try {
        const resolvedResponse = await Promise.resolve(response);
        const adapter = createStreamAdapter(resolvedResponse, extractText);

        for await (const token of adapter) {
          if (isCancelledRef.current) {
            setStatus("cancelled");
            break;
          }

          if (token.type === "text") {
            bufferRef.current += token.content;

            // Scheduling an UI repaint if one isn't already queued up
            if (!rAF_Id.current) {
              rAF_Id.current = requestAnimationFrame(flushBufferToReact);
            }
          } else if (token.type === "done") {
            flushBufferToReact();
            setStatus("done");
          } else if (token.type === "error") {
            setError(token.content);
            setStatus("error");
          }
        }
      } catch (err) {
        if (!isCancelledRef.current) {
          setError(
            err instanceof Error ? err.message : "Unknown JSON Hook Error",
          );
          setStatus("error");
        }
      }
    },
    [flushBufferToReact],
  );

  const stop = useCallback(() => {
    isCancelledRef.current = true;
    flushBufferToReact();
    setStatus("cancelled");
  }, [flushBufferToReact]);

  return { data, status, error, start, stop };
}
