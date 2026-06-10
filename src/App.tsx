import { useState } from "react";
import { StreamText } from "./react/components/StreamText";
import { mockSSEFetch } from "./utils/mockBackend";
import { TestHarness } from "./react/TestHarness";

export default function App() {
  const [prompt, setPrompt] = useState("Enter example text here to stream");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSend = () => {
    if (!prompt.trim()) return;
    setSubmittedPrompt(prompt);
    setIsGenerating(true);
  };

  return (
    <div style={{ maxWidth: "600px", margin: "50px auto", padding: "20px" }}>
      <h2 style={{ fontFamily: "system-ui, sans-serif" }}>
        Laminar Test Playground
      </h2>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ flex: 1, padding: "10px", fontSize: "16px" }}
          disabled={isGenerating}
        />
        <button
          onClick={handleSend}
          disabled={isGenerating}
          style={{ padding: "10px 20px", cursor: "pointer" }}
        >
          {isGenerating ? "Generating..." : "Send"}
        </button>
      </div>

      <div
        style={{
          border: "1px solid #ccc",
          padding: "20px",
          borderRadius: "8px",
          minHeight: "100px",
          backgroundColor: "#f9f9f9",
        }}
      >
        {submittedPrompt ? (
          <StreamText
            key={submittedPrompt} // important to pass the key prop as it tells React to destroy and recreate the component (resetting its state) ONLY when the prompt changes.
            fetcher={() => mockSSEFetch(submittedPrompt)}
            onFinish={() => setIsGenerating(false)}
            extractText={(json) => {
              return json.text;
            }}
          />
        ) : (
          <p
            style={{
              color: "#888",
              fontFamily: "system-ui, sans-serif",
              margin: 0,
            }}
          >
            Awaiting input...
          </p>
        )}
      </div>
    </div>
  );
}
