// Limits on AI calls per user, so one account can't run up the AI bill.
import type { D1Client } from "./cloudflare/d1";

type Window = { start: number; count: number };
const windows = new Map<string, Window>();

/** Quick in-memory check for one server instance (stops rapid repeat taps). */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    return true;
  }
  if (w.count >= limit) return false;
  windows.set(key, { start: w.start, count: w.count + 1 });
  return true;
}

/** Matches the ai_usage.kind check (cloudflare/migrations/0001_init.sql). */
export type AiKind = "read" | "sort" | "copy" | "photo";

/**
 * The real limit, shared by every server instance. It records this call first and then counts
 * (both in one D1 request), so many requests sent at the same moment can't all slip under the
 * limit (each one sees the others' rows). Only this owner's rows are counted. Returns false
 * when the user is over the limit.
 */
export async function claimAiUse(db: D1Client, ownerId: string, kind: AiKind, limit: number, windowMs: number, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - windowMs).toISOString();
  const [, counted] = await db.batch<{ n: number }>([
    { sql: "INSERT INTO ai_usage (owner_id, kind, created_at) VALUES (?, ?, ?)", params: [ownerId, kind, now.toISOString()] },
    { sql: "SELECT COUNT(*) AS n FROM ai_usage WHERE owner_id = ? AND kind = ? AND created_at >= ?", params: [ownerId, kind, since] },
  ]);
  return Number(counted?.[0]?.n ?? 0) <= limit;
}
