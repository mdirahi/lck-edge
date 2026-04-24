"use server";

import { createServerClient } from "@/lib/supabase/server";
import { runPrediction, type FactorInputs } from "@/lib/prediction";
import { computeDraftStrength, type DraftSlotInput } from "@/lib/draftScoring";

/**
 * Gather whatever data we have for a match and run the prediction engine.
 * For the MVP this is intentionally sparse: most factors fall back to neutral
 * 50/50 until you import real stats. The plumbing is here, so tuning is just
 * filling in the loaders below.
 */
export async function generatePredictionForMatch(
  matchId: string,
  market?: { novigA: number; novigB: number; snapshotId?: string }
) {
  const sb = createServerClient();

  const { data: match, error } = await sb
    .from("matches")
    .select("id, team_a_id, team_b_id, status")
    .eq("id", matchId)
    .single();
  if (error || !match) return null;

  const inputs: FactorInputs = {};

  // Recent form: last 6 completed series for each team.
  inputs.recentForm = await loadRecentForm(sb, match.team_a_id, match.team_b_id);

  // Head-to-head: last 12 months between these two teams.
  inputs.headToHead = await loadHeadToHead(sb, match.team_a_id, match.team_b_id);

  // Market signal from the caller (if supplied).
  if (market) {
    inputs.marketSignal = { teamA: market.novigA, teamB: market.novigB, note: "Market novig probability" };
  }

  // Draft strength: picks tier-averaged, off-role penalty applied.
  inputs.draftStrength = await loadDraftStrength(sb, matchId, match.team_a_id, match.team_b_id);

  // The rest are stubs for now. Each function is marked so you know what to fill.
  // inputs.playerFormComfort = await loadPlayerForm(sb, match.team_a_id, match.team_b_id);
  // inputs.patchMetaFit = await loadPatchMetaFit(sb, match);
  // inputs.sideStructural = await loadSideStructural(sb, match);

  const pred = runPrediction(inputs);

  const { data: inserted, error: insErr } = await sb
    .from("predictions")
    .insert({
      match_id: matchId,
      model_version: pred.modelVersion,
      team_a_score: round2(pred.teamAScore),
      team_b_score: round2(pred.teamBScore),
      team_a_prob: round4(pred.teamAProb),
      final_prob_a: pred.finalProbA !== undefined ? round4(pred.finalProbA) : null,
      confidence: pred.confidence,
      lean: pred.lean,
      recommendation: pred.recommendation,
      market_delta: pred.marketDelta !== undefined ? round4(pred.marketDelta) : null,
      reasons: pred.reasons,
      risks: pred.risks,
      odds_snapshot_id: market?.snapshotId ?? null,
    })
    .select("id")
    .single();

  if (insErr || !inserted) return null;

  // Persist factor rows for auditability
  const rows = pred.factors.map((f) => ({
    prediction_id: inserted.id,
    factor_key: f.key,
    weight: f.weight,
    team_a_value: f.teamAValue ?? null,
    team_b_value: f.teamBValue ?? null,
    team_a_score: round2(f.teamAScore),
    team_b_score: round2(f.teamBScore),
    note: f.note ?? null,
  }));
  await sb.from("prediction_factors").insert(rows);

  return inserted;
}

// ---------- Loaders ----------

async function loadRecentForm(
  sb: ReturnType<typeof createServerClient>,
  teamAId: string,
  teamBId: string
) {
  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(); // last 60 days

  const [a, b] = await Promise.all([
    teamSeriesWinRate(sb, teamAId, since),
    teamSeriesWinRate(sb, teamBId, since),
  ]);

  // Only fire when BOTH teams have enough samples — otherwise it's noise.
  if (a === undefined || b === undefined) return undefined;
  return {
    teamA: a,
    teamB: b,
    note: `Series winrate last 60 days (A=${a.toFixed(2)}, B=${b.toFixed(2)})`,
  };
}

async function teamSeriesWinRate(
  sb: ReturnType<typeof createServerClient>,
  teamId: string,
  sinceIso: string
): Promise<number | undefined> {
  const { data } = await sb
    .from("matches")
    .select("winner_team_id, team_a_id, team_b_id, status, start_at")
    .eq("status", "completed")
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .gte("start_at", sinceIso)
    .order("start_at", { ascending: false })
    .limit(6);
  // Require >=3 completed matches to treat as signal; less is noise.
  if (!data || data.length < 3) return undefined;
  const wins = data.filter((m) => m.winner_team_id === teamId).length;
  return wins / data.length;
}

async function loadHeadToHead(
  sb: ReturnType<typeof createServerClient>,
  teamAId: string,
  teamBId: string
) {
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  const { data } = await sb
    .from("matches")
    .select("winner_team_id, team_a_id, team_b_id")
    .eq("status", "completed")
    .or(
      `and(team_a_id.eq.${teamAId},team_b_id.eq.${teamBId}),and(team_a_id.eq.${teamBId},team_b_id.eq.${teamAId})`
    )
    .gte("start_at", since)
    .limit(12);
  if (!data || data.length === 0) return undefined;
  const aWins = data.filter((m) => m.winner_team_id === teamAId).length;
  const rate = aWins / data.length;
  return {
    teamA: rate,
    teamB: 1 - rate,
    note: `H2H last 12 months (A=${aWins}/${data.length})`,
  };
}

async function loadDraftStrength(
  sb: ReturnType<typeof createServerClient>,
  matchId: string,
  teamAId: string,
  teamBId: string
) {
  const { data: draft } = await sb
    .from("drafts")
    .select("id, blue_team_id, red_team_id")
    .eq("match_id", matchId)
    .maybeSingle();
  if (!draft) return undefined;

  const { data: slots } = await sb
    .from("draft_slots")
    .select("side, slot_type, role, champion:champions(display_name, primary_role)")
    .eq("draft_id", draft.id);
  if (!slots || slots.length === 0) return undefined;

  const normalized: DraftSlotInput[] = (slots as any[]).map((s) => ({
    side: s.side,
    slot_type: s.slot_type,
    role: s.role,
    champion_display_name: s.champion?.display_name ?? null,
    champion_primary_role: s.champion?.primary_role ?? null,
  }));

  const result = computeDraftStrength(
    normalized,
    draft.blue_team_id,
    draft.red_team_id,
    teamAId
  );
  if (!result) return undefined;

  const noteParts = [result.note];
  if (result.unknownChampions.length > 0) {
    noteParts.push(
      `unknown tiers: ${result.unknownChampions.join(", ")} (defaulted to B)`
    );
  }

  return {
    teamA: result.teamA,
    teamB: result.teamB,
    note: noteParts.join(" | "),
  };
}

function round2(x: number): number { return Math.round(x * 100) / 100; }
function round4(x: number): number { return Math.round(x * 10000) / 10000; }
