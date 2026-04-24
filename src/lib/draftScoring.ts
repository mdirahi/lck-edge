/**
 * Draft scoring (v0.1).
 *
 * Given a set of pick slots for a draft, return a 0..1 "draft quality"
 * score for each team by averaging champion tier values, with a modest
 * off-role penalty when applicable. Requires at least 3 picks per side
 * to emit a signal — any less and it's noise.
 *
 * This module is intentionally pure: no database calls, no Next.js types.
 * The predict.ts loader is responsible for fetching + shaping input.
 */

import {
  CHAMPION_TIERS,
  DEFAULT_TIER,
  OFF_ROLE_PENALTY,
  TIER_VALUE,
  tierFor,
  type Tier,
} from "./championTiers.ts";
import type { RoleCode } from "./types.ts";

export interface DraftSlotInput {
  side: "blue" | "red";
  slot_type: "pick" | "ban";
  role: RoleCode | null;
  champion_display_name: string | null;
  champion_primary_role: RoleCode | null;
}

export interface DraftStrengthResult {
  teamA: number;
  teamB: number;
  note: string;
  aPickCount: number;
  bPickCount: number;
  unknownChampions: string[]; // champions not in tier table, for the user's attention
}

/**
 * Compute per-team draft quality.
 *
 * Returns undefined when neither side has at least 3 picks entered —
 * with too few picks it's not a signal, just noise.
 */
export function computeDraftStrength(
  slots: DraftSlotInput[],
  blueTeamId: string,
  redTeamId: string,
  teamAId: string
): DraftStrengthResult | undefined {
  const aSide: "blue" | "red" = blueTeamId === teamAId ? "blue"
    : redTeamId === teamAId ? "red"
    : "blue"; // defensive: if mis-labeled, default blue=A
  const bSide: "blue" | "red" = aSide === "blue" ? "red" : "blue";

  const aPicks = slots.filter((s) => s.side === aSide && s.slot_type === "pick");
  const bPicks = slots.filter((s) => s.side === bSide && s.slot_type === "pick");

  const unknown: string[] = [];
  for (const p of [...aPicks, ...bPicks]) {
    if (p.champion_display_name && !(p.champion_display_name in CHAMPION_TIERS)) {
      if (!unknown.includes(p.champion_display_name)) unknown.push(p.champion_display_name);
    }
  }

  const aRaw = pickQualityRaw(aPicks);
  const bRaw = pickQualityRaw(bPicks);

  // Need at least 3 picks entered on BOTH sides to emit a signal.
  if (aRaw.count < 3 || bRaw.count < 3) return undefined;

  const aScore = aRaw.total / aRaw.count;
  const bScore = bRaw.total / bRaw.count;

  return {
    teamA: aScore,
    teamB: bScore,
    note: `Draft tier average (A=${aScore.toFixed(2)} from ${aRaw.count} picks, B=${bScore.toFixed(2)} from ${bRaw.count})`,
    aPickCount: aRaw.count,
    bPickCount: bRaw.count,
    unknownChampions: unknown,
  };
}

function pickQualityRaw(picks: DraftSlotInput[]): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const p of picks) {
    if (!p.champion_display_name) continue;
    const t: Tier = tierFor(p.champion_display_name);
    let v = TIER_VALUE[t];
    if (
      p.role &&
      p.champion_primary_role &&
      p.role !== p.champion_primary_role
    ) {
      v *= OFF_ROLE_PENALTY;
    }
    total += v;
    count++;
  }
  return { total, count };
}

// Re-export for convenience
export { DEFAULT_TIER, TIER_VALUE, OFF_ROLE_PENALTY };
