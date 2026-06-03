export async function mockSSEFetch(prompt: string): Promise<Response> {
  const aiResponse = `Hello! You said: "${prompt}". This is Laminar streaming perfectly smoothly via requestAnimationFrame. Notice how there is no jank, even though I am sending data in tiny, fragmented chunks!`;

  const chunks = aiResponse.split(" ");

  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        // Simulating random network delay between 30ms and 80ms
        await new Promise((resolve) =>
          setTimeout(resolve, 30 + Math.random() * 80),
        );

        // Format as an OpenAI-style SSE event
        const eventStr = `data: ${JSON.stringify({ text: chunk + " " })}\n\n`;
        controller.enqueue(new TextEncoder().encode(eventStr));
      }

      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
