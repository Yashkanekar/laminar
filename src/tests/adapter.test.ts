import { createStreamAdapter } from "../core/adapter.ts";

function createMockResponse() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      controller.enqueue(encoder.encode("Hello"));
      controller.enqueue(encoder.encode(" world"));
      controller.enqueue(encoder.encode(" from Laminar!"));

      controller.close();
    },
  });

  return new Response(stream);
}

async function runTest() {
  console.log("Starting Laminar stream test...");

  const mockRes = createMockResponse();
  const adapter = createStreamAdapter(mockRes);

  for await (const token of adapter) {
    console.log(token);
  }
}

runTest();
