import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }) + " ET";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function HomePage() {
  const sb = createServerClient();

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
      <div className="card text-bad">
        <div className="font-semibold">Couldn&rsquo;t load matches</div>
        <p className="mt-1 text-sm">{err?.message}</p>
      </div>
    );
  }

  const upcoming = upcomingRows ?? [];
  const past = pastRows ?? [];

  return (
    <div className="space-y-12">
      {/* Hero intro */}
      <div className="space-y-2.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-bg-elev/60 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted">
          <span className="dot-accent dot-pulse" />
          LCK 2026 Spring &middot; Research
        </div>
        <h1 className="page-title">
          LCK{" "}
          <span className="bg-gradient-to-r from-accent via-[#9bbdff] to-accent-2 bg-clip-text text-transparent">
            match analysis
          </span>
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Click any match for the full analysis page &mdash; projected scores, model vs market,
          draft breakdown, and recent form. Prices you enter manually persist as snapshots.
        </p>
      </div>

      <section className="space-y-5">
        <SectionHeader title="Upcoming" count={upcoming.length} />
        {upcoming.length === 0 ? (
          <EmptyState>No upcoming LCK matches.</EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {upcoming.map((m: any) => <MatchCard key={m.id} m={m} />)}
          </ul>
        )}
      </section>

      <section className="space-y-5">
        <SectionHeader title="Past results" count={past.length} />
        {past.length === 0 ? (
          <EmptyState>No completed matches yet.</EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {past.map((m: any) => <MatchCard key={m.id} m={m} showWinner />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="section-eyebrow">{title}</h2>
      <span className="text-[11px] tabular-nums text-muted">{count}</span>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="card text-sm italic text-muted">{children}</div>
  );
}

function MatchCard({ m, showWinner }: { m: any; showWinner?: boolean }) {
  const aWon = showWinner && m.winner_team_id === m.team_a?.id;
  const bWon = showWinner && m.winner_team_id === m.team_b?.id;
  const statusLabel = (m.status as string).toLowerCase();

  // Choose team-tag styling: winner tinted good, loser tinted muted; otherwise neutral/accent.
  const tagAClass = aWon ? "team-tag-win" : bWon ? "team-tag-lose" : "";
  const tagBClass = bWon ? "team-tag-win" : aWon ? "team-tag-lose" : "";

  const statusNode =
    statusLabel === "live" ? (
      <span className="badge-warn"><span className="dot-warn dot-pulse" />live</span>
    ) : statusLabel === "completed" ? (
      <span className="badge-good"><span className="dot-good" />final</span>
    ) : (
      <span className="badge-muted"><span className="dot-muted" />{statusLabel}</span>
    );

  return (
    <li>
      <Link
        href={`/matches/${m.id}`}
        className="card-link block group"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`team-tag ${tagAClass}`}>{m.team_a?.tag}</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted/80">
              vs
            </span>
            <span className={`team-tag ${tagBClass}`}>{m.team_b?.tag}</span>
          </div>
          <span className="badge-muted shrink-0">BO{m.best_of}</span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1.5 tabular-nums" suppressHydrationWarning>
            <ClockIcon />
            {showWinner ? formatDate(m.start_at) : formatKickoff(m.start_at)}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-muted/70">{m.split}</span>
            {statusNode}
          </span>
        </div>
      </Link>
    </li>
  );
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
