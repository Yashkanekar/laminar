import React, { useMemo } from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root, RootContent } from "mdast";
import remarkGfm from "remark-gfm";

const processor = unified().use(remarkParse).use(remarkGfm);

function renderNode(node: RootContent | Root, key: string): React.ReactNode {
  switch (node.type) {
    case "root":
      return (
        <div key={key} className="laminar-markdown">
          {node.children.map((child, i) => renderNode(child, `${key}-${i}`))}
        </div>
      );

    case "paragraph":
      return (
        <p key={key} style={{ marginBottom: "1rem" }}>
          {node.children.map((child, i) => renderNode(child, `${key}-${i}`))}
        </p>
      );

    case "text":
      return <span key={key}>{node.value}</span>;

    case "heading":
      const HeadingTag = `h${node.depth}` as keyof JSX.IntrinsicElements;

      // browser default sizes for headings
      const defaultSizes: Record<number, string> = {
        1: "2em",
        2: "1.5em",
        3: "1.17em",
        4: "1em",
        5: "0.83em",
        6: "0.67em",
      };

      const fontSize = defaultSizes[node.depth] || "1em";

      return (
        <HeadingTag
          key={key}
          style={{
            fontSize,
            fontWeight: "bold",
            marginTop: "1em",
            marginBottom: "0.5em",
            lineHeight: 1.2,
          }}
        >
          {node.children.map((child, i) => renderNode(child, `${key}-${i}`))}
        </HeadingTag>
      );

    case "strong":
      return (
        <strong key={key}>
          {node.children.map((child, i) => renderNode(child, `${key}-${i}`))}
        </strong>
      );

    case "emphasis":
      return (
        <em key={key}>
          {node.children.map((child, i) => renderNode(child, `${key}-${i}`))}
        </em>
      );

    case "inlineCode":
      return (
        <code
          key={key}
          style={{
            background: "#f0f0f0",
            padding: "0.2em 0.4em",
            borderRadius: "4px",
          }}
        >
          {node.value}
        </code>
      );

    case "code":
      return (
        <pre
          key={key}
          style={{
            background: "#1e1e1e",
            color: "#d4d4d4",
            padding: "1rem",
            borderRadius: "8px",
            overflowX: "auto",
            minHeight: "3rem",
            transition: "height 0.1s ease-out",
          }}
        >
          {node.lang && (
            <div
              style={{
                fontSize: "0.8em",
                color: "#888",
                marginBottom: "0.5em",
              }}
            >
              {node.lang}
            </div>
          )}
          <code>{node.value}</code>
        </pre>
      );

    case "list":
      const ListTag = node.ordered ? "ol" : "ul";
      return (
        <ListTag key={key} style={{ paddingLeft: "2rem" }}>
          {node.children.map((child, i) => renderNode(child, `${key}-${i}`))}
        </ListTag>
      );

    case "listItem":
      return (
        <li key={key}>
          {node.children.map((child, i) => renderNode(child, `${key}-${i}`))}
        </li>
      );

    case "blockquote":
      return (
        <blockquote
          key={key}
          style={{
            borderLeft: "4px solid #ddd",
            paddingLeft: "1rem",
            color: "#666",
            margin: "1rem 0",
          }}
        >
          {node.children.map((child, i) => renderNode(child, `${key}-${i}`))}
        </blockquote>
      );

    case "link":
      return (
        <a
          key={key}
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#0366d6", textDecoration: "underline" }}
        >
          {node.children.map((child, i) => renderNode(child, `${key}-${i}`))}
        </a>
      );

    case "thematicBreak":
      return (
        <hr
          key={key}
          style={{
            border: "none",
            borderTop: "1px solid #eaeaea",
            margin: "2rem 0",
          }}
        />
      );

    case "table":
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
            <tbody>
              {node.children.map((child, i) =>
                renderNode(child, `${key}-${i}`),
              )}
            </tbody>
          </table>
        </div>
      );

    case "tableCell":
      return (
        <td
          key={key}
          style={{
            padding: "0.75rem 1rem",
            border: "1px solid #eaeaea",
            wordWrap: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {node.children.map((child, i) => renderNode(child, `${key}-${i}`))}
        </td>
      );

    case "tableRow":
      return (
        <tr key={key} style={{ borderBottom: "1px solid #eaeaea" }}>
          {node.children.map((child, i) => renderNode(child, `${key}-${i}`))}
        </tr>
      );

    case "delete":
      return (
        <del key={key} style={{ color: "#888" }}>
          {node.children.map((child, i) => renderNode(child, `${key}-${i}`))}
        </del>
      );

    default:
      // Fallback for unsupported nodes
      console.warn(`Laminar: Unsupported markdown node type: ${node.type}`);
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

export const MarkdownRenderer = ({ text }: { text: string }) => {
  const ast = useMemo(() => {
    try {
      const safeText = patchMarkdown(text);

      return processor.parse(safeText);
    } catch (e) {
      console.error("Laminar Markdown Parse Error:", e);
      return { type: "root", children: [] } as Root;
    }
  }, [text]);

  return renderNode(ast, "root");
};
