/**
 * Champion name normalizer.
 *
 * Maps a loose champion name string (from Claude vision output, broadcast
 * overlay OCR, pasted from chat, etc.) to a row in the champions table.
 * Designed to be forgiving about apostrophes, spaces, and casing while
 * refusing to confidently match obvious misses.
 */

import type { Champion } from "./types.ts";

export type MatchConfidence = "exact" | "normalized" | "prefix" | "none";

export interface MatchResult {
  championId: string | null;
  championDisplayName: string | null;
  confidence: MatchConfidence;
}

/** Lowercase, strip spaces and non-alphanumerics. "K'Sante" → "ksante". */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Find the best match for `input` among `champions`. Returns the first
 * unambiguous match found, or a "none" result if nothing matches confidently.
 *
 * Tier order:
 *   1. exact display_name (case-insensitive)
 *   2. normalized display_name (strip punctuation/whitespace)
 *   3. input is a prefix of a single normalized display_name
 *
 * Prefix matches are only returned when exactly one candidate matches —
 * otherwise ambiguous prefixes ("Ka" → Karma/Karthus/Kassadin/…) return none.
 */
export function matchChampionName(
  input: string | null | undefined,
  champions: Champion[]
): MatchResult {
  if (!input) return emptyResult();
  const trimmed = input.trim();
  if (!trimmed) return emptyResult();

  // Tier 1: exact case-insensitive
  for (const c of champions) {
    if (c.display_name.toLowerCase() === trimmed.toLowerCase()) {
      return { championId: c.id, championDisplayName: c.display_name, confidence: "exact" };
    }
  }

  // Tier 2: normalized equality
  const inputNorm = norm(trimmed);
  if (inputNorm.length === 0) return emptyResult();
  for (const c of champions) {
    if (norm(c.display_name) === inputNorm) {
      return { championId: c.id, championDisplayName: c.display_name, confidence: "normalized" };
    }
  }

  // Tier 3: unambiguous prefix
  const prefixHits = champions.filter((c) =>
    norm(c.display_name).startsWith(inputNorm)
  );
  if (prefixHits.length === 1) {
    return {
      championId: prefixHits[0].id,
      championDisplayName: prefixHits[0].display_name,
      confidence: "prefix",
    };
  }

  return emptyResult();
}

function emptyResult(): MatchResult {
  return { championId: null, championDisplayName: null, confidence: "none" };
}
