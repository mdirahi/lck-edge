"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { convertOdds, parseOddsInput, type OddsFormat } from "@/lib/odds";
import { generatePredictionForMatch } from "./predict";
import { getCurrentUser } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export interface SaveOddsInput {
  matchId: string;
  format: OddsFormat;
  /** Raw user-typed string for team A price. Parsed server-side. */
  teamARaw: string;
  /** Raw user-typed string for team B price. Parsed server-side. */
  teamBRaw: string;
  source: string;
}

export interface SaveOddsResult {
  ok: boolean;
  error: string;
  snapshotId?: string;
  predictionId?: string;
}

export async function saveOddsAction(input: SaveOddsInput): Promise<SaveOddsResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (me.role !== "admin") return { ok: false, error: "Admin role required to save odds" };

  const sb = createServerClient();

  let teamA: number;
  let teamB: number;
  try {
    teamA = parseOddsInput(input.teamARaw, input.format);
  } catch (e: any) {
    return { ok: false, error: `${input.format} price for side A: ${e.message}` };
  }
  try {
    teamB = parseOddsInput(input.teamBRaw, input.format);
  } catch (e: any) {
    return { ok: false, error: `${input.format} price for side B: ${e.message}` };
  }

  let conv;
  try {
    conv = convertOdds({ format: input.format, teamA, teamB });
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Invalid odds input" };
  }

  const { data, error } = await sb
    .from("odds_snapshots")
    .insert({
      match_id: input.matchId,
      source: input.source || "manual",
      format: input.format,
      team_a_price: teamA,
      team_b_price: teamB,
      team_a_implied_prob: round4(conv.teamAImpliedProb),
      team_b_implied_prob: round4(conv.teamBImpliedProb),
      novig_a: round4(conv.novigA),
      novig_b: round4(conv.novigB),
      raw: { input },
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save odds snapshot" };
  }

  // Recompute prediction using the fresh market signal.
  const pred = await generatePredictionForMatch(input.matchId, {
    novigA: conv.novigA,
    novigB: conv.novigB,
    snapshotId: data.id,
  });

  revalidatePath(`/matches/${input.matchId}`);

  await logAction({
    actor: me,
    action: "saveOdds",
    targetType: "match",
    targetId: input.matchId,
    metadata: {
      format: input.format,
      source: input.source,
      teamARaw: input.teamARaw,
      teamBRaw: input.teamBRaw,
      novigA: conv.novigA,
      novigB: conv.novigB,
    },
  });

  return {
    ok: true,
    error: "",
    snapshotId: data.id,
    predictionId: pred?.id,
  };
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
