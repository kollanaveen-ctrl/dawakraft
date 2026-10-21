// Are the Supabase and Claude keys filled in for real, or still the placeholders from .env.example?
// Without real Supabase keys the app runs in demo mode: everything is saved in this browser only.

/** True when a setting holds a real value, not empty and not a "your-…" placeholder. */
export function isRealValue(v: string | undefined): v is string {
  if (!v) return false;
  const s = v.trim();
  return s.length > 0 && !/your-|your_|example|placeholder|xxxx/i.test(s);
}

// NEXT_PUBLIC_ values are copied into the browser code at build time, so this works on both sides.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = isRealValue(SUPABASE_URL) && isRealValue(SUPABASE_KEY);
export const demoMode = !supabaseConfigured;

export function supabaseSettings(): { url: string; key: string } | null {
  return supabaseConfigured ? { url: SUPABASE_URL!.trim(), key: SUPABASE_KEY!.trim() } : null;
}

/** Server only: is the Claude key filled in? */
export function claudeConfigured(): boolean {
  return isRealValue(process.env.ANTHROPIC_API_KEY);
}

/** In demo mode there is no sign-in, so AI is only allowed on your own computer, never on a public site. */
export function demoAiAllowed(): boolean {
  return demoMode && process.env.NODE_ENV !== "production";
}
