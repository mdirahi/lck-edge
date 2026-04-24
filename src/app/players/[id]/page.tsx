import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = createServerClient();
  const { data: player } = await sb.from("players").select("*").eq("id", id).single();
  if (!player) return notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{player.ign}</h1>
      <p className="text-sm text-muted">{player.role} {player.real_name ? ` \u00b7 ${player.real_name}` : ""}</p>
      <p className="text-xs text-muted">
        Per-player stats populate once you import Oracle&rsquo;s Elixir CSVs into player_game_stats.
      </p>
    </div>
  );
}
