// Server-only: send the sign-in code by email through Resend's REST API (resend.com/docs/api-reference/emails/send-email).
// Without a real RESEND_API_KEY on your own computer, the code is printed to the server console instead.
import { isRealValue } from "../config";

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Dawakraft <onboarding@resend.dev>";
const TIMEOUT_MS = 10_000;

type Env = Record<string, string | undefined>;
export type SendResult = "sent" | "logged" | "failed";

export function codeEmail(code: string): { subject: string; text: string; html: string } {
  const subject = `${code} is your Dawakraft sign-in code`;
  const text = `Your Dawakraft sign-in code is ${code}.\n\nIt works for 10 minutes. If you didn't ask for it, you can ignore this email.`;
  const html =
    `<p>Your Dawakraft sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>` +
    `<p>It works for 10 minutes. If you didn't ask for it, you can ignore this email.</p>`;
  return { subject, text, html };
}

export async function sendCodeEmail(to: string, code: string, env: Env = process.env, doFetch: typeof fetch = fetch): Promise<SendResult> {
  const key = env.RESEND_API_KEY;
  if (!isRealValue(key)) {
    if (env.NODE_ENV === "production") return "failed";
    // Development only: there is no email service, so show the code to whoever runs the server.
    console.info(`[auth] Dev sign-in code for ${to}: ${code} (set RESEND_API_KEY to send real email)`);
    return "logged";
  }
  const from = isRealValue(env.AUTH_EMAIL_FROM) ? env.AUTH_EMAIL_FROM.trim() : DEFAULT_FROM;
  try {
    const res = await doFetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], ...codeEmail(code) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return "sent";
    // Status only in production: Resend's error text can echo the recipient address. On your own
    // computer the reason is shown too, so a setup problem (wrong sender, unverified domain) is clear.
    const reason = env.NODE_ENV === "production" ? "" : `: ${(await res.text().catch(() => "")).slice(0, 300)}`;
    console.error(`[auth] Resend refused the email (HTTP ${res.status})${reason}`);
    return "failed";
  } catch {
    console.error("[auth] Resend could not be reached");
    return "failed";
  }
}
