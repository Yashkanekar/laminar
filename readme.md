# Laminar

A framework-agnostic streaming UI library for React.

## Use case

When an AI generates a response; whether it is writing a long paragraph of text or building a dynamic widget on the fly, it sends data to your app in dozens of tiny, rapid pieces. If your app tries to redraw the screen for every single piece, it can freeze, stutter, or drop frames.
Laminar acts as a background manager. It quietly gathers these rapid-fire pieces and updates your screen at a steady, perfectly paced 60 frames per second.

## Features

- Zero jank: rAF-aligned buffering prevents React from choking on rapid-fire network chunks
- Framework agnostic: works with any backend (OpenAI, Anthropic, custom Python, etc.)
- Generative UI ready: stream and incrementally parse partial JSON in real time
- Drop-in component: get started in 30 seconds with `<StreamText />`
- Tiny: ~4KB core, tree-shakeable, zero required dependencies beyond React

## Installation

```bash
npm install laminar
```

Requires react >= 18.0 and react-dom as peer dependencies.

## Quick start

If you just want streamed text, use the `< StreamText />` component.
You own the fetch request; Laminar handles chunking, buffering, and rendering.

```jsx
import { useState } from "react";
import { StreamText } from "laminar";

export default function MyChatApp() {
  const [prompt, setPrompt] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // define your own fetch logic targeting your own API
  const myBackendFetcher = async () => {
    return fetch("https://fake-backend.com/generate-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: submittedPrompt }),
    });
  };

  const handleSend = () => {
    if (!prompt) return;
    setSubmittedPrompt(prompt);
    setIsGenerating(true);
  };

  return (
    <div className="chat-container">
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ask the AI something..."
      />
      <button onClick={handleSend} disabled={isGenerating}>
        Send
      </button>

      <div className="output-box">
        {submittedPrompt ? (
          /* Use the drop StreamText component */
          <StreamText
            key={submittedPrompt}
            fetcher={myBackendFetcher}
            onFinish={() => setIsGenerating(false)}
          />
        ) : (
          <p>Ready for input...</p>
        )}
      </div>
    </div>
  );
}
```

---

## Core concepts

### Why rAF buffering?

A typical LLM backend sends 30–80 chunks per second. Without buffering, each chunk triggers a React re-render. At 60 chunks/second that's ~16ms per render budget Laminar collects all chunks that arrive within a single frame and flushes them together in one state update, aligned to requestAnimationFrame.
Result: at most 60 re-renders per second, regardless of network speed.

### Stream sources

Laminar normalizes any stream source into a common `AsyncIterable <StreamToken>` interface. You can pass a fetch Response, a ReadableStream, or a raw EventSource.

```js
	type StreamToken = {
		type: "text" | "json" | "error" | "done";
		content: string;
	};
```

### Cancellation states

Laminar distinguishes three terminal states:

| State     | Description                                        |
| :-------- | :------------------------------------------------- |
| done      | stream completed normally                          |
| error     | network or parse failure (error message available) |
| cancelled | explicitly stopped by the user via stop()          |

---

## API reference

### < StreamText />

The drop-in component. Renders streaming text.

```js

<StreamText
  fetcher={() => fetch('/api/chat', { method: 'POST', body: '...' })}
  onFinish={() =>void}
/>

```

Props:

```js
fetcher () => Promise<Response> Required. //Called once on mount.
extractText (json: any) => string //Custom extractor for non-standard response shapes.
```

<!-- | State | Description |
| :--- | :--- |
| done | stream completed normally |
| error | network or parse failure (error message available) |
 -->

### useStream()

The core hook for text streaming. Use this when you need direct access to state.

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

```jsx
import { useStream } from "laminar";

function Chat() {
  const { text, status, start, stop } = useStream();

  const handleSend = () => {
    start(
      fetch("/api/chat", { method: "POST", body: JSON.stringify({ prompt }) }),
    );
  };

  return (
    <div>
      <button onClick={handleSend} disabled={status === "streaming"}>
        Send
      </button>

      <button onClick={stop} disabled={status !== "streaming"}>
        Stop
      </button>

      <p>{text}</p>

      <span>{status}</span>
    </div>
  );
}
```

### useStreamingJSON<T>()

Streams and incrementally parses partial JSON in real time. Useful for generative UI i.e. rendering components progressively as the LLM emits a structured object.

```js
const { data, status, error, start, stop } = useStreamingJSON<WeatherData>();
```

Fields appear as soon as their values are complete.

| State  | Description                                                                            |
| :----- | :------------------------------------------------------------------------------------- |
| data   | T/ null. Safely parsed object, updating as new keys arrive.                            |
| status | idle', 'streaming', 'done'. Current stream state.                                      |
| error  | string/null Set when status is 'error'                                                 |
| start  | (response, extractText?) => void Begin streaming from a Response or Promise<Response>. |
| stop   | () => void                                                                             |

The parser is fault-tolerant: it extracts whatever valid structure it can from each chunk and discards malformed fragments. It never throws on incomplete JSON.

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

---

## Generative UI pattern

The real power of useStreamingJSON is rendering components progressively as the LLM describes them. Fields render as soon as they arrive — you don't wait for the closing brace.

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

---

## Roadmap

- useStreamingJSON array support (stream arrays of objects)
- Retry / reconnect logic for SSE
- Vue and Svelte adapters
- useMultiStream (merge concurrent streams for agentic UIs)
- React Native support

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
