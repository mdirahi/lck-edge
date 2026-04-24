/**
 * Champion tiers for draft scoring (LCK 2026 Spring baseline).
 *
 * Everything here is TUNABLE and deliberately in one file — after a few
 * matches go by, come back and move champions between tiers based on what
 * actually got picked and won.
 *
 * Tiers:
 *   S = meta-defining priority pick
 *   A = strong, first-phase pick / ban worthy
 *   B = solid, reliable pick (DEFAULT when unknown)
 *   C = situational / comfort pick
 *   D = flex / off-meta / niche
 */

export type Tier = "S" | "A" | "B" | "C" | "D";

export const TIER_VALUE: Record<Tier, number> = {
  S: 1.00,
  A: 0.85,
  B: 0.70,
  C: 0.55,
  D: 0.40,
};

export const DEFAULT_TIER: Tier = "B";

// Multiplier applied when a champion is picked off their primary role.
// 0.90 is a modest 10% penalty. Raise toward 0.75 if you think flex picks
// are more costly; raise toward 1.0 to turn off the penalty entirely.
export const OFF_ROLE_PENALTY = 0.90;

// Keyed by display_name EXACTLY as stored in the champions table.
// Anything not listed here defaults to DEFAULT_TIER (B, 0.70).
// TODO: tune after first real week of data.
export const CHAMPION_TIERS: Record<string, Tier> = {
  // ---------- Top ----------
  "Aatrox": "A",
  "K'Sante": "A",
  "Gnar": "B",
  "Jax": "A",
  "Renekton": "B",
  "Gragas": "B",
  "Sion": "C",
  "Jayce": "A",
  "Sett": "B",
  "Ornn": "A",
  "Rumble": "B",
  "Camille": "B",
  "Fiora": "C",
  "Gwen": "B",
  "Olaf": "B",

  // ---------- Jungle ----------
  "Vi": "A",
  "Lee Sin": "A",
  "Nidalee": "B",
  "Sejuani": "A",
  "Viego": "B",
  "Wukong": "B",
  "Jarvan IV": "A",
  "Maokai": "B",
  "Poppy": "B",
  "Xin Zhao": "B",
  "Kindred": "C",
  "Graves": "B",
  "Elise": "B",

  // ---------- Mid ----------
  "Azir": "S",
  "Orianna": "A",
  "Ahri": "B",
  "Corki": "B",
  "Viktor": "B",
  "Tristana": "B",
  "Sylas": "A",
  "Hwei": "B",
  "Taliyah": "B",
  "LeBlanc": "B",
  "Akali": "B",
  "Yone": "B",
  "Yasuo": "C",
  "Galio": "B",

  // ---------- ADC ----------
  "Jinx": "A",
  "Kalista": "A",
  "Kai'Sa": "B",
  "Varus": "B",
  "Ashe": "B",
  "Xayah": "B",
  "Ezreal": "A",
  "Aphelios": "B",
  "Lucian": "B",
  "Caitlyn": "B",
  "Senna": "C",
  "Zeri": "C",

  // ---------- Support ----------
  "Nautilus": "A",
  "Rakan": "B",
  "Braum": "B",
  "Rell": "A",
  "Thresh": "B",
  "Leona": "B",
  "Alistar": "B",
  "Renata Glasc": "B",
  "Lulu": "B",
  "Karma": "B",
  "Bard": "C",
  "Pyke": "C",
};

/** Look up tier for a champion; falls back to DEFAULT_TIER. */
export function tierFor(displayName: string | null | undefined): Tier {
  if (!displayName) return DEFAULT_TIER;
  return CHAMPION_TIERS[displayName] ?? DEFAULT_TIER;
}
