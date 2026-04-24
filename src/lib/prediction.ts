/**
 * Prediction engine (v0.1).
 *
 * Deliberately transparent: a weighted sum of seven normalized factors.
 * Every factor returns a 0..100 score for each team. Weights are in one
 * place so you can tune them and bump MODEL_VERSION when you do.
 *
 * See the project plan doc, Section 8, for the reasoning behind each weight.
 */

import { scoresToProb, edge, blendByConfidence, recommend } from "./odds.ts";

export const MODEL_VERSION = "v0.1";

// -------- Weights (must sum to 1.0) --------
export const PREDICTION_WEIGHTS = {
  recent_form:          0.20, // rolling series/game win rate (last 6 series)
  player_form_comfort:  0.20, // per-player form + champion comfort if draft known
  draft_strength:       0.25, // projected or actual draft quality
  head_to_head:         0.10, // last 6-12 months, discounted on roster change
  patch_meta_fit:       0.10, // how well this team's style fits the patch
  side_structural:      0.05, // blue-side edge, back-to-back fatigue, etc.
  market_signal:        0.10, // novig market probability, capped at this weight
} as const;

export type FactorKey = keyof typeof PREDICTION_WEIGHTS;

export interface FactorInputs {
  // Any factor we don't have data for can be left undefined; the engine will
  // substitute a neutral value (50) and add a risk note.
  recentForm?:        { teamA: number; teamB: number; note?: string }; // raw: series W rate (0..1)
  playerFormComfort?: { teamA: number; teamB: number; note?: string }; // raw: composite z-score-ish
  draftStrength?:     { teamA: number; teamB: number; note?: string }; // raw: 0..1 draft-quality
  headToHead?:        { teamA: number; teamB: number; note?: string }; // raw: A's winrate vs B recently
  patchMetaFit?:      { teamA: number; teamB: number; note?: string }; // raw: fit score 0..1
  sideStructural?:    { teamA: number; teamB: number; note?: string }; // raw: blue-side/etc.
  marketSignal?:      { teamA: number; teamB: number; note?: string }; // raw: novig probability
}

export interface FactorRow {
  key: FactorKey;
  weight: number;
  teamAValue?: number;
  teamBValue?: number;
  teamAScore: number;   // 0..100 normalized
  teamBScore: number;
  note?: string;
}

export interface Prediction {
  modelVersion: string;
  teamAScore: number;       // 0..100 weighted total
  teamBScore: number;
  teamAProb: number;        // model-only, 0..1
  finalProbA?: number;      // confidence-blended, 0..1 (only if market supplied)
  confidence: "low" | "medium" | "high";
  lean: "team_a" | "team_b" | "pass";
  recommendation: "play" | "watch" | "avoid";
  marketDelta?: number;     // teamAProb - novigA, if market supplied
  factors: FactorRow[];
  reasons: string[];
  risks: string[];
}

// ---------- Normalizers (raw -> 0..100) ----------
const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/** Win rate (0..1) -> 0..100, with modest slope so a team going 6-0 is ~85 not 100. */
function winrateToScore(wr: number): number {
  // map 0.0 -> 30, 0.5 -> 50, 1.0 -> 85 (non-linear)
  const base = 30 + 55 * wr;                    // 0..1 -> 30..85
  return clamp(base);
}

/** Already-0..1 quality score -> 0..100 linear. */
function qualityToScore(q: number): number {
  return clamp(q * 100);
}

/** Market novig prob -> score so we can fold it in as a factor. */
function probToScore(p: number): number {
  return clamp(p * 100);
}

// ---------- Factor handlers ----------
function factorFromInput(
  key: FactorKey,
  input: { teamA: number; teamB: number; note?: string } | undefined,
  normalizer: (x: number) => number,
  defaultNote: string
): FactorRow {
  const weight = PREDICTION_WEIGHTS[key];
  if (!input) {
    return {
      key, weight,
      teamAValue: undefined, teamBValue: undefined,
      teamAScore: 50, teamBScore: 50,
      note: `${defaultNote} (no data \u2014 neutral 50/50 used)`
    };
  }
  return {
    key, weight,
    teamAValue: input.teamA, teamBValue: input.teamB,
    teamAScore: normalizer(input.teamA),
    teamBScore: normalizer(input.teamB),
    note: input.note ?? defaultNote,
  };
}

