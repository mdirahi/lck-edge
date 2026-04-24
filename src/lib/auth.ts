// Auth helpers. Resolve the current user from Supabase cookies and look up
// their role in app_users. Used by server components and server actions.
import "server-only";
import { createAuthServerClient, createServerClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "viewer";

export interface AppUser {
  id: string;
  email: string;
  role: AppRole;
}

/** Returns the logged-in app user, or null if unauthenticated / not invited. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const sb = await createAuthServerClient();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;

  // Service-role client so RLS doesn't hide the row from ourselves.
  const admin = createServerClient();
  const { data: row } = await admin
    .from("app_users")
    .select("id, email, role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!row) return null;
  return { id: row.id, email: row.email, role: row.role as AppRole };
}

/** True if the caller is an invited admin. */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

/** Throws if the caller isn't an admin. Use at the top of write actions. */
export async function requireAdmin(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  if (user.role !== "admin") throw new Error("Admin role required");
  return user;
}
