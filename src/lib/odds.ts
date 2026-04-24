/**
 * Odds math utilities.
 *
 * Every public function is pure (no I/O). Tests live next to this file in odds.test.ts.
 *
 * Format conventions:
 *   "decimal"      -> European decimal odds, e.g. 1.85 meaning a $1 bet returns $1.85 total.
 *   "american"     -> US odds, e.g. -150 (favorite) or +130 (underdog).
 *   "implied_prob" -> Already a probability in [0,1], e.g. a prediction-market price of 0.57.
 */

export type OddsFormat = "decimal" | "american" | "implied_prob";

export interface OddsInput {
  format: OddsFormat;
  teamA: number;
  teamB: number;
}

export interface OddsResult {
  teamAImpliedProb: number;   // raw implied prob (includes vig if any)
  teamBImpliedProb: number;
  overround: number;          // sum of implied probs; > 1 means the book has vig
  novigA: number;             // vig-removed probability for A
  novigB: number;             // vig-removed probability for B
}

/**
 * Parse a user-typed string into the numeric value priceToImpliedProb expects.
 * Accepts common shorthand:
 *   decimal      -> "1.85", " 2.20 "
 *   american     -> "-150", "+120", "120"
 *   implied_prob -> "62", "62%", "0.62", "55 %"
 *
 * Throws a human-readable Error if the string can't be parsed.
 */
export function parseOddsInput(raw: string, format: OddsFormat): number {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) throw new Error("Enter a price");

  if (format === "decimal") {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) throw new Error(`"${trimmed}" is not a valid decimal odds value`);
    if (n <= 1) throw new Error(`Decimal odds must be greater than 1 (got ${n})`);
    return n;
  }

  if (format === "american") {
    // Strip a leading "+" so "+120" parses. "-150" keeps its minus.
    const cleaned = trimmed.replace(/^\+/, "");
    const n = Number(cleaned);
    if (!Number.isFinite(n)) throw new Error(`"${trimmed}" is not a valid American odds value`);
    if (n === 0) throw new Error("American odds cannot be 0");
    if (n > -100 && n < 100) {
      throw new Error(`American odds must be <= -100 or >= +100 (got ${n})`);
    }
    return n;
  }

  if (format === "implied_prob") {
    const hasPercent = trimmed.endsWith("%");
    const core = (hasPercent ? trimmed.slice(0, -1) : trimmed).trim();
    const n = Number(core);
    if (!Number.isFinite(n)) throw new Error(`"${trimmed}" is not a valid probability`);
    // A trailing "%" or a bare number > 1 means the user typed a percentage.
    if (hasPercent || n > 1) {
      if (n < 0 || n > 100) throw new Error(`Probability must be between 0 and 100 (got ${n})`);
      return n / 100;
    }
    if (n < 0 || n > 1) throw new Error(`Probability must be between 0 and 1 (got ${n})`);
    return n;
  }

  throw new Error(`Unknown format: ${format}`);
}

/** Convert a single price in the given format to an implied probability in [0,1]. */
export function priceToImpliedProb(price: number, format: OddsFormat): number {
  if (!Number.isFinite(price)) {
    throw new Error(`Price is not finite: ${price}`);
  }
  if (format === "decimal") {
    if (price <= 1) throw new Error("Decimal odds must be > 1");
    return 1 / price;
  }
  if (format === "american") {
    if (price === 0) throw new Error("American odds cannot be 0");
    if (price > 0) return 100 / (price + 100);
    return Math.abs(price) / (Math.abs(price) + 100);
  }
  if (format === "implied_prob") {
    if (price < 0 || price > 1) throw new Error("Implied prob must be in [0,1]");
    return price;
  }
  throw new Error(`Unknown format: ${format}`);
}

/** Take two sides' prices and return implied + vig-removed probabilities. */
export function convertOdds(input: OddsInput): OddsResult {
  const a = priceToImpliedProb(input.teamA, input.format);
  const b = priceToImpliedProb(input.teamB, input.format);
  const sum = a + b;
  if (sum <= 0) throw new Error("Implied probs sum to zero");
  return {
    teamAImpliedProb: a,
    teamBImpliedProb: b,
    overround: sum,
    novigA: a / sum,
    novigB: b / sum,
  };
}

/** Format a probability in [0,1] as a readable "54.1%" string. */
export function formatProb(p: number, digits = 1): string {
  return `${(p * 100).toFixed(digits)}%`;
}

/** Edge: positive = model thinks A is more likely than the market does (after vig removal). */
export function edge(modelProbA: number, novigA: number): number {
  return modelProbA - novigA;
}

/**
 * Convert a model's two team scores (0..100 each) into a probability for team A.
 * Uses the softmax-style ratio described in the plan doc, with an optional power k
 * that widens the gap for stronger signals.
 */
export function scoresToProb(teamA: number, teamB: number, k = 1.3): number {
  if (teamA <= 0 && teamB <= 0) return 0.5;
  const a = Math.pow(Math.max(teamA, 0.0001), k);
  const b = Math.pow(Math.max(teamB, 0.0001), k);
  return a / (a + b);
}

/** Blend the model's probability with the market's vig-removed probability by confidence. */
export function blendByConfidence(
  modelProbA: number,
  novigA: number,
  confidence: "low" | "medium" | "high"
): number {
  const weights = { high: 0.85, medium: 0.6, low: 0.35 } as const;
  const w = weights[confidence];
  return w * modelProbA + (1 - w) * novigA;
}

/** Decide play/watch/avoid based on edge size + confidence. */
export function recommend(
  modelProbA: number,
  novigA: number,
  confidence: "low" | "medium" | "high"
): "play" | "watch" | "avoid" {
  const e = Math.abs(edge(modelProbA, novigA));
  if (confidence === "low" && e < 0.03) return "avoid";
  if (e >= 0.05 && confidence !== "low") return "play";
  return "watch";
}
