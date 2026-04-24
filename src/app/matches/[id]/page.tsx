import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { TeamOverview } from "@/components/TeamOverview";
import { OddsCard } from "@/components/OddsCard";
import { VerdictCard } from "@/components/VerdictCard";
import { RecentForm } from "@/components/RecentForm";
import { HeadToHead } from "@/components/HeadToHead";
import { DraftView } from "@/components/DraftView";
import { DraftForm } from "@/components/DraftForm";
import { generatePredictionForMatch } from "@/actions/predict";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface PageProps { params: Promise<{ id: string }> }

function formatKST(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }) + " KST";
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

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-2xl font-semibold">
            {teamA.name} <span className="text-muted">vs</span> {teamB.name}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{formatKST(match.start_at)}</span>
            <span>&middot; BO{match.best_of}</span>
            <span>&middot; {match.split}</span>
            {patch && <span>&middot; Patch {patch.version}</span>}
            <span className="rounded-full border border-border px-2 py-0.5">{match.status}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          Analytical support, not guaranteed betting advice.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
          <div className="rounded-lg border border-border bg-panel p-5 text-sm text-muted">
            No prediction yet. Enter odds below to generate one.
          </div>
        )}
        {canEdit ? (
          <OddsCard
            matchId={match.id}
            teamATag={teamA.tag}
            teamBTag={teamB.tag}
            latestNovigA={latestOdds ? Number(latestOdds.novig_a) : undefined}
            latestNovigB={latestOdds ? Number(latestOdds.novig_b) : undefined}
            latestSource={latestOdds?.source}
            latestCapturedAt={latestOdds?.captured_at}
          />
        ) : (
          latestOdds && (
            <div className="rounded-lg border border-border bg-panel p-5 text-sm text-muted">
              Latest market (no-vig): {teamA.tag} {(Number(latestOdds.novig_a) * 100).toFixed(1)}% / {teamB.tag} {(Number(latestOdds.novig_b) * 100).toFixed(1)}%
              {latestOdds.source ? ` \u00b7 ${latestOdds.source}` : ""}
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TeamOverview team={teamA} players={(playersA ?? []) as any} />
        <TeamOverview team={teamB} players={(playersB ?? []) as any} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
