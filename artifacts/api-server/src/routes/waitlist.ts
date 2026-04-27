import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, waitlistTable } from "@workspace/db";
import {
  JoinWaitlistBody,
  GetWaitlistStatsResponse,
} from "@workspace/api-zod";
import { sendWaitlistConfirmationEmail } from "../lib/resend.js";

const router: IRouter = Router();

router.post("/waitlist", async (req, res): Promise<void> => {
  const parsed = JoinWaitlistBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      { issues: parsed.error.issues },
      "Invalid waitlist join request",
    );
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const company = parsed.data.company?.trim() || null;
  const role = parsed.data.role?.trim() || null;

  const existing = await db
    .select({ id: waitlistTable.id })
    .from(waitlistTable)
    .where(sql`lower(${waitlistTable.email}) = ${email}`)
    .limit(1);

  if (existing.length > 0) {
    res
      .status(409)
      .json({ error: "This email is already on the waitlist." });
    return;
  }

  try {
    const [row] = await db
      .insert(waitlistTable)
      .values({ email, company, role })
      .returning();

    if (!row) {
      req.log.error("Insert returned no row");
      res.status(500).json({ error: "Could not save your entry." });
      return;
    }

    res.status(201).json({
      id: row.id,
      email: row.email,
      company: row.company,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
    });

    void sendWaitlistConfirmationEmail(
      { email: row.email, company: row.company, role: row.role },
      req.log,
    );
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "23505") {
      res
        .status(409)
        .json({ error: "This email is already on the waitlist." });
      return;
    }
    req.log.error({ err }, "Failed to add waitlist entry");
    res.status(500).json({ error: "Could not save your entry." });
  }
});

router.get("/waitlist/stats", async (_req, res): Promise<void> => {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(waitlistTable);

  const total = row?.total ?? 0;
  res.json(GetWaitlistStatsResponse.parse({ total }));
});

export default router;
