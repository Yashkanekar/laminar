import { useEffect, useState } from "react";

type CodeBlockProps = {
  lang?: string;
  code: string;
};

export const CodeBlock = ({ lang, code }: CodeBlockProps) => {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (lang) {
      import("shiki")
        .then(async (shiki) => {
          try {
            const highlighter = await shiki.createHighlighter({
              themes: ["vitesse-dark"],
              langs: [lang],
            });

            const codeHtml = highlighter.codeToHtml(code, {
              lang,
              theme: "vitesse-dark",
            });

            if (isMounted) setHtml(codeHtml);
          } catch (internalError) {
            // Catch errors if the LLM provides a language Shiki doesn't support
            console.warn(
              `Laminar: Shiki could not highlight lang '${lang}'`,
              internalError,
            );
          }
        })
        .catch((loadError) => {
          console.warn(`Laminar: Failed to dynamically load Shiki`, loadError);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [lang, code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: "relative",
        marginBottom: "1.5rem",
        marginTop: "1rem",
      }}
    >
      <button
        onClick={handleCopy}
        style={{
          position: "absolute",
          top: "0.5rem",
          right: "0.5rem",
          padding: "0.25rem 0.5rem",
          fontSize: "0.75rem",
          backgroundColor: "rgba(255,255,255,0.1)",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>

      {/* If Shiki hasn't loaded yet, fallback to the standard pre block */}
      {html ? (
        <div
          className="laminar-code-block"
          dangerouslySetInnerHTML={{ __html: html }}
          style={{ overflowX: "auto", borderRadius: "8px" }}
        />
      ) : (
        <pre
          style={{
            background: "var(--lm-code-bg)",
            color: "var(--lm-code-text)",
            padding: "1rem",
            borderRadius: "8px",
            overflowX: "auto",
            minHeight: "3rem",
            transition: "height 0.1s ease-out",
          }}
        >
          {lang && (
            <div
              style={{
                fontSize: "0.8em",
                color: "#888",
                marginBottom: "0.5em",
              }}
            >
              {lang}
            </div>
          )}
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
};
