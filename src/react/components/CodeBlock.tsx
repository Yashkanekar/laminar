import { useEffect, useState } from "react";

let globalHighlighter: any = null;
let initPromise: Promise<any> | null = null;

type CodeBlockProps = {
  lang?: string;
  code: string;
};

export const CodeBlock = ({ lang, code }: CodeBlockProps) => {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!lang) return;
    let isMounted = true;

    const timer = setTimeout(async () => {
      try {
        if (!initPromise) {
          const shiki = await import("shiki");
          initPromise = shiki.createHighlighter({
            themes: ["vitesse-dark"],
            langs: [],
          });
        }

        globalHighlighter = await initPromise;

        const loadedLangs = globalHighlighter.getLoadedLanguages();
        if (!loadedLangs.includes(lang)) {
          await globalHighlighter.loadLanguage(lang);
        }

        const codeHtml = globalHighlighter.codeToHtml(code, {
          lang,
          theme: "vitesse-dark",
        });

        if (isMounted) setHtml(codeHtml);
      } catch (error) {
        console.warn(
          `Laminar: Shiki failed to highlight lang '${lang}'`,
          error,
        );
      }
    }, 80);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [lang, code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="laminar-code-block"
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

      {html ? (
        <div
          dangerouslySetInnerHTML={{ __html: html }}
          style={{ borderRadius: "8px", overflow: "hidden" }}
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
            margin: 0,
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
