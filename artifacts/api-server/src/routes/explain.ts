import { Router } from "express";
import { openrouter } from "@workspace/integrations-openrouter-ai";

const router = Router();

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

router.post("/explain", async (req, res) => {
  const { context, question } = req.body as { context?: string; question?: string };

  if (!question) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const userMessage = context
    ? `Context about this reconciliation item:\n${context}\n\nQuestion: ${question}`
    : question;

  try {
    const stream = await openrouter.chat.completions.create({
      model: GROK_MODEL,
      max_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "Failed to get explanation. Please try again." })}\n\n`);
    res.end();
  }
});

export default router;
