import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client, holding the service-role key.
 *
 * This app reads and writes the same `rsvps` table as wedding-invite (RLS is
 * on there with no policies for the anon key), so it points at that same
 * Supabase project and needs the same service-role key — set both in
 * .env.local, never in a client component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (same project as wedding-invite)",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
