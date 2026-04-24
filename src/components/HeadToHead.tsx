import { createServerClient } from "@/lib/supabase/server";

/**
 * Shows head-to-head series between two teams over the last N months.
 * Async server component - queries Supabase directly.
 *
 * Spans both grid columns on the match page since it compares both teams in one card.
 */
export async function HeadToHead({
  teamAId,
  teamBId,
  teamATag,
  teamBTag,
  months = 12,
  limit = 10,
}: {
  teamAId: string;
  teamBId: string;
  teamATag: string;
  teamBTag: string;
  months?: number;
  limit?: number;
}) {
  const sb = createServerClient();
  const since = new Date(Date.now() - months * 30 * 24 * 3600 * 1000).toISOString();

  const { data } = await sb
    .from("matches")
    .select("id, start_at, winner_team_id, team_a_id, team_b_id, best_of, split")
    .eq("status", "completed")
    .or(
      `and(team_a_id.eq.${teamAId},team_b_id.eq.${teamBId}),and(team_a_id.eq.${teamBId},team_b_id.eq.${teamAId})`
    )
    .gte("start_at", since)
    .order("start_at", { ascending: false })
    .limit(limit);

  const rows = data ?? [];
  const aWins = rows.filter((m: any) => m.winner_team_id === teamAId).length;
  const bWins = rows.filter((m: any) => m.winner_team_id === teamBId).length;

  return (
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Head-to-head · last {months} months
        </h3>
        <div className="text-xl font-semibold tabular-nums">
          <span className={aWins > bWins ? "text-good" : ""}>{teamATag}</span>
          <span className="mx-2 text-muted">{aWins}&ndash;{bWins}</span>
          <span className={bWins > aWins ? "text-good" : ""}>{teamBTag}</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted">
          No completed head-to-head series in the last {months} months. H2H is lightly weighted
          in the model (10%) and LCK rosters churn, so a thin history is expected.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((m: any) => {
            const aWon = m.winner_team_id === teamAId;
            const winnerTag = aWon ? teamATag : teamBTag;
            const loserTag = aWon ? teamBTag : teamATag;
            return (
              <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-5 min-w-[36px] items-center justify-center rounded bg-good/20 px-1 text-[10px] font-semibold text-good">
                    {winnerTag}
                  </span>
                  <span className="text-muted">def.</span>
                  <span className="text-muted">{loserTag}</span>
                  <span className="ml-2 text-xs text-muted">BO{m.best_of}</span>
                </span>
                <span className="text-xs text-muted">
                  {formatShort(m.start_at)} &middot; {m.split}
                </span>
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
    year: "numeric",
  });
}
