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
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " KST";
}

export default async function AuditPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?redirect=/admin/audit");
  if (me.role !== "admin") {
    return (
      <div className="rounded-lg border border-border bg-panel p-5 text-sm text-muted">
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">Audit log</h1>
        <p className="mt-1 text-xs text-muted">
          Last 100 write actions. Useful for debugging and spotting weird activity.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full text-xs">
          <thead className="text-muted">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">When</th>
              <th className="px-3 py-2 text-left font-medium">Who</th>
              <th className="px-3 py-2 text-left font-medium">Action</th>
              <th className="px-3 py-2 text-left font-medium">Target</th>
              <th className="px-3 py-2 text-left font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/50 align-top">
                <td className="whitespace-nowrap px-3 py-2 text-muted">{fmt(r.created_at)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-text">{r.actor_email ?? "\u2014"}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className={`rounded border px-2 py-0.5 ${
                    r.ok ? "border-good/40 text-good" : "border-bad/40 text-bad"
                  }`}>
                    {r.action}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted">
                  {r.target_type ? `${r.target_type}: ` : ""}
                  <span className="font-mono">{r.target_id ?? "\u2014"}</span>
                </td>
                <td className="px-3 py-2 text-muted">
                  <pre className="whitespace-pre-wrap text-[11px]">
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
                <td colSpan={5} className="px-3 py-4 text-center text-muted">
                  No activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
