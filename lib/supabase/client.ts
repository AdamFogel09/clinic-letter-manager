import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client — safe to use in "use client" components.
// Uses the publishable anon key only; never exposes service-role secrets.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
