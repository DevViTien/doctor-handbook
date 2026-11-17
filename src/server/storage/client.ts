import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/config/env";

let supabase: SupabaseClient | undefined;

/**
 * Supabase is used for Storage only (no Supabase Auth, no browser-side DB access).
 * The service-role key bypasses storage policies, so every caller must have checked
 * ownership through the DAL before touching an object.
 */
export function getStorage() {
  if (!supabase) {
    const env = getServerEnv();
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase.storage;
}
