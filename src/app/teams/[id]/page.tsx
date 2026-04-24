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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{team.name} <span className="text-muted text-lg">({team.tag})</span></h1>
      <div className="rounded-lg border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Roster</h2>
        <ul className="mt-2 divide-y divide-border text-sm">
          {(players ?? []).map((p) => (
            <li key={p.id} className="flex justify-between py-2">
              <span><span className="inline-block w-10 text-muted text-xs">{p.role}</span>{p.ign}</span>
              <span className="text-xs text-muted">{p.real_name}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted">Team-level stats (recent form, side winrates) will populate once you import Oracle&rsquo;s Elixir CSVs.</p>
    </div>
  );
}
