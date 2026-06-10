import React, { useMemo } from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent } from "mdast";
import { CodeBlock } from "./CodeBlock";

export type ComponentsMap = {
  h1?: React.FC<{ children: React.ReactNode }>;
  h2?: React.FC<{ children: React.ReactNode }>;
  h3?: React.FC<{ children: React.ReactNode }>;
  p?: React.FC<{ children: React.ReactNode }>;
  a?: React.FC<{ href?: string; children: React.ReactNode }>;
  code?: React.FC<{ inline: boolean; lang?: string; children: string }>;
  table?: React.FC<{ children: React.ReactNode }>;
};

const processor = unified().use(remarkParse).use(remarkGfm);

function renderNode(
  node: RootContent | Root,
  key: string,
  components?: ComponentsMap,
): React.ReactNode {
  // Pre-calculate mapped children to clean up the switch statement
  const mappedChildren =
    "children" in node
      ? node.children.map((child, i) =>
          renderNode(child, `${key}-${i}`, components),
        )
      : null;

  switch (node.type) {
    case "root":
      return (
        <div key={key} className="laminar-markdown">
          {mappedChildren}
        </div>
      );

    case "paragraph":
      if (components?.p)
        return <components.p key={key}>{mappedChildren}</components.p>;
      return (
        <p key={key} style={{ marginBottom: "1rem" }}>
          {mappedChildren}
        </p>
      );

    case "text":
      return <span key={key}>{node.value}</span>;

    case "heading":
      const depthObj = { 1: "h1", 2: "h2", 3: "h3" } as const;
      const hType = depthObj[node.depth as keyof typeof depthObj];

      if (hType && components?.[hType]) {
        const CustomHeading = components[hType]!;
        return <CustomHeading key={key}>{mappedChildren}</CustomHeading>;
      }

      const HeadingTag = `h${node.depth}` as keyof JSX.IntrinsicElements;
      const defaultSizes: Record<number, string> = {
        1: "2em",
        2: "1.5em",
        3: "1.17em",
        4: "1em",
        5: "0.83em",
        6: "0.67em",
      };

      return (
        <HeadingTag
          key={key}
          style={{
            fontSize: defaultSizes[node.depth] || "1em",
            fontWeight: "bold",
            color: "var(--lm-heading)",
            marginTop: "1em",
            marginBottom: "0.5em",
            lineHeight: 1.2,
          }}
        >
          {mappedChildren}
        </HeadingTag>
      );

    case "strong":
      return <strong key={key}>{mappedChildren}</strong>;

    case "emphasis":
      return <em key={key}>{mappedChildren}</em>;

    case "inlineCode":
      if (components?.code)
        return (
          <components.code key={key} inline={true}>
            {node.value}
          </components.code>
        );
      return (
        <code
          key={key}
          style={{
            background: "var(--lm-inline-code-bg)",
            padding: "0.2em 0.4em",
            borderRadius: "4px",
          }}
        >
          {node.value}
        </code>
      );

    case "code":
      if (components?.code)
        return (
          <components.code
            key={key}
            inline={false}
            lang={node.lang || undefined}
          >
            {node.value}
          </components.code>
        );
      return (
        <CodeBlock key={key} lang={node.lang || undefined} code={node.value} />
      );

    case "list":
      const ListTag = node.ordered ? "ol" : "ul";
      return (
        <ListTag key={key} style={{ paddingLeft: "2rem" }}>
          {mappedChildren}
        </ListTag>
      );

    case "listItem":
      return <li key={key}>{mappedChildren}</li>;

    case "blockquote":
      return (
        <blockquote
          key={key}
          style={{
            borderLeft: "4px solid var(--lm-blockquote-border)",
            paddingLeft: "1rem",
            color: "var(--lm-blockquote-text)",
            margin: "1rem 0",
          }}
        >
          {mappedChildren}
        </blockquote>
      );

    case "link":
      if (components?.a)
        return (
          <components.a key={key} href={node.url}>
            {mappedChildren}
          </components.a>
        );
      return (
        <a
          key={key}
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--lm-link)", textDecoration: "underline" }}
        >
          {mappedChildren}
        </a>
      );

    case "thematicBreak":
      return (
        <hr
          key={key}
          style={{
            border: "none",
            borderTop: "1px solid var(--lm-border)",
            margin: "2rem 0",
          }}
        />
      );

    case "table":
      if (components?.table)
        return <components.table key={key}>{mappedChildren}</components.table>;
      return (
        <div key={key} style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              tableLayout: "fixed",
            }}
          >
            <tbody>{mappedChildren}</tbody>
          </table>
        </div>
      );

    case "tableRow":
      return (
        <tr key={key} style={{ borderBottom: "1px solid var(--lm-border)" }}>
          {mappedChildren}
        </tr>
      );

    case "tableCell":
      return (
        <td
          key={key}
          style={{
            padding: "0.75rem 1rem",
            border: "1px solid var(--lm-border)",
            wordWrap: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {mappedChildren}
        </td>
      );

    case "delete":
      return (
        <del key={key} style={{ color: "var(--lm-del)" }}>
          {mappedChildren}
        </del>
      );

    default:
      return null;
  }
}

// This fn patches torn markdown syntax on the fly
function patchMarkdown(rawText: string): string {
  if (!rawText) return rawText;

  let healedText = rawText;
  const lines = healedText.split("\n");
  const lastLine = lines[lines.length - 1];

  // TABLE patching
  // If the last line contains a pipe, the LLM is likely mid-table-row.
  if (lastLine.includes("|")) {
    // If it hasn't closed the final cell, add a closing pipe
    if (!lastLine.trim().endsWith("|")) {
      healedText += " |";
    }
    // remark-gfm strictly requires a newline to finalize a table block.
    // force a newline so the AST doesn't downgrade the row to a paragraph.
    healedText += "\n";
  }

  // CODE BLOCK patching
  // Count the backticks. If it's an odd number, auto-close the block.
  // remark handles trailing characters safely once the block is closed.
  const codeBlockCount = (healedText.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    healedText += "\n```\n";
  }

  // If the very last characters are hanging inline formatting tokens, temporarily slice them off so they don't render as literal text. Because the Table and Code healers above append a '\n', this regex will safely ignore those structural blocks!
  const suspenseRegex = /([*~_`|]+)$/;
  const match = healedText.match(suspenseRegex);

  if (match) {
    // Slice off the dangling tokens just for this render frame
    healedText = healedText.slice(0, -match[0].length);
  }

  return healedText;
}

export const MarkdownRenderer = ({
  text,
  components,
}: {
  text: string;
  components?: ComponentsMap;
}) => {
  const ast = useMemo(() => {
    try {
      const safeText = patchMarkdown(text);
      return processor.parse(safeText);
    } catch (e) {
      console.error("Laminar Markdown Parse Error:", e);
      return { type: "root", children: [] } as Root;
    }
  }, [text]);

  return renderNode(ast, "root", components);
};
