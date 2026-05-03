export const config = { runtime: "edge" };

const GROK_MODEL = "x-ai/grok-3-mini";

const SYSTEM_PROMPT = `You are Addup's reconciliation assistant — a friendly, sharp financial analyst embedded in a reconciliation tool.

Your job is to help users understand their bank-to-ledger reconciliation results in plain, clear English. No jargon unless you explain it. No bullet-point overload — write in short paragraphs like a smart colleague would.

When explaining an issue or match:
- Say what actually happened in plain English
- Say why it matters (or doesn't)
- Give a concrete recommendation for what the user should do next
- Keep it concise — 3-5 short paragraphs max

When asked about the overall reconciliation:
- Summarize what went well and what needs attention
- Prioritize the most significant items
- End with a clear "what to do next" statement

Always be reassuring but honest. If something is a potential problem, say so clearly.`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let question: string | undefined;
  let context: string | undefined;
  try {
    const body = await req.json();
    question = body.question;
    context = body.context;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!question) {
    return new Response(JSON.stringify({ error: "question is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const baseURL =
    process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL ||
    "https://openrouter.ai/api/v1";
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY ||
    process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OpenRouter API key not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const userMessage = context
    ? `Context about this reconciliation item:\n${context}\n\nQuestion: ${question}`
    : question;

  let upstream: Response;
  try {
    upstream = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://addup.app",
        "X-Title": "Addup Reconciliation",
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        max_tokens: 8192,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        stream: true,
      }),
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to reach AI service" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({ error: "AI service returned an error" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  (async () => {
    const reader = upstream.body!.getReader();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              await writer.write(
                enc.encode(`data: ${JSON.stringify({ content })}\n\n`),
              );
            }
          } catch {
          }
        }
      }
      await writer.write(
        enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`),
      );
    } catch {
      try {
        await writer.write(
          enc.encode(
            `data: ${JSON.stringify({ error: "Failed to get explanation. Please try again." })}\n\n`,
          ),
        );
      } catch {
      }
    } finally {
      try { writer.close(); } catch { }
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
