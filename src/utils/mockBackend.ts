export async function mockSSEFetch(prompt: string): Promise<Response> {
  const aiResponse = `You said: "${prompt}". This is Laminar streaming perfectly smoothly via requestAnimationFrame. Notice how there is no jank, even though I am sending data in tiny, fragmented chunks!`;

  const chunks = aiResponse.split(" ");

  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        // Simulating random network delay between 30ms and 80ms
        await new Promise((resolve) =>
          setTimeout(resolve, 30 + Math.random() * 80),
        );

        // returning a JSON string with a "text" field
        const eventStr = `data: ${JSON.stringify({ text: chunk + " " })}\n\n`;
        controller.enqueue(new TextEncoder().encode(eventStr));
      }

      // controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

export async function askOpenAI(prompt: string): Promise<Response> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_OPEN_AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
        stream: true,
      }),
    });

    return response;
  } catch (error) {
    throw new Error(`OpenAI request failed: ${(error as Error).message}`);
  }
}