// ---------- Public API ----------
export function runPrediction(inputs: FactorInputs): Prediction {
  const rows: FactorRow[] = [
    factorFromInput("recent_form",         inputs.recentForm,        winrateToScore, "Rolling series win rate"),
    factorFromInput("player_form_comfort", inputs.playerFormComfort, qualityToScore, "Player form + champion comfort"),
    factorFromInput("draft_strength",      inputs.draftStrength,     qualityToScore, "Draft strength"),
    factorFromInput("head_to_head",        inputs.headToHead,        winrateToScore, "H2H winrate (last 6\u201312 months)"),
    factorFromInput("patch_meta_fit",      inputs.patchMetaFit,      qualityToScore, "Patch / meta fit"),
    factorFromInput("side_structural",     inputs.sideStructural,    qualityToScore, "Side + structural (blue-side etc.)"),
    factorFromInput("market_signal",       inputs.marketSignal,      probToScore,    "Market signal (novig)"),
  ];

  const weightSum = rows.reduce((s, r) => s + r.weight, 0);
  // sanity: weights should sum to 1
  if (Math.abs(weightSum - 1) > 1e-6) {
    throw new Error(`PREDICTION_WEIGHTS must sum to 1. Got ${weightSum}`);
  }

  const teamAScore = rows.reduce((s, r) => s + r.teamAScore * r.weight, 0);
  const teamBScore = rows.reduce((s, r) => s + r.teamBScore * r.weight, 0);

  // Count how many NON-market factors supplied real input. With 0 or 1, the
  // model is essentially guessing and any "edge vs market" is math noise.
  const dataScore = rows.filter(
    (r) => r.key !== "market_signal" && r.teamAValue !== undefined
  ).length;

  // ---- market first (needed for fallback) ----
  const market = rows.find((r) => r.key === "market_signal");
  const novigA = market && market.teamAValue !== undefined ? market.teamAValue : undefined;

  // When the model has no independent information, defer to the market
  // rather than pretending the 50/50 stubs disagree with it.
  let teamAProb: number;
  if (dataScore === 0 && novigA !== undefined) {
    teamAProb = novigA;
  } else {
    teamAProb = scoresToProb(teamAScore, teamBScore, 1.3);
  }

  // ---- confidence (gated by dataScore) ----
  const hasDraft = !!inputs.draftStrength;
  const probGap = Math.abs(teamAProb - 0.5);
  const factorGap = Math.max(
    ...rows.map((r) => Math.abs(r.teamAScore - r.teamBScore))
  );
  let confidence: "low" | "medium" | "high" = "low";
  if (dataScore >= 3 && hasDraft && probGap >= 0.12 && factorGap < 25) confidence = "high";
  else if (dataScore >= 2 && probGap >= 0.05) confidence = "medium";
  else confidence = "low";

  // ---- market comparison ----
  const marketDelta = novigA !== undefined ? edge(teamAProb, novigA) : undefined;
  const finalProbA = novigA !== undefined ? blendByConfidence(teamAProb, novigA, confidence) : undefined;
  // PLAY requires real independent signal. Below 2 factors we never cross
  // from "watch" to "play" regardless of apparent edge size.
  let recommendation: "play" | "watch" | "avoid";
  if (novigA !== undefined) {
    const raw = recommend(teamAProb, novigA, confidence);
    recommendation = dataScore < 2 && raw === "play" ? "watch" : raw;
  } else {
    recommendation = confidence === "low" ? "avoid" : "watch";
  }

  const lean: "team_a" | "team_b" | "pass" =
    dataScore === 0 ? "pass" :
    probGap < 0.02 ? "pass" : (teamAProb > 0.5 ? "team_a" : "team_b");

  // ---- reasons + risks ----
  const reasons: string[] = [];
  const risks: string[] = [];

  if (dataScore === 0) {
    risks.push(
      novigA !== undefined
        ? "No independent signal yet \u2014 model is deferring to market. Add a draft or import recent form data to unlock analysis."
        : "No data on either side. Nothing to say about this match yet."
    );
    reasons.push("No independent information to report.");
  } else {
    for (const r of rows) {
      if (r.key === "market_signal") continue;
      if (r.teamAValue === undefined) continue; // skip stubs
      const diff = r.teamAScore - r.teamBScore;
      if (Math.abs(diff) >= 10) {
        const who = diff > 0 ? "Team A" : "Team B";
        reasons.push(`${who} stronger on ${prettyFactor(r.key)} (${r.teamAScore.toFixed(0)} vs ${r.teamBScore.toFixed(0)})`);
      }
    }
    if (!hasDraft) risks.push("Draft not known yet \u2014 score is a projection only.");
    if (!inputs.recentForm) risks.push("No recent form data \u2014 factor skipped.");
    if (marketDelta !== undefined && Math.abs(marketDelta) >= 0.10 && dataScore < 3) {
      risks.push(`Large disagreement with market (${(marketDelta * 100).toFixed(1)} pts). With limited data, most likely explanation: missing data on our side, not a real edge.`);
    }
    if (confidence === "low") risks.push("Confidence is low. Watch-only, not a conviction play.");
    if (reasons.length === 0) reasons.push("No single factor dominates \u2014 matchup looks close.");
  }

  return {
    modelVersion: MODEL_VERSION,
    teamAScore,
    teamBScore,
    teamAProb,
    finalProbA,
    confidence,
    lean,
    recommendation,
    marketDelta,
    factors: rows,
    reasons,
    risks,
  };
}

function prettyFactor(k: FactorKey): string {
  switch (k) {
    case "recent_form": return "recent form";
    case "player_form_comfort": return "player form + comfort";
    case "draft_strength": return "draft";
    case "head_to_head": return "head-to-head";
    case "patch_meta_fit": return "patch/meta fit";
    case "side_structural": return "side selection";
    case "market_signal": return "market signal";
  }
}
