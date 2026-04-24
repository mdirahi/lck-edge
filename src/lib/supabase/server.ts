// Server Supabase clients.
//
// Two flavors:
// 1. createServerClient() -> service-role client. Bypasses RLS. Use in server
//    actions for writes and for reading data that doesn't belong to a user.
//    NEVER import this into a client component.
// 2. createAuthServerClient() -> user-scoped client driven by Supabase cookies
//    (from @supabase/ssr). Use this to read the current session / user in
//    Server Components, Route Handlers, and middleware.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient as createSSRServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // Fall back to the anon key when deploying without a service key set;
    // everything in this MVP works with public-read policies.
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

/**
 * Cookie-aware Supabase client that resolves the currently logged-in user.
 * Safe in Server Components, Route Handlers, and Server Actions.
 */
export async function createAuthServerClient() {
  const store = await cookies();
  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              store.set(name, value, options);
            }
          } catch {
            // `cookies()` is read-only in Server Components. That's fine —
            // middleware handles refresh rotation; this just means we can't
            // mutate cookies from a rendering path, which we don't need to.
          }
        },
      },
    }
  );
}
