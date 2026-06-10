import { useEffect } from "react";
import { useStream } from "../hooks/useStream";

export interface StreamTextProps {
  fetcher: () => Promise<Response>;
  onFinish?: () => void;
  extractText?: (json: any) => string | undefined;
}

export function StreamText({
  fetcher,
  onFinish,
  extractText,
}: StreamTextProps) {
  const { text, status, error, start } = useStream();

  useEffect(() => {
    start(fetcher, extractText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          }}
        />
      )}
    </div>
  );
}
