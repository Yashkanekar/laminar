# Laminar

A React library for building generative UIs from streaming LLM / backend responses.

## Use case

Handling Server-Sent Events (SSE) and streaming LLM responses in React is notoriously difficult. Laminar abstracts away fragmented network packets and complex component lifecycles. It gives you a clean, plug-and-play pipeline: **Backend stream goes in -> Smooth UI state comes out.**
Laminar gathers streaming response chunks and updates your screen at a steady, perfectly paced 60 frames per second.

## Features

- Frame-Rate Synced: Uses `requestAnimationFrame` to batch DOM updates, maintaining 60fps even during high-speed token streams.
- Agnostic Parsing: Currently natively supports OpenAI's streaming response format, but handles deep custom JSON formats (can be either any other LLM's responses like Anthropic, Gemini etc Or custom python backed) via custom extraction functions.
- Generative UI ready: stream and incrementally parse partial JSON in real time
- Drop-in component: get started in 30 seconds with `<StreamText />`

## Core concepts

### Why rAF buffering?

A typical LLM backend streams 30–80 chunks per second. Without buffering, each chunk triggers a React re-render. Laminar collects all chunks that arrive within a single frame and flushes them together in one state update, aligned to requestAnimationFrame.
Result: at most 60 re-renders per second, regardless of network speed.

### Stream sources

Laminar normalizes any stream source into a common `AsyncIterable <StreamToken>` interface. You can pass a fetch Response, a ReadableStream, or a raw EventSource.

```js
	type StreamToken = {
		type: "text" | "json" | "error" | "done";
		content: string;
	};
```

### Terminal states

Laminar distinguishes three terminal states:

| State     | Description                                        |
| :-------- | :------------------------------------------------- |
| done      | stream completed normally                          |
| error     | network or parse failure (error message available) |
| cancelled | explicitly stopped by the user via stop()          |

---

## Installation

```bash
npm install laminar
```

(Requires react >= 18.0 and react-dom as peer dependencies.)

---

## 1. Quick start: The Drop-In `<StreamText>` Component

If you just need a standard text container to display streaming outputs (like a standard AI chat application), use the <StreamText /> component. It automatically handles the React lifecycle and streams.
You own the fetch request; Laminar handles chunking, buffering, and rendering.

#### NOTE : Laminar only works for streaming responses.

Always remember to pass `{stream: true} ` option in the request body of your fetch request

```javascript
import { useState } from "react";
import { StreamText } from "laminar";

export default function ChatBubble() {
  const [prompt, setPrompt] = useState("Tell me a story...");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchOpenAIText = async () => {
    return fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer YOUR_API_KEY`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: submittedPrompt }],
        stream: true, // ######IMP: making sure that the response is streamed for laminar to work ####
      }),
    });
  };

  const handleSend = () => {
    setSubmittedPrompt(prompt);
    setIsGenerating(true);
  };

  return (
    <div>
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={isGenerating}
      />
      <button onClick={handleSend} disabled={isGenerating}>
        Send
      </button>

      {/* The key prop safely destroys and resets the stream on new prompts */}
      {submittedPrompt && (
        <StreamText
          key={submittedPrompt}
          fetcher={fetchOpenAIText}
          onFinish={() => setIsGenerating(false)}
        />
      )}
    </div>
  );
}
```

## 2. Advanced Control: `useStream`

When you need absolute imperative control over when a stream starts, pauses, or stops (e.g., custom UI triggers or complex form submissions), use the `useStream` hook.

```js
const { text, status, error, start, stop } = useStream();
```

| State  | Description                                                                            |
| :----- | :------------------------------------------------------------------------------------- |
| text   | string Accumulated text so far                                                         |
| status | idle', 'streaming', 'done'. Current stream state.                                      |
| error  | string/null Set when status is 'error'                                                 |
| start  | (response, extractText?) => void Begin streaming from a Response or Promise<Response>. |
| stop   | () => void                                                                             |

Example:

```javascript
import { useStream } from "laminar";

