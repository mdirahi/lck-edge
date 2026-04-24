import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = createServerClient();
  const { data: player } = await sb.from("players").select("*").eq("id", id).single();
  if (!player) return notFound();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{player.ign}</h1>
        <p className="mt-1.5 text-xs text-muted">
          <span className="font-semibold uppercase tracking-wider">{player.role}</span>
          {player.real_name ? ` \u00b7 ${player.real_name}` : ""}
        </p>
      </div>
      <div className="card text-xs italic text-muted">
        Per-player stats populate once you import Oracle&rsquo;s Elixir CSVs into{" "}
        <code className="font-mono not-italic text-text">player_game_stats</code>.
      </div>
    </div>
  );
}
