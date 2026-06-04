import type { StreamToken } from "../types";

export async function* createStreamAdapter(
  response: Response,

  extractText: (json: any) => string | undefined = (json) => json.text, // Defaults to assuming the backend just sends { text: "..." }
): AsyncGenerator<StreamToken> {
  if (!response.body) {
    yield { type: "error", content: "No response body found." };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  // This buffer holds incomplete chunks until a double newline is found (\n\n)
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        yield { type: "done", content: "" };
        break;
      }

      // Decoding the new bytes and adding them to the buffer.
      buffer += decoder.decode(value, { stream: true });

      // Look for the SSE boundary; will be -1 if its not a full event yet
      let boundary = buffer.indexOf("\n\n");

      while (boundary !== -1) {
        const eventStr = buffer.slice(0, boundary).trim();

        buffer = buffer.slice(boundary + 2);

        // Process the event if it's an SSE data payload
        if (eventStr.startsWith("data: ")) {
          const dataPayload = eventStr.slice(6); // Removing 'data: '

          if (dataPayload === "[DONE]") {
            yield { type: "done", content: "" };
            return; 
          }

          try {
            // Because we waited for \n\n, this JSON is guaranteed to be complete
            const parsed = JSON.parse(dataPayload);
            const text = extractText(parsed);

            if (text) {
              yield { type: "text", content: text };
            }
          } catch (e) {
            console.warn("Laminar: Failed to parse SSE JSON", dataPayload);
            // not yeilding an error here because .
          }
        }

        // Check if there's another event waiting in the remaining buffer
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
