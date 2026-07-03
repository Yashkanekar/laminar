# Laminar UI

**Render streaming LLM output in React.**

LLMs stream text as a live feed of raw chunks. Mid-stream that output is broken containing unclosed code fences, half-finished tables, dangling \*\* and "\_" tokens. Laminar handles incomplete markdown and JSON streams correctly, so your UI never breaks while the response is still arriving.

It handles the full output layer: parsing the SSE stream, healing torn markdown on every frame, and rendering it cleanly while tokens are still arriving.

https://github.com/user-attachments/assets/db0f9ef0-7f46-4a12-be53-b29ac917b980

```bash
npm install laminar-ui
```

---

## What it does

- Parses SSE streams from any LLM provider out of the box
- Patches incomplete markdown syntax in real time so rendering never breaks mid-stream
- Streams and progressively renders partial JSON for structured LLM outputs
- Works with any backend: raw fetch, Vercel AI SDK, Express, or your own setup
- Fully themeable via CSS variables
- Syntax highlighting in code blocks via Shiki, lazy-loaded so it doesn't impact your initial bundle

---

## StreamMarkdown

A drop in component for streaming output in Markdown. Give it a `fetcher` that returns a streaming `Response` and it handles everything else.

```tsx
import { StreamMarkdown } from "laminar-ui";

<StreamMarkdown
  fetcher={() =>
    fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: input }),
      stream: true, // important to make the response streaming as laminar only handles streaming responses.
    })
  }
  onFinish={() => console.log("Stream complete")}
/>;
```

### What it handles mid-stream

Laminar patches broken syntax on every render frame before passing it to the parser, so the output always looks correct even when the LLM is mid-sentence.

| Scenario             | Example mid-stream        | What Laminar does                             |
| -------------------- | ------------------------- | --------------------------------------------- |
| Unclosed code fence  | ` ```python\nprint("hel ` | Auto-closes the block                         |
| Incomplete table row | `\| Name \| Age `         | Adds closing pipe + newline                   |
| Dangling tokens      | `Some **bold`             | Strips for this frame, restores when complete |

### Custom components

Override any rendered element with your own:

```tsx
<StreamMarkdown
  fetcher={fetcher}
  components={{
    h1: ({ children }) => <h1 className="my-heading">{children}</h1>,
    code: ({ inline, lang, children }) =>
      inline ? (
        <code className="inline">{children}</code>
      ) : (
        <MyCodeBlock lang={lang}>{children}</MyCodeBlock>
      ),
    a: ({ href, children }) => (
      <a href={href} target="_blank" className="my-link">
        {children}
      </a>
    ),
  }}
/>
```

**Available overrides:** `h1` `h2` `h3` `p` `a` `code` `table`

---

## StreamText

A lightweight alternative to `StreamMarkdown` for plain text output. Use this
when the LLM response doesn't contain markdown, only simple prose, single-line
answers, or any output where markdown rendering adds unnecessary overhead.

```tsx
import { StreamText } from "laminar-ui";

<StreamText
  fetcher={() =>
    fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: input }),
      stream: true,
    })
  }
  onFinish={() => console.log("Stream complete")}
/>;
```

Renders the raw text stream as-is with no markdown parsing or syntax
highlighting. If you need markdown, use `StreamMarkdown` instead.

---

## useStream

The hook behind `StreamMarkdown`. Use this when you need direct control when building a custom renderer, triggering streams imperatively, or wiring into your own component tree.

```tsx
import { useStream } from "laminar-ui";

function Chat() {
  const { text, status, error, start, stop } = useStream();

  return (
    <>
      <button
        onClick={() => start(() => fetch("/api/chat", { method: "POST" }))}
      >
        Send
      </button>
      <button onClick={stop} disabled={status !== "streaming"}>
        Stop
      </button>
      <pre>{text}</pre>
    </>
  );
}
```

`status` moves through: `"idle"` → `"streaming"` → `"done"` (or `"error"` / `"cancelled"`)

---

## useStreamingJSON

When your LLM returns structured JSON instead of prose. You get a live, partially-hydrated JavaScript object on every frame and fields appear as they arrive, before the stream is complete.

https://github.com/user-attachments/assets/63b01b8d-cf27-4da0-8bf5-257944edb411

```tsx
import { useStreamingJSON } from "laminar-ui";

const extractOpenAIText = (json) => json?.choices?.[0]?.delta?.content;

function fetchRecipeStream(dish) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `<your api key here>`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      stream: true,
      messages: [
        {
          role: "system",
          content: 'Respond ONLY with raw JSON: { "title": string, "time": number, "ingredients": string[], "steps": string[] }',
        },
        { role: "user", content: `Recipe for `${dish}`.` },
      ],
    }),
  });
}

export function Recipes() {
  const { data, status, start } = useStreamingJSON();
  const [dish,setDish] = useState("")
  const isStreaming = status === "streaming";

  return (
    <div>
      <h2>Generative UI</h2>
      <input type="text" value={dish} onChange={(e)=> setDish(e.target.value)}/>
      <button
        onClick={() => start(fetchRecipeStream(dish), extractOpenAIText)}
        disabled={isStreaming}
      >
        {isStreaming ? "Streaming..." : "Generate"}
      </button>

      {/* Renders fields as soon as the keys stream in */}
      {data && (
        <div>
          {data.title && <h3>{data.title}</h3>}
          {data.time && <p>⏱ {data.time} min</p>}
          {data.ingredients && (
            <>
              <h4>Ingredients</h4>
              <ul>
                {data.ingredients.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </>
          )}
          {data.steps && (
            <>
              <h4>Steps</h4>
              <ol>
                {data.steps.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

Uses [`partial-json`](https://github.com/nicolo-ribaudo/partial-json) internally to safely parse incomplete JSON on every frame without throwing.

---

## createStreamAdapter

The SSE parser at Laminar's core. Reads a streaming `Response`, parses `data:` lines, and yields typed tokens. This function is framework-agnostic and works in any JavaScript environment.

```ts
import { createStreamAdapter } from "laminar-ui/core";

const response = await fetch("/api/chat", { method: "POST" });
const adapter = createStreamAdapter(response);

for await (const token of adapter) {
  if (token.type === "text") process(token.content);
  if (token.type === "done") finalize();
  if (token.type === "error") handleError(token.content);
}
```

### Provider formats

Laminar defaults to OpenAI's SSE format. Pass a custom `extractText` function for other providers:

```ts
// OpenAI (default)
createStreamAdapter(response);

// Anthropic
createStreamAdapter(response, (json) => json.delta?.text);

// Gemini
createStreamAdapter(
  response,
  (json) => json.candidates?.[0]?.content?.parts?.[0]?.text,
);

// Your own backend
createStreamAdapter(response, (json) => json.output);
```

The same `extractText` option is available on `StreamMarkdown`, `useStream`, and `useStreamingJSON`.

---

## Integrations

### With Vercel AI SDK

Already using `useChat` for message state? Laminar just replaces the rendering part:

```tsx
import { useChat } from "ai/react";
import { MarkdownRenderer } from "laminar-ui";

function Chat() {
  const { messages, input, handleSubmit, handleInputChange } = useChat();

  return (
    <>
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.role === "assistant" ? (
            <MarkdownRenderer text={msg.content} />
          ) : (
            <p>{msg.content}</p>
          )}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </>
  );
}
```

### With a custom backend

No SDK needed. Point `fetcher` at your own endpoint:

```tsx
<StreamMarkdown
  fetcher={() =>
    fetch("https://your-api.com/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt: userMessage }),
    })
  }
  extractText={(json) => json.output} // match your API's shape
