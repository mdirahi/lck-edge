"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export interface InviteUserResult {
  ok: boolean;
  error: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Admin-only: add an email to app_invites with a role. When they first sign
 * in, a DB trigger materializes their app_users row with the invited role.
 * If they're already signed up, also update their app_users row so the role
 * change takes effect immediately.
 */
export async function inviteUserAction(input: {
  email: string;
  role: "admin" | "viewer";
}): Promise<InviteUserResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (me.role !== "admin") return { ok: false, error: "Admin role required" };

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Invalid email" };
  if (input.role !== "admin" && input.role !== "viewer") {
    return { ok: false, error: "Role must be admin or viewer" };
  }

  const sb = createServerClient();

  const { error: invErr } = await sb
    .from("app_invites")
    .upsert(
      { email, role: input.role, invited_by: me.id },
      { onConflict: "email" }
    );
  if (invErr) return { ok: false, error: invErr.message };

  // If they've already signed up, bump their active role too.
  await sb.from("app_users").update({ role: input.role }).eq("email", email);

  await logAction({
    actor: me,
    action: "inviteUser",
    targetType: "email",
    targetId: email,
    metadata: { role: input.role },
  });

  revalidatePath("/admin/users");
  return { ok: true, error: "" };
}

export async function removeUserAction(input: {
  email?: string;
  userId?: string;
}): Promise<InviteUserResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (me.role !== "admin") return { ok: false, error: "Admin role required" };
  if (input.userId && input.userId === me.id) {
    return { ok: false, error: "You can't remove yourself" };
  }

  const sb = createServerClient();

  if (input.userId) {
    const { data: u } = await sb
      .from("app_users")
      .select("email")
      .eq("id", input.userId)
      .maybeSingle();
    const email = u?.email ?? null;
    const { error } = await sb.from("app_users").delete().eq("id", input.userId);
    if (error) return { ok: false, error: error.message };
    if (email) {
      await sb.from("app_invites").delete().eq("email", email);
    }
  } else if (input.email) {
    await sb.from("app_invites").delete().eq("email", input.email);
    await sb.from("app_users").delete().eq("email", input.email);
  } else {
    return { ok: false, error: "email or userId required" };
  }

  await logAction({
    actor: me,
    action: "removeUser",
    targetType: input.userId ? "userId" : "email",
    targetId: input.userId ?? input.email ?? undefined,
  });

  revalidatePath("/admin/users");
  return { ok: true, error: "" };
}
