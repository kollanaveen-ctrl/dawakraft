// Server-only: who is signed in, from the dk_session cookie. One D1 query (session joined with user).
import { cookies } from "next/headers";
import { cloudflareReady } from "../config";
import { d1 } from "../cloudflare/d1";
import { sessionUser, type SessionUser } from "../db/auth";
import { SESSION_COOKIE, hashSessionToken, isWellFormedToken } from "./session-token";

export type { SessionUser };

/** The signed-in user, or null (signed out, expired, or real mode not configured). Throws if D1 is unreachable. */
export async function getSession(): Promise<SessionUser | null> {
  if (!cloudflareReady()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isWellFormedToken(token)) return null;
  return sessionUser(d1(), hashSessionToken(token), new Date().toISOString());
}
