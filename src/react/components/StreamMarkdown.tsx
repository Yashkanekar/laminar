import { useEffect } from "react";
import { MarkdownRenderer, type ComponentsMap } from "./MarkdownRenderer";
import { useStream } from "../hooks/useStream";
import "../../styles/laminar.css";
type StreamMarkdownProps = {
  fetcher: () => Promise<Response>;
  onFinish?: () => void;
  extractText?: (json: any) => string;
  components?: ComponentsMap;
};

export const StreamMarkdown = ({
  fetcher,
  onFinish,
  extractText,
  components,
}: StreamMarkdownProps) => {
  const { text, status, start } = useStream();

  useEffect(() => {
    start(fetcher, extractText);
  }, []);

  useEffect(() => {
    if (status === "done" && onFinish) {
      onFinish();
    }
  }, [status, onFinish]);

  return <MarkdownRenderer text={text} components={components} />;
};
