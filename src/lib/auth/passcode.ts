// Server-only: sign-in with the shared demo passcode (DEMO_PASSCODE). A correct passcode signs the
// visitor in as one shared demo account, so everyone who knows it sees the same catalog.
import { passcodeMatches } from "../ai/unlock";

/** The one account every passcode sign-in uses. It is never emailed. */
export const DEMO_USER_EMAIL = "demo@dawakraft.app";

export type PasscodeResult = "ok" | "wrong_passcode" | "not_configured";

/** Pure decision: `secret` is the configured passcode (or null when the feature is off). */
export function checkPasscodeAttempt(secret: string | null, attempt: string): PasscodeResult {
  if (!secret) return "not_configured";
  return passcodeMatches(secret, attempt) ? "ok" : "wrong_passcode";
}
