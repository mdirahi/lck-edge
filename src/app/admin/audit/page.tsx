import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Row {
  id: number;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ok: boolean;
  error_msg: string | null;
  created_at: string;
}

function fmt(iso: string) {
  // America/New_York auto-handles EST vs EDT; label as "ET" year-round.
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }) + " ET";
}

export default async function AuditPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?redirect=/admin/audit");
  if (me.role !== "admin") {
    return (
      <div className="card text-sm text-muted">
        Admin access required.
      </div>
    );
  }

  const sb = createServerClient();
  const { data } = await sb
    .from("audit_log")
    .select("id, actor_email, action, target_type, target_id, metadata, ok, error_msg, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1.5 text-xs text-muted">
          Last 100 write actions. Useful for debugging and spotting weird activity.
        </p>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[color:var(--border-soft)] text-muted">
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">When</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Who</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Action</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Target</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[color:var(--border-soft)]/60 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted" suppressHydrationWarning>{fmt(r.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-text">{r.actor_email ?? "\u2014"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className={r.ok ? "badge-good" : "badge-bad"}>
                      {r.action}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {r.target_type ? `${r.target_type}: ` : ""}
                    <span className="font-mono text-[11px]">{r.target_id ?? "\u2014"}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                      {Object.keys(r.metadata ?? {}).length > 0
                        ? JSON.stringify(r.metadata, null, 2)
                        : "\u2014"}
                    </pre>
                    {r.error_msg && <div className="mt-1 text-bad">{r.error_msg}</div>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center italic text-muted">
                    No activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
