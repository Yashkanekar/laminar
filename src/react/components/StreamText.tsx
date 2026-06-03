import { useEffect, useRef } from "react";
import { useStream } from "../useStream";

export interface StreamTextProps {
  fetcher: () => Promise<Response>;
  onFinish?: () => void;
}

export function StreamText({ fetcher, onFinish }: StreamTextProps) {
  const { text, status, error, start } = useStream();

  const hasStarted = useRef(false);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      start(fetcher());
    }
  }, [fetcher, start]);

  useEffect(() => {
    if (status === "done") {
      onFinish?.();
    }
  }, [status, onFinish]);

  if (error) {
    return <div style={{ color: "red" }}>Error: {error}</div>;
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.6" }}>
      {text}
      {status === "streaming" && (
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "15px",
            backgroundColor: "currentColor",
            marginLeft: "4px",
            // animation: "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
      )}
    </div>
  );
}
