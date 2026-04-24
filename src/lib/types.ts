export interface Team {
  id: string;
  name: string;
  tag: string;
  region: string;
  logo_url: string | null;
  leaguepedia_slug: string | null;
}

export interface Player {
  id: string;
  ign: string;
  real_name: string | null;
  role: "TOP" | "JNG" | "MID" | "ADC" | "SUP";
  team_id: string | null;
  is_active: boolean;
}

export interface Patch {
  id: string;
  version: string;
  released_on: string;
}

export type MatchStatus = "scheduled" | "live" | "completed";

export interface Match {
  id: string;
  start_at: string;
  status: MatchStatus;
  best_of: 1 | 3 | 5;
  team_a_id: string;
  team_b_id: string;
  winner_team_id: string | null;
  patch_id: string | null;
  split: string;
  external_ids: Record<string, unknown>;
}

export interface MatchWithTeams extends Match {
  team_a: Team;
  team_b: Team;
  patch: Patch | null;
}

export type OddsFormatDb = "decimal" | "american" | "implied_prob";

export interface OddsSnapshot {
  id: string;
  match_id: string;
  source: string;
  captured_at: string;
  format: OddsFormatDb;
  team_a_price: number;
  team_b_price: number;
  team_a_implied_prob: number;
  team_b_implied_prob: number;
  novig_a: number;
  novig_b: number;
  raw: Record<string, unknown>;
}

export interface PredictionRow {
  id: string;
  match_id: string;
  model_version: string;
  team_a_score: number;
  team_b_score: number;
  team_a_prob: number;
  final_prob_a: number | null;
  confidence: "low" | "medium" | "high";
  lean: "team_a" | "team_b" | "pass";
  recommendation: "play" | "watch" | "avoid";
  market_delta: number | null;
  reasons: string[];
  risks: string[];
  odds_snapshot_id: string | null;
  created_at: string;
}

export interface PredictionFactorRow {
  id: string;
  prediction_id: string;
  factor_key: string;
  weight: number;
  team_a_value: number | null;
  team_b_value: number | null;
  team_a_score: number;
  team_b_score: number;
  note: string | null;
}

// ---------- Draft ----------

export type RoleCode = "TOP" | "JNG" | "MID" | "ADC" | "SUP";
export type DraftSide = "blue" | "red";
export type DraftSlotType = "pick" | "ban";

export interface Champion {
  id: string;
  key: string;
  display_name: string;
  primary_role: RoleCode | null;
}

export interface Draft {
  id: string;
  match_id: string;
  blue_team_id: string | null;
  red_team_id: string | null;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftSlotRow {
  id: string;
  draft_id: string;
  side: DraftSide;
  slot_type: DraftSlotType;
  slot_index: number;
  role: RoleCode | null;
  champion_id: string | null;
}
