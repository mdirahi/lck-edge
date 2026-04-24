"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import type { DraftSide, DraftSlotType, RoleCode } from "@/lib/types";
import { generatePredictionForMatch } from "./predict";
import { getCurrentUser } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export interface SaveDraftSlotInput {
  side: DraftSide;
  slot_type: DraftSlotType;
  slot_index: number;
  role: RoleCode | null;
  champion_id: string | null;
}

export interface SaveDraftInput {
  matchId: string;
  blueTeamId: string;
  redTeamId: string;
  slots: SaveDraftSlotInput[];
  notes?: string;
}

export interface SaveDraftResult {
  ok: boolean;
  error: string;
  draftId?: string;
}

/**
 * Upsert a draft for a match (one draft per match). Wipes existing slots and
 * re-inserts them in one transactional pass from the caller's point of view.
 */
export async function saveDraftAction(input: SaveDraftInput): Promise<SaveDraftResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (me.role !== "admin") return { ok: false, error: "Admin role required to save draft" };

  const sb = createServerClient();

  if (!input.matchId) return { ok: false, error: "matchId is required" };
  if (!input.blueTeamId || !input.redTeamId) {
    return { ok: false, error: "Both sides must be assigned to a team" };
  }
  if (input.blueTeamId === input.redTeamId) {
    return { ok: false, error: "Blue and red side must be different teams" };
  }

  const { data: draft, error } = await sb
    .from("drafts")
    .upsert(
      {
        match_id: input.matchId,
        blue_team_id: input.blueTeamId,
        red_team_id: input.redTeamId,
        source: "manual",
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "match_id" }
    )
    .select("id")
    .single();

  if (error || !draft) {
    return { ok: false, error: error?.message ?? "Failed to save draft" };
  }

  const { error: delErr } = await sb.from("draft_slots").delete().eq("draft_id", draft.id);
  if (delErr) return { ok: false, error: delErr.message };

  const rows = input.slots
    .filter((s) => s.champion_id !== null)
    .map((s) => ({
      draft_id: draft.id,
      side: s.side,
      slot_type: s.slot_type,
      slot_index: s.slot_index,
      role: s.slot_type === "pick" ? s.role : null,
      champion_id: s.champion_id,
    }));

  if (rows.length > 0) {
    const { error: slotErr } = await sb.from("draft_slots").insert(rows);
    if (slotErr) return { ok: false, error: slotErr.message };
  }

  // Re-score with the fresh draft. Thread latest odds through if present.
  const { data: latestOdds } = await sb
    .from("odds_snapshots")
    .select("id, novig_a, novig_b")
    .eq("match_id", input.matchId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await generatePredictionForMatch(
    input.matchId,
    latestOdds
      ? { novigA: latestOdds.novig_a, novigB: latestOdds.novig_b, snapshotId: latestOdds.id }
      : undefined
  );

  revalidatePath(`/matches/${input.matchId}`);

  await logAction({
    actor: me,
    action: "saveDraft",
    targetType: "match",
    targetId: input.matchId,
    metadata: {
      blueTeamId: input.blueTeamId,
      redTeamId: input.redTeamId,
      picksFilled: rows.filter((r) => r.slot_type === "pick").length,
      bansFilled: rows.filter((r) => r.slot_type === "ban").length,
    },
  });

  return { ok: true, error: "", draftId: draft.id };
}
