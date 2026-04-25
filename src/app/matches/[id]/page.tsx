import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { TeamOverview } from "@/components/TeamOverview";
import { OddsCard } from "@/components/OddsCard";
import { RefreshOddsButton } from "@/components/RefreshOddsButton";
import { VerdictCard } from "@/components/VerdictCard";
import { RecentForm } from "@/components/RecentForm";
import { HeadToHead } from "@/components/HeadToHead";
import { DraftView } from "@/components/DraftView";
import { DraftForm } from "@/components/DraftForm";
import { generatePredictionForMatch } from "@/actions/predict";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface PageProps { params: Promise<{ id: string }> }

function formatKickoff(iso: string): string {
  // America/New_York auto-handles EST vs EDT; label as "ET" year-round.
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

export default async function MatchPage({ params }: PageProps) {
  const { id } = await params;
  const sb = createServerClient();
  const me = await getCurrentUser();
  const canEdit = me?.role === "admin";

  const { data: match } = await sb
    .from("matches")
    .select(`
      id, start_at, status, best_of, split,
      team_a:teams!matches_team_a_id_fkey (id, name, tag, region, logo_url, leaguepedia_slug),
      team_b:teams!matches_team_b_id_fkey (id, name, tag, region, logo_url, leaguepedia_slug),
      patch:patches (id, version, released_on)
    `)
    .eq("id", id)
    .single();

  if (!match) return notFound();

  const [{ data: playersA }, { data: playersB }] = await Promise.all([
    sb.from("players").select("*").eq("team_id", (match.team_a as any).id).eq("is_active", true),
    sb.from("players").select("*").eq("team_id", (match.team_b as any).id).eq("is_active", true),
  ]);

  const { data: latestOdds } = await sb
    .from("odds_snapshots")
    .select("*")
    .eq("match_id", id)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let { data: pred } = await sb
    .from("predictions")
    .select("*")
    .eq("match_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pred) {
    await generatePredictionForMatch(id, latestOdds ? {
      novigA: Number(latestOdds.novig_a),
      novigB: Number(latestOdds.novig_b),
      snapshotId: latestOdds.id,
    } : undefined);
    const { data: fresh } = await sb
      .from("predictions")
      .select("*")
      .eq("match_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    pred = fresh;
  }

  const { data: factors } = pred
    ? await sb.from("prediction_factors").select("*").eq("prediction_id", pred.id)
    : { data: [] as any[] };

  const { data: existingDraft } = await sb
    .from("drafts")
    .select("id, blue_team_id, notes")
    .eq("match_id", id)
    .maybeSingle();

  const { data: existingSlots } = existingDraft
    ? await sb
        .from("draft_slots")
        .select("side, slot_type, slot_index, role, champion_id")
        .eq("draft_id", existingDraft.id)
    : { data: [] as any[] };

  const { data: champions } = await sb
    .from("champions")
    .select("id, key, display_name, primary_role")
    .order("display_name", { ascending: true });

  const teamA = match.team_a as any;
  const teamB = match.team_b as any;
  const patch = match.patch as any;

  const statusStyle =
    match.status === "completed"
      ? "badge-good"
      : match.status === "live"
      ? "badge-warn"
      : "badge-muted";

  return (
    <div className="space-y-8">
      <div className="card-hero">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {teamA.name} <span className="text-muted">vs</span> {teamB.name}
            </h1>
            <p className="mt-1.5 text-[11px] italic text-muted">
              Analytical support, not guaranteed betting advice.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums text-muted">
            <span suppressHydrationWarning>{formatKickoff(match.start_at)}</span>
            <span className="text-[color:var(--border)]">&middot;</span>
            <span>BO{match.best_of}</span>
            <span className="text-[color:var(--border)]">&middot;</span>
            <span>{match.split}</span>
            {patch && (
              <>
                <span className="text-[color:var(--border)]">&middot;</span>
                <span>Patch {patch.version}</span>
              </>
            )}
            <span className={statusStyle}>{match.status}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {pred ? (
          <VerdictCard
            prediction={pred as any}
            factors={(factors ?? []) as any}
            teamATag={teamA.tag}
            teamBTag={teamB.tag}
            latestNovigA={latestOdds ? Number(latestOdds.novig_a) : undefined}
            latestNovigB={latestOdds ? Number(latestOdds.novig_b) : undefined}
          />
        ) : (
          <div className="card flex items-center justify-center text-sm text-muted">
            No prediction yet. Enter odds below to generate one.
          </div>
        )}
        {canEdit ? (
          <div className="space-y-3">
            <RefreshOddsButton matchId={match.id} />
            <OddsCard
              matchId={match.id}
              teamATag={teamA.tag}
              teamBTag={teamB.tag}
              latestNovigA={latestOdds ? Number(latestOdds.novig_a) : undefined}
              latestNovigB={latestOdds ? Number(latestOdds.novig_b) : undefined}
              latestSource={latestOdds?.source}
              latestCapturedAt={latestOdds?.captured_at}
            />
          </div>
        ) : (
          latestOdds && (
            <div className="card">
              <h3 className="section-eyebrow">Latest market (no-vig)</h3>
              <div className="mt-3 flex items-baseline gap-4 text-sm">
                <span className="stat-value">
                  {teamA.tag}{" "}
                  <span className="text-muted">{(Number(latestOdds.novig_a) * 100).toFixed(1)}%</span>
                </span>
                <span className="text-muted">vs</span>
                <span className="stat-value">
                  {teamB.tag}{" "}
                  <span className="text-muted">{(Number(latestOdds.novig_b) * 100).toFixed(1)}%</span>
                </span>
              </div>
              {latestOdds.source && (
                <p className="mt-2 text-[11px] text-muted">Source: {latestOdds.source}</p>
              )}
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TeamOverview team={teamA} players={(playersA ?? []) as any} />
        <TeamOverview team={teamB} players={(playersB ?? []) as any} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RecentForm teamId={teamA.id} teamTag={teamA.tag} />
        <RecentForm teamId={teamB.id} teamTag={teamB.tag} />
      </div>

      <HeadToHead
        teamAId={teamA.id}
        teamBId={teamB.id}
        teamATag={teamA.tag}
        teamBTag={teamB.tag}
      />

      <DraftView
        matchId={match.id}
        teamAId={teamA.id}
        teamBId={teamB.id}
        teamATag={teamA.tag}
        teamBTag={teamB.tag}
      />

      {canEdit && (
        <DraftForm
          matchId={match.id}
          teamAId={teamA.id}
          teamATag={teamA.tag}
          teamBId={teamB.id}
          teamBTag={teamB.tag}
          champions={(champions ?? []) as any}
          initialBlueTeamId={existingDraft?.blue_team_id ?? undefined}
          initialSlots={(existingSlots ?? []) as any}
          initialNotes={existingDraft?.notes ?? undefined}
        />
      )}
    </div>
  );
}
