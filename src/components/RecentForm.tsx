import { createServerClient } from "@/lib/supabase/server";

/**
 * Renders a team's last N completed LCK series as W/L chips plus a winrate summary.
 * Async server component — fetches directly from Supabase.
 */
export async function RecentForm({
  teamId,
  teamTag,
  limit = 6,
}: {
  teamId: string;
  teamTag: string;
  limit?: number;
}) {
  const sb = createServerClient();

  const { data } = await sb
    .from("matches")
    .select(`
      id, start_at, winner_team_id, team_a_id, team_b_id,
      team_a:teams!matches_team_a_id_fkey (id, tag),
      team_b:teams!matches_team_b_id_fkey (id, tag)
    `)
    .eq("status", "completed")
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .order("start_at", { ascending: false })
    .limit(limit);

  const rows = data ?? [];
  const wins = rows.filter((m: any) => m.winner_team_id === teamId).length;
  const losses = rows.length - wins;
  const rate = rows.length > 0 ? wins / rows.length : null;

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="section-eyebrow">Recent form · {teamTag}</h3>
        <div className="text-xs tabular-nums text-muted">
          {rows.length > 0
            ? `${wins}-${losses} · ${rate !== null ? (rate * 100).toFixed(0) : "–"}%`
            : "no data"}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted">
          No completed series on file yet. Matches will appear here once the Leaguepedia importer runs.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((m: any) => {
            const won = m.winner_team_id === teamId;
            const isA = m.team_a_id === teamId;
            const opp = isA ? m.team_b : m.team_a;
            return (
              <li key={m.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${
                      won
                        ? "bg-good/15 text-good ring-1 ring-inset ring-good/30"
                        : "bg-bad/15 text-bad ring-1 ring-inset ring-bad/30"
                    }`}
                  >
                    {won ? "W" : "L"}
                  </span>
                  <span className="text-muted">vs</span>
                  <span className="font-medium text-text">{opp?.tag ?? "???"}</span>
                </span>
                <span className="tabular-nums text-muted">{formatShort(m.start_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
