import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { InviteUserForm } from "./InviteUserForm";
import { UserRow } from "./UserRow";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?redirect=/admin/users");
  if (me.role !== "admin") {
    return (
      <div className="card text-sm text-muted">
        Admin access required.
      </div>
    );
  }

  const sb = createServerClient();
  const [{ data: users }, { data: invites }] = await Promise.all([
    sb.from("app_users").select("id, email, role, created_at").order("created_at", { ascending: true }),
    sb.from("app_invites").select("email, role, created_at").order("created_at", { ascending: true }),
  ]);

  const activeEmails = new Set((users ?? []).map((u) => (u.email as string).toLowerCase()));
  const pendingInvites = (invites ?? []).filter(
    (i) => !activeEmails.has((i.email as string).toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1.5 text-xs text-muted">
          Invite people by email. They can sign in via magic link once invited.
        </p>
      </div>

      <div className="card">
        <h2 className="section-eyebrow">Invite</h2>
        <div className="mt-4">
          <InviteUserForm />
        </div>
      </div>

      <div className="card">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="section-eyebrow">Active users</h2>
          <span className="text-[11px] tabular-nums text-muted">{users?.length ?? 0}</span>
        </div>
        <div className="mt-3 divide-y divide-[color:var(--border-soft)]">
          {(users ?? []).map((u) => (
            <UserRow
              key={u.id}
              mode="active"
              user={{ id: u.id, email: u.email, role: u.role as any }}
              meId={me.id}
            />
          ))}
          {(users ?? []).length === 0 && (
            <div className="py-3 text-xs italic text-muted">No one has signed in yet.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="section-eyebrow">Pending invites</h2>
          <span className="text-[11px] tabular-nums text-muted">{pendingInvites.length}</span>
        </div>
        <div className="mt-3 divide-y divide-[color:var(--border-soft)]">
          {pendingInvites.map((inv) => (
            <UserRow
              key={inv.email}
              mode="pending"
              user={{ id: null, email: inv.email, role: inv.role as any }}
              meId={me.id}
            />
          ))}
          {pendingInvites.length === 0 && (
            <div className="py-3 text-xs italic text-muted">No pending invites.</div>
          )}
        </div>
      </div>
    </div>
  );
}
