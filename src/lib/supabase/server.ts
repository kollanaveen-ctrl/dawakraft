import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseConfigured, supabaseSettings } from "../config";

export function supabaseEnv(): { url: string; key: string } {
  const settings = supabaseSettings();
  if (!settings) throw new Error("Set real NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY values in .env.local");
  return settings;
}

/** Supabase client for route handlers, reading the login session from cookies. */
export async function supabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a context that can't set cookies; the proxy refreshes them instead.
        }
      },
    },
  });
}

/** The signed-in user (verified with Supabase) and a client acting as them, or null. */
export async function signedIn(): Promise<{ user: User; supabase: SupabaseClient } | null> {
  if (!supabaseConfigured) return null;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? null : { user: data.user, supabase };
}