export default function CustomController() {
  const { text, status, error, start, stop } = useStream();

  const fetchStream = async () => {
    return fetch("/api/my-custom-stream");
  };

  return (
    <div>
      <button
        onClick={() => start(fetchStream)}
        disabled={status === "streaming"}
      >
        Start Stream
      </button>
      <button onClick={stop} disabled={status !== "streaming"}>
        Cancel
      </button>

      {status === "error" && <p>Error: {error}</p>}
      <p>{text}</p>
    </div>
  );
}
```

## 3. Custom Backend Response Formats

Laminar natively targets OpenAI's standard layout `(json.choices[0].delta.content)`. If your backend returns a completely custom server-sent event (SSE) payload, you can pass an extractText function to tell Laminar where to find the text node.

```javascript
// If your backend sends: { "serverData": { "fragment": "Hello " } }

<StreamText
  key={id}
  fetcher={fetchMyCustomBackend}
  extractText={(json) => json?.serverData?.fragment}
/>
```

## 4. `useStreamingJSON`

If you are streaming structured data to build complex user interfaces (Generative UI), use `useStreamingJSON`. It safely patches incomplete JSON strings in real-time, allowing you to map over arrays and properties without crashing React.
Useful for generative UI i.e. rendering components progressively as the LLM emits a structured object.

The parser is fault-tolerant: it extracts whatever valid structure it can from each chunk and discards malformed fragments. It never throws on incomplete JSON.

```js
const { data, status, error, start, stop } = useStreamingJSON<WeatherData>();
```

| State  | Description                                                                            |
| :----- | :------------------------------------------------------------------------------------- |
| data   | T/ null. Safely parsed object, updating as new keys arrive.                            |
| status | idle', 'streaming', 'done'. Current stream state.                                      |
| error  | string/null Set when status is 'error'                                                 |
| start  | (response, extractText?) => void Begin streaming from a Response or Promise<Response>. |
| stop   | () => void                                                                             |

Example:

```js
import { useStreamingJSON } from "laminar";

type WeatherData = {
  city: string;
  temp: number;
  condition: string;
};

function WeatherWidget() {
  const { data, status, start } = useStreamingJSON<WeatherData>();

  return (
    <div>
      <button onClick={() => start(fetch("/api/weather-agent"))}>
        Generate
      </button>
      {data && (
        <div>
          <h2>{data.city ?? "Locating..."}</h2>
          <h1>{data.temp != null ? `${data.temp}°C` : "--"}</h1>
          <p>{data.condition ?? ""}</p>
        </div>
      )}
    </div>
  );
}
```

### Generative UI pattern

The real power of `useStreamingJSON` is rendering components progressively as the LLM describes them. Fields render as soon as they arrive — you don't wait for the closing brace.

Backend prompt instructs the LLM to output:

```js
{
  title: "Q3 Revenue",
  metric: 2400000,
  trend: "up",
  summary: "Revenue grew 14% quarter over quarter...",
};
```

Frontend renders each field as it streams in:

```js

function ReportCard() {
  const { data } = useStreamingJSON<ReportData>();

  return (
    <div className="card">
      {data?.title && <h2>{data.title}</h2>}
      {data?.metric && <Metric value={data.metric} />}
      {data?.trend && <TrendBadge direction={data.trend} />}
      {data?.summary && <p>{data.summary}</p>}
    </div>
  );
}
```

## 5. `createStreamAdapter()` Core Engine / Vanilla JS

If you are building your own custom hooks, or want to use Laminar's robust SSE parsing engine outside of React entirely (like in Vanilla JS, Svelte, or a Node script), you can use the core stream adapter directly. It takes a raw network Response and returns an AsyncGenerator of stream tokens.

Example:

```javascript
import { createStreamAdapter } from "laminar";

async function processStream() {
  const response = await fetch("...");

  // Create an async generator from the raw response
  const stream = createStreamAdapter(response);

  for await (const token of stream) {
    if (token.type === "text") {
      console.log("New chunk:", token.content);
    } else if (token.type === "done") {
      console.log("Stream complete!");
    } else if (token.type === "error") {
      console.error("Stream failed:", token.content);
    }
  }
}
```

---

## Roadmap

- useStreamingJSON array support (stream arrays of objects)
- `< StreamMarkdown/>` component for rendering a streaming response in markdown format

---

## Contributing

Issues and PRs are welcome.

```bash
git clone https://github.com/Yashkanekar/laminar
cd laminar
npm install
npm run dev
```

## License

MIT
