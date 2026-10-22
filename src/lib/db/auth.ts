// Server-only: SQL for sign-in codes, users and sessions. Kept to as few D1 requests as possible
// (the Cloudflare API allows 1200 requests per 5 minutes per token).
import type { D1Client } from "../cloudflare/d1";
import type { StoredCode } from "../auth/codes";

const DAY_MS = 24 * 60 * 60_000;

export type SessionUser = { userId: string; email: string };

/** Codes sent to this email, and from this IP, since `sinceIso` (one request). */
export async function recentCodeCounts(db: D1Client, email: string, ip: string, sinceIso: string): Promise<{ byEmail: number; byIp: number }> {
  const [row] = await db.query<{ by_email: number; by_ip: number }>(
    "SELECT (SELECT COUNT(*) FROM login_codes WHERE email = ? AND created_at >= ?) AS by_email, " +
      "(SELECT COUNT(*) FROM login_codes WHERE ip = ? AND created_at >= ?) AS by_ip",
    [email, sinceIso, ip, sinceIso],
  );
  return { byEmail: Number(row?.by_email ?? 0), byIp: Number(row?.by_ip ?? 0) };
}

/** Store a new code (hash only) and clear this address's codes older than a day (one request). */
export async function insertCode(db: D1Client, c: { id: string; email: string; codeHash: string; ip: string; expiresAt: string; now: Date }): Promise<void> {
  await db.batch([
    { sql: "DELETE FROM login_codes WHERE email = ? AND created_at < ?", params: [c.email, new Date(c.now.getTime() - DAY_MS).toISOString()] },
    {
      sql: "INSERT INTO login_codes (id, email, code_hash, ip, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      params: [c.id, c.email, c.codeHash, c.ip, c.expiresAt, c.now.toISOString()],
    },
  ]);
}

/** The newest unused, unexpired code for this address, or null. */
export async function latestCode(db: D1Client, email: string, nowIso: string): Promise<(StoredCode & { id: string }) | null> {
  const [row] = await db.query<StoredCode & { id: string }>(
    "SELECT id, code_hash, attempts, expires_at, used_at FROM login_codes WHERE email = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
    [email, nowIso],
  );
  return row ?? null;
}

export async function countWrongAttempt(db: D1Client, id: string): Promise<void> {
  await db.run("UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?", [id]);
}

/** Mark the code used. False when another request already used it (so a code works only once). */
export async function consumeCode(db: D1Client, id: string, nowIso: string): Promise<boolean> {
  const rows = await db.query<{ id: string }>("UPDATE login_codes SET used_at = ? WHERE id = ? AND used_at IS NULL RETURNING id", [nowIso, id]);
  return rows.length === 1;
}

/** Find or create the user, start a session and drop their expired ones (one request). */
export async function signInUser(
  db: D1Client,
  s: { newUserId: string; email: string; tokenHash: string; expiresAt: string; now: Date },
): Promise<SessionUser | null> {
  const nowIso = s.now.toISOString();
  const results = await db.batch<{ id: string; email: string }>([
    { sql: "INSERT INTO users (id, email, created_at) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING", params: [s.newUserId, s.email, nowIso] },
    {
      sql: "DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ?) AND expires_at <= ?",
      params: [s.email, nowIso],
    },
    {
      sql: "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) SELECT ?, id, ?, ? FROM users WHERE email = ?",
      params: [s.tokenHash, s.expiresAt, nowIso, s.email],
    },
    { sql: "SELECT id, email FROM users WHERE email = ?", params: [s.email] },
  ]);
  const user = results[3]?.[0];
  return user ? { userId: user.id, email: user.email } : null;
}

/** The signed-in user for a session token hash, joined in one query; expired sessions don't count. */
export async function sessionUser(db: D1Client, tokenHash: string, nowIso: string): Promise<SessionUser | null> {
  const [row] = await db.query<{ id: string; email: string }>(
    "SELECT u.id AS id, u.email AS email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
    [tokenHash, nowIso],
  );
  return row ? { userId: row.id, email: row.email } : null;
}

export async function deleteSession(db: D1Client, tokenHash: string): Promise<void> {
  await db.run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
}
