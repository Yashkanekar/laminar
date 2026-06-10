import { useEffect } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { useStream } from "../useStream";

type StreamMarkdownProps = {
  fetcher: () => Promise<Response>;
  onFinish?: () => void;
  extractText?: (json: any) => string;
};

export const StreamMarkdown = ({
  fetcher,
  onFinish,
  extractText,
}: StreamMarkdownProps) => {
  const { text, status, start } = useStream();

  useEffect(() => {
    start(fetcher, extractText);
  }, []); // ensures it only fires once

  useEffect(() => {
    if (status === "done" && onFinish) {
      onFinish();
    }
  }, [status, onFinish]);

  return <MarkdownRenderer text={text} />;
};
