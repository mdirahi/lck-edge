import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = createServerClient();
  const { data: team } = await sb.from("teams").select("*").eq("id", id).single();
  if (!team) return notFound();
  const { data: players } = await sb
    .from("players").select("*").eq("team_id", id).eq("is_active", true);

  const roster = players ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {team.name}{" "}
          <span className="text-lg font-medium text-muted">({team.tag})</span>
        </h1>
      </div>

      <div className="card">
        <h2 className="section-eyebrow">Roster</h2>
        {roster.length === 0 ? (
          <p className="mt-3 text-xs italic text-muted">No active roster on file yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[color:var(--border-soft)] text-sm">
            {roster.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-3">
                  <span className="inline-block w-12 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {p.role}
                  </span>
                  <span className="font-medium text-text">{p.ign}</span>
                </span>
                <span className="text-xs text-muted">{p.real_name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs italic text-muted">
        Team-level stats (recent form, side winrates) will populate once you import Oracle&rsquo;s Elixir CSVs.
      </p>
    </div>
  );
}
