// Limits on AI calls per user, so one account can't run up the Claude bill.
import type { SupabaseClient } from "@supabase/supabase-js";

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

export type AiKind = "read" | "sort";

/**
 * The real limit, shared by every server instance. It records this call first and then counts,
 * so many requests sent at the same moment can't all slip under the limit (each one sees the
 * others' rows). Returns false when the user is over the limit.
 */
export async function claimAiUse(supabase: SupabaseClient, kind: AiKind, limit: number, windowMs: number): Promise<boolean> {
  const { error: insertError } = await supabase.from("ai_usage").insert({ kind });
  if (insertError) throw insertError;
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .gte("created_at", since);
  if (error) throw error;
  return (count ?? 0) <= limit;
}
