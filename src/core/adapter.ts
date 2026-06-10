import type { StreamToken } from "../types";

export async function* createStreamAdapter(
  response: Response,
  //currently defaulting to OpenAI's streaming format, which nests the text content in choices[0].delta.content
  //TODO: make this more flexible to support a wider variety of streaming formats without needing a custom adapter function for each one
  extractText: (json: any) => string | undefined = (json) =>
    json.choices?.[0]?.delta?.content,
): AsyncGenerator<StreamToken> {
  if (!response.body) {
    yield { type: "error", content: "No response body found." };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        yield { type: "done", content: "" };
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      // console.log("Current buffer split into lines:", { lines });

      // Saving the last incomplete line back to the buffer
      buffer = lines.pop() || "";
      // console.log("Current buffer after splitting into lines:", { buffer });

      for (const line of lines) {
        const cleanedLine = line.trim();
        if (!cleanedLine) continue;

        if (cleanedLine.startsWith("data: ")) {
          const dataPayload = cleanedLine.slice(6).trim();

          if (dataPayload === "[DONE]") {
            yield { type: "done", content: "" };
            return;
          }

          try {
            const parsed = JSON.parse(dataPayload);
            const text = extractText(parsed);
            if (typeof text === "string" && text.length > 0) {
              yield { type: "text", content: text };
            }
          } catch (e) {
            // warn if the payload isn't valid JSON at all.
            console.warn("Laminar: Failed to parse SSE JSON", dataPayload);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