/>
```

### Directly with OpenAI / Anthropic

```tsx
// OpenAI
<StreamMarkdown
  fetcher={() =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    })
  }
/>

// Anthropic
<StreamMarkdown
  fetcher={() =>
    fetch("https://api.anthropic.com/v1/messages", { ... })
  }
  extractText={(json) => json.delta?.text}
/>
```

---

## Theming

All visual styling is controlled via CSS variables. Override them globally to match your design system.

```css
:root {
  --lm-heading: #111827;
  --lm-link: #2563eb;
  --lm-border: #e5e7eb;
  --lm-inline-code-bg: #f3f4f6;
  --lm-blockquote-border: #d1d5db;
  --lm-blockquote-text: #6b7280;
  --lm-del: #ef4444;
}

/* Dark mode */
[data-theme="dark"] {
  --lm-heading: #f9fafb;
  --lm-link: #60a5fa;
  --lm-border: #374151;
  --lm-inline-code-bg: #1f2937;
  --lm-blockquote-border: #4b5563;
  --lm-blockquote-text: #9ca3af;
  --lm-del: #f87171;
}
```

Import the base stylesheet once at your app root:

```ts
import "laminar-ui/laminar.css";
```

---

## API Reference

### `<StreamMarkdown />`

| Prop          | Type                      | Required | Description                                       |
| ------------- | ------------------------- | -------- | ------------------------------------------------- |
| `fetcher`     | `() => Promise<Response>` | ✓        | Function that initiates the LLM stream            |
| `onFinish`    | `() => void`              |          | Called when stream completes                      |
| `extractText` | `(json: any) => string`   |          | Custom token extractor. Defaults to OpenAI format |
| `components`  | `ComponentsMap`           |          | Override rendered elements                        |

### `<StreamText />`

| Prop          | Type                      | Required | Description                                       |
| ------------- | ------------------------- | -------- | ------------------------------------------------- |
| `fetcher`     | `() => Promise<Response>` | ✓        | Function that initiates the LLM stream            |
| `onFinish`    | `() => void`              |          | Called when stream completes                      |
| `extractText` | `(json: any) => string`   |          | Custom token extractor. Defaults to OpenAI format |

### `useStream()`

|          | Type                              | Description                                                         |
| -------- | --------------------------------- | ------------------------------------------------------------------- |
| `text`   | `string`                          | Full accumulated text so far                                        |
| `status` | `StreamStatus`                    | `"idle"` \| `"streaming"` \| `"done"` \| `"error"` \| `"cancelled"` |
| `error`  | `string \| null`                  | Error message if status is `"error"`                                |
| `start`  | `(fetcher, extractText?) => void` | Begin streaming                                                     |
| `stop`   | `() => void`                      | Cancel the stream                                                   |

### `useStreamingJSON<T>()`

|          | Type                               | Description                              |
| -------- | ---------------------------------- | ---------------------------------------- |
| `data`   | `T \| null`                        | Live partial object, updated every frame |
| `status` | `StreamStatus`                     | Same as `useStream`                      |
| `error`  | `string \| null`                   | Error message if status is `"error"`     |
| `start`  | `(response, extractText?) => void` | Begin streaming                          |
| `stop`   | `() => void`                       | Cancel the stream                        |

---

## Contributing

Issues and PRs are welcome.

```bash
git clone https://github.com/Yashkanekar/laminar-ui
cd laminar-ui
npm install
npm run dev
```

## License

MIT
