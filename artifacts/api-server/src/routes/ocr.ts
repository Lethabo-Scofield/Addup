import { Router } from "express";
import { openrouter } from "@workspace/integrations-openrouter-ai";

const router = Router();

// Gemini Flash is fast, cheap, and very good at structured OCR from
// document-style images (bank statements, ledgers). It supports the
// OpenAI-compatible vision-message format via OpenRouter.
const OCR_MODEL = "google/gemini-2.0-flash-001";

type Kind = "bank" | "ledger";

const BANK_SCHEMA =
  `{ "date": "YYYY-MM-DD", "description": "string", ` +
  `"debit": "amount or empty string", "credit": "amount or empty string", ` +
  `"balance": "amount or empty string", "reference": "string" }`;

const LEDGER_SCHEMA =
  `{ "date": "YYYY-MM-DD", "account": "string", "description": "string", ` +
  `"debit": "amount or empty string", "credit": "amount or empty string", ` +
  `"reference": "string" }`;

function buildPrompt(kind: Kind): string {
  const schema = kind === "bank" ? BANK_SCHEMA : LEDGER_SCHEMA;
  return [
    `You are an OCR + table-extraction engine for a ${kind} statement image.`,
    ``,
    `Extract EVERY transaction row from the image. Return STRICT JSON in this exact shape:`,
    `{"rows":[ ${schema}, ... ]}`,
    ``,
    `Rules:`,
    `- Output JSON only. No markdown fences, no commentary, no preamble.`,
    `- Use empty string "" for any missing field — never null, never omit keys.`,
    `- Normalise all dates to ISO YYYY-MM-DD.`,
    `- Numeric amounts: digits and a decimal point only (e.g. "1234.56"). Drop currency symbols, commas, and spaces.`,
    `- Put money-out / debits in "debit" and money-in / credits in "credit". Never put a negative sign in either field — use whichever column matches.`,
    `- Skip header rows, totals, sub-totals, and opening/closing balance lines.`,
    `- If a column is not present in the image, leave that field as "" for every row.`,
    kind === "ledger"
      ? `- The "account" field is the ledger account name for that line (e.g. "Bank", "Bank Charges Expense", "Sales Revenue").`
      : `- The "reference" field is the transaction reference / cheque number / payment ID if visible, else "".`,
  ].join("\n");
}

function extractJson(text: string): unknown {
  // Strip ```json fences if the model adds them despite instructions.
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/g, "")
    .trim();
  // Find the outermost { ... } block.
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return JSON");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

router.post("/ocr", async (req, res) => {
  const { image, kind } = req.body as { image?: string; kind?: Kind };

  if (!image || typeof image !== "string") {
    res.status(400).json({ error: "image (base64 data URL) is required" });
    return;
  }
  if (kind !== "bank" && kind !== "ledger") {
    res.status(400).json({ error: "kind must be 'bank' or 'ledger'" });
    return;
  }
  if (!image.startsWith("data:image/")) {
    res.status(400).json({ error: "image must be a data:image/* URL" });
    return;
  }

  try {
    const completion = await openrouter.chat.completions.create({
      model: OCR_MODEL,
      max_tokens: 8192,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt(kind) },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    if (!text.trim()) {
      res.status(502).json({ error: "OCR model returned an empty response." });
      return;
    }

    let parsed: unknown;
    try {
      parsed = extractJson(typeof text === "string" ? text : String(text));
    } catch (err) {
      res.status(502).json({ error: "Could not parse OCR output as JSON." });
      return;
    }

    const rows = (parsed as { rows?: unknown }).rows;
    if (!Array.isArray(rows)) {
      res.status(502).json({ error: "OCR output did not contain a rows array." });
      return;
    }

    // Coerce every value to string so downstream csvToTx works unchanged.
    const safeRows: Record<string, string>[] = rows
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map(r => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(r)) {
          out[String(k).trim().toLowerCase()] =
            v == null ? "" : String(v).trim();
        }
        return out;
      });

    res.json({ rows: safeRows, model: OCR_MODEL });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `OCR failed: ${message}` });
  }
});

export default router;
