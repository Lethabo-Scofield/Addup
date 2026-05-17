import { Resend } from "resend";
import type { Logger } from "pino";

const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL || "Addup <onboarding@resend.dev>";

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) {
    cachedClient = new Resend(apiKey);
  }
  return cachedClient;
}

export interface WaitlistEmailParams {
  email: string;
  company: string | null;
  role: string | null;
}

export async function sendWaitlistConfirmationEmail(
  params: WaitlistEmailParams,
  logger: Logger,
): Promise<void> {
  const client = getClient();
  if (!client) {
    logger.warn(
      { email: params.email },
      "RESEND_API_KEY is not set — skipping waitlist confirmation email",
    );
    return;
  }

  try {
    const { error } = await client.emails.send({
      from: FROM_ADDRESS,
      to: params.email,
      subject: "You're on the Addup waitlist",
      html: buildHtml(params),
      text: buildText(params),
    });

    if (error) {
      logger.error(
        { err: error, email: params.email },
        "Resend returned an error sending waitlist email",
      );
      return;
    }

    logger.info({ email: params.email }, "Waitlist confirmation email sent");
  } catch (err) {
    logger.error(
      { err, email: params.email },
      "Failed to send waitlist confirmation email",
    );
  }
}

function buildText({ email, company, role }: WaitlistEmailParams): string {
  const lines = [
    "You're on the Addup waitlist.",
    "",
    "Thanks for signing up. We're building a financial data reliability layer that helps finance teams close their books in minutes, not days.",
    "",
    "We'll reach out as early access opens up.",
    "",
    "Here's what we have on file:",
    `  Email: ${email}`,
  ];
  if (company) lines.push(`  Company: ${company}`);
  if (role) lines.push(`  Role: ${role}`);
  lines.push("", "— The Addup team", "Olyxee");
  return lines.join("\n");
}

function buildHtml({ email, company, role }: WaitlistEmailParams): string {
  const detailRows = [`<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Email</td><td style="padding:6px 0;font-size:13px;color:#111827;">${escapeHtml(email)}</td></tr>`];
  if (company) {
    detailRows.push(
      `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Company</td><td style="padding:6px 0;font-size:13px;color:#111827;">${escapeHtml(company)}</td></tr>`,
    );
  }
  if (role) {
    detailRows.push(
      `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Role</td><td style="padding:6px 0;font-size:13px;color:#111827;">${escapeHtml(role)}</td></tr>`,
    );
  }

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;max-width:560px;">
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <div style="font-size:18px;font-weight:700;color:#111827;letter-spacing:-0.01em;">Addup</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 0 40px;">
                <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.25;color:#111827;font-weight:700;letter-spacing:-0.02em;">You're on the list.</h1>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#374151;">
                  Thanks for signing up. We're building a financial data reliability layer that helps finance teams close their books in minutes, not days.
                </p>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#374151;">
                  We'll reach out as early access opens up. Keep an eye on your inbox.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 24px 40px;">
                <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;background:#fafafa;">
                  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:8px;">On file</div>
                  <table cellpadding="0" cellspacing="0" style="width:100%;">${detailRows.join("")}</table>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 32px 40px;border-top:1px solid #f3f4f6;">
                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                  Olyxee — Research and Infrastructure for Artificial Intelligence
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
