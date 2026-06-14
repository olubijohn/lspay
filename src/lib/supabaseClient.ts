import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase browser client.
 *
 * This is scaffolding to help you migrate LSPay from the in-memory store
 * (`src/store.tsx`) to a real Supabase PostgreSQL backend. See the setup
 * guide (LSPay-Supabase-Setup-Guide.docx) and `supabase/schema.sql` for the
 * full schema and step-by-step wiring instructions.
 *
 * The values are read from Vite env vars (see `.env.example`):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let client: SupabaseClient | null = null;

/**
 * Returns the shared Supabase client, or throws if the env vars are missing.
 * Guarded so the app can still run on the in-memory store until you wire
 * Supabase in.
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.",
    );
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}
