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

function createMockSSEResponse() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      controller.enqueue(encoder.encode('data: {"text": "Hello"'));

      controller.enqueue(encoder.encode('}\n\ndata: {"text": " world"}\n\n'));

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));

      controller.close();
    },
  });

  return new Response(stream);
}

async function runSSETest() {
  console.log("Starting Laminar SSE test...");
  const mockRes = createMockSSEResponse();

  const adapter = createStreamAdapter(mockRes);

  for await (const token of adapter) {
    console.log(token);
  }
}

// runSSETest();

// runTest();
