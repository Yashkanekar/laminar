import type { StreamToken } from "../types";

export async function* createStreamAdapter(
  response: Response,
): AsyncGenerator<StreamToken> {
  if (!response.body) {
    yield { type: "error", content: "No response body found." };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  try {
    while (true) {
      //Read the raw bytes from the network
      const { done, value } = await reader.read();

      if (done) {
        yield { type: "done", content: "" };
        break;
      }

      // Decode the bytes into text. The { stream: true } option allows the decoder to handle multi-byte characters that may be split across chunks without corrupting them.
      const chunk = decoder.decode(value, { stream: true });

      if (chunk) {
        yield { type: "text", content: chunk };
      }
    }
  } catch (error) {
    yield {
      type: "error",
      content: error instanceof Error ? error.message : "Unknown stream error",
    };
  } finally {
    reader.releaseLock();
  }
}
