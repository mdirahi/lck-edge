import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatKST(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }) + " KST";
}

export default async function HomePage() {
  const sb = createServerClient();

  // Upcoming: anything scheduled in the past week or in the future.
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const [{ data: upcomingRows, error: upErr }, { data: pastRows, error: pastErr }] =
    await Promise.all([
      sb
        .from("matches")
        .select(`
          id, start_at, status, best_of, split,
          team_a:teams!matches_team_a_id_fkey (id, name, tag),
          team_b:teams!matches_team_b_id_fkey (id, name, tag)
        `)
        .gte("start_at", cutoff)
        .neq("status", "completed")
        .order("start_at", { ascending: true })
        .limit(60),
      sb
        .from("matches")
        .select(`
          id, start_at, status, best_of, split, winner_team_id,
          team_a:teams!matches_team_a_id_fkey (id, name, tag),
          team_b:teams!matches_team_b_id_fkey (id, name, tag)
        `)
        .eq("status", "completed")
        .order("start_at", { ascending: false })
        .limit(30),
    ]);

  if (upErr || pastErr) {
    const err = upErr ?? pastErr;
    return (
      <div className="rounded-lg border border-border bg-panel p-6 text-bad">
        <div className="font-semibold">Couldn&rsquo;t load matches</div>
        <p className="mt-1 text-sm">{err?.message}</p>
      </div>
    );
  }

  const upcoming = upcomingRows ?? [];
  const past = pastRows ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">LCK matches</h1>
        <p className="text-sm text-muted">
          Click any match for the full analysis page. Prices you enter manually will persist as
          snapshots.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Upcoming</h2>
        {upcoming.length === 0 ? (
          <EmptyState>No upcoming LCK matches.</EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {upcoming.map((m: any) => <MatchCard key={m.id} m={m} />)}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Past results
        </h2>
        {past.length === 0 ? (
          <EmptyState>No completed matches yet.</EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {past.map((m: any) => <MatchCard key={m.id} m={m} showWinner />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-6 text-sm text-muted">
      {children}
    </div>
  );
}

function MatchCard({ m, showWinner }: { m: any; showWinner?: boolean }) {
  const aWon = showWinner && m.winner_team_id === m.team_a?.id;
  const bWon = showWinner && m.winner_team_id === m.team_b?.id;
  return (
    <li>
      <Link
        href={`/matches/${m.id}`}
        className="block rounded-lg border border-border bg-panel p-4 transition hover:border-accent hover:bg-panel/80"
      >
        <div className="flex items-center justify-between">
          <div className="text-lg font-medium">
            <span className={aWon ? "text-good" : bWon ? "text-muted" : ""}>
              {m.team_a?.tag}
            </span>{" "}
            <span className="text-muted">vs</span>{" "}
            <span className={bWon ? "text-good" : aWon ? "text-muted" : ""}>
              {m.team_b?.tag}
            </span>
          </div>
          <div className="text-xs text-muted">BO{m.best_of}</div>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted">
          <span>{formatKST(m.start_at)}</span>
          <span className="rounded-full border border-border px-2 py-0.5">{m.status}</span>
        </div>
      </Link>
    </li>
  );
}
