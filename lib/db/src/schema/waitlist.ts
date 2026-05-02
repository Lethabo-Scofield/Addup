import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

export const waitlistTable = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    company: text("company"),
    role: text("role"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailIdx: index("waitlist_email_idx").on(table.email),
  }),
);

export type WaitlistRow = typeof waitlistTable.$inferSelect;
