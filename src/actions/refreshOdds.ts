"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { refreshOddsForMatch } from "@/server/refresh-odds";

export interface RefreshOddsActionResult {
  ok: boolean;
  error: string;
  /** True if a fresh snapshot was actually written. False = no matching event found. */
  updated: boolean;
  /** The book that supplied the line, e.g. "pinnacle". Empty when no match. */
  bookmaker?: string;
}

/**
 * Admin-only: pull the latest odds for a single match from The Odds API and
 * write a snapshot. Used by the "Refresh now" button on the match detail page.
 */
export async function refreshOddsAction(matchId: string): Promise<RefreshOddsActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in", updated: false };
  if (me.role !== "admin") {
    return { ok: false, error: "Admin role required to refresh odds", updated: false };
  }

  if (!process.env.THE_ODDS_API_KEY) {
    return {
      ok: false,
      error: "THE_ODDS_API_KEY not configured on this deployment",
      updated: false,
    };
  }

  try {
    const summary = await refreshOddsForMatch(matchId);
    if (!summary.ok) {
      return { ok: false, error: summary.error ?? "Refresh failed", updated: false };
    }

    revalidatePath(`/matches/${matchId}`);

    await logAction({
      actor: me,
      action: "refreshOdds",
      targetType: "match",
      targetId: matchId,
      metadata: {
        providerEvents: summary.providerEvents,
        matched: summary.matched,
        unmatched: summary.unmatched,
      },
    });

    return {
      ok: true,
      error: "",
      updated: summary.matched > 0,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Refresh failed", updated: false };
  }
}
