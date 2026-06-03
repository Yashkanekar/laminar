import { useState, useRef, useCallback } from "react";
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
  const isCancelledRef = useRef(false);

  const flushBufferToReact = useCallback(() => {
    if (bufferRef.current.length > 0) {
      setText((prev) => prev + bufferRef.current);
      bufferRef.current = "";
    }
    rAF_Id.current = null;
  }, []);

  const start = useCallback(
    async (
      response: Response | Promise<Response>,
      extractText?: (json: any) => string | undefined,
    ) => {
      setText("");
      setError(null);
      setStatus("streaming");
      bufferRef.current = "";
      isCancelledRef.current = false;

      if (rAF_Id.current) cancelAnimationFrame(rAF_Id.current);

      try {
        // Resolve the response in case the dev passed a raw fetch() promise
        const resolvedResponse = await Promise.resolve(response);

        const adapter = createStreamAdapter(resolvedResponse, extractText);

        for await (const token of adapter) {
          // If the user called stop(), break out of the loop immediately
          if (isCancelledRef.current) {
            setStatus("cancelled");
            break;
          }

          if (token.type === "text") {
            //if token is text then we add it to the buffer and schedule a rAF callback to flush it to React state on the next frame.
            bufferRef.current += token.content;
            if (!rAF_Id.current) {
              rAF_Id.current = requestAnimationFrame(flushBufferToReact);
            }
          } else if (token.type === "done") {
            // The stream ended. Force one last flush to get remaining characters.
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
            err instanceof Error ? err.message : "Unknown React Hook Error",
          );
          setStatus("error");
        }
      }
    },
    [flushBufferToReact],
  );

  const stop = useCallback(() => {
    isCancelledRef.current = true;
    //force a flush here so the user sees exactly where it stopped
    flushBufferToReact();
    setStatus("cancelled");
  }, [flushBufferToReact]);

  return { text, status, error, start, stop };
}
