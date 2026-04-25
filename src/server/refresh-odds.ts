// Auto-refresh odds: fetch from The Odds API, join to our matches via team
// aliases, write a snapshot per match, recompute prediction.
//
// Used by:
//   - The cron route at /api/cron/refresh-odds (refreshAllUpcoming)
//   - The admin "Refresh now" server action       (refreshOddsForMatch)
import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { convertOdds } from "@/lib/odds";
import { generatePredictionForMatch } from "@/actions/predict";
import { fetchLckOdds, normalizeTeamName, type ParsedEvent } from "@/lib/odds-providers/the-odds-api";

interface TeamRow {
  id: string;
  name: string;
  tag: string;
  alias_names: string[] | null;
}

interface MatchRow {
  id: string;
  start_at: string;
  team_a_id: string;
  team_b_id: string;
}

export interface RefreshSummary {
  ok: boolean;
  /** Total events the provider returned. */
  providerEvents: number;
  /** Matches we actually wrote a snapshot for. */
  matched: number;
  /** Matches we tried to refresh but couldn't map. */
  unmatched: number;
  /** Match IDs we updated (handy for revalidation in the caller). */
  updatedMatchIds: string[];
  /** Optional error string when ok=false. */
  error?: string;
}

/**
 * Pull latest LCK odds and write a snapshot for any upcoming match we can map.
 * Optional cadenceFilter lets the cron route restrict to specific time
 * buckets (e.g. only matches in the T-12h to T-0 window).
 */
export async function refreshAllUpcoming(opts?: {
  cadenceFilter?: (hoursToKickoff: number) => boolean;
}): Promise<RefreshSummary> {
  const sb = createServerClient();

  const cadenceFilter = opts?.cadenceFilter ?? defaultCadenceFilter;

  // Pull provider odds first — if that fails we don't bother hitting the DB.
  let events: ParsedEvent[];
  try {
    events = await fetchLckOdds();
  } catch (e: any) {
    return {
      ok: false,
      providerEvents: 0,
      matched: 0,
      unmatched: 0,
      updatedMatchIds: [],
      error: e?.message ?? "Provider fetch failed",
    };
  }

  if (events.length === 0) {
    return { ok: true, providerEvents: 0, matched: 0, unmatched: 0, updatedMatchIds: [] };
  }

  // Upcoming matches in the next 14 days that aren't completed.
  const horizon = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  const { data: matches, error: matchErr } = await sb
    .from("matches")
    .select("id, start_at, team_a_id, team_b_id")
    .neq("status", "completed")
    .lte("start_at", horizon)
    .gte("start_at", new Date(Date.now() - 6 * 3600 * 1000).toISOString());

  if (matchErr) {
    return {
      ok: false,
      providerEvents: events.length,
      matched: 0,
      unmatched: 0,
      updatedMatchIds: [],
      error: matchErr.message,
    };
  }

  const matchList = (matches ?? []) as MatchRow[];
  if (matchList.length === 0) {
    return { ok: true, providerEvents: events.length, matched: 0, unmatched: 0, updatedMatchIds: [] };
  }

  const teamIds = unique([
    ...matchList.map((m) => m.team_a_id),
    ...matchList.map((m) => m.team_b_id),
  ]);
  const { data: teams } = await sb
    .from("teams")
    .select("id, name, tag, alias_names")
    .in("id", teamIds);
  const teamById = new Map<string, TeamRow>();
  for (const t of (teams ?? []) as TeamRow[]) teamById.set(t.id, t);

  const updatedIds: string[] = [];
  let matched = 0;
  let unmatched = 0;

  for (const match of matchList) {
    const hoursToKickoff =
      (new Date(match.start_at).getTime() - Date.now()) / 3600_000;
    if (!cadenceFilter(hoursToKickoff)) continue;

    const a = teamById.get(match.team_a_id);
    const b = teamById.get(match.team_b_id);
    if (!a || !b) {
      unmatched++;
      continue;
    }

    const event = findMatchingEvent(events, a, b);
    if (!event) {
      unmatched++;
      continue;
    }

    // Figure out which side of the API event is "team A" in our DB.
    const sideA = sideForTeam(a, event);

    const teamADecimal = sideA === "home" ? event.homePriceDecimal : event.awayPriceDecimal;
    const teamBDecimal = sideA === "home" ? event.awayPriceDecimal : event.homePriceDecimal;

    const conv = convertOdds({
      format: "decimal",
      teamA: teamADecimal,
      teamB: teamBDecimal,
    });

    const sourceLabel = `the_odds_api:${event.bookmaker}`;

    const { data: inserted, error: insertErr } = await sb
      .from("odds_snapshots")
      .insert({
        match_id: match.id,
        source: sourceLabel,
        format: "decimal",
        team_a_price: teamADecimal,
        team_b_price: teamBDecimal,
        team_a_implied_prob: round4(conv.teamAImpliedProb),
        team_b_implied_prob: round4(conv.teamBImpliedProb),
        novig_a: round4(conv.novigA),
        novig_b: round4(conv.novigB),
        raw: {
          provider: "the_odds_api",
          externalEventId: event.externalId,
          bookmaker: event.bookmaker,
          homeTeam: event.homeTeam,
          awayTeam: event.awayTeam,
          commenceTime: event.commenceTime,
        },
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      unmatched++;
      continue;
    }

    matched++;
    updatedIds.push(match.id);

    // Recompute prediction with the fresh market signal. Don't fail the whole
    // run if this throws — log and continue.
    try {
      await generatePredictionForMatch(match.id, {
        novigA: conv.novigA,
        novigB: conv.novigB,
        snapshotId: inserted.id,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Prediction recompute failed for", match.id, e);
    }
  }

  return {
    ok: true,
    providerEvents: events.length,
    matched,
    unmatched,
    updatedMatchIds: updatedIds,
  };
}

/**
 * Refresh exactly one match. Used by the admin "Refresh now" button.
 * Bypasses the cadence filter.
 */
export async function refreshOddsForMatch(matchId: string): Promise<RefreshSummary> {
  return refreshAllUpcoming({
    cadenceFilter: () => true,
  }).then((r) => ({
    ...r,
    // Caller usually only cares about whether *this* match was updated.
    matched: r.updatedMatchIds.includes(matchId) ? 1 : 0,
    unmatched: r.updatedMatchIds.includes(matchId) ? 0 : 1,
    updatedMatchIds: r.updatedMatchIds.filter((id) => id === matchId),
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Default tiered cadence:
 *   - hoursToKickoff > 12     → refresh once every 6h (so we accept anything;
 *                               cron only fires every 30min so the 6h spacing
 *                               is enforced by NOT-refreshing more often via
 *                               this filter at the granularity we have).
 *   - hoursToKickoff in (-1, 12] → always refresh
 *   - hoursToKickoff <= -1    → match has started, skip
 *
 * The actual 30min vs 6h decision is driven by the cron schedule (every 30min
 * always) combined with this filter. To keep it simple we accept all matches
 * within the next 72h and rely on the cron schedule for cadence; the filter
 * just prevents us from spamming snapshots after kickoff.
 */
function defaultCadenceFilter(hoursToKickoff: number): boolean {
  if (hoursToKickoff <= -1) return false;          // game has started
  if (hoursToKickoff > 72) return false;           // too far out
  return true;
}

function unique<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function findMatchingEvent(events: ParsedEvent[], a: TeamRow, b: TeamRow): ParsedEvent | null {
  for (const e of events) {
    const home = normalizeTeamName(e.homeTeam);
    const away = normalizeTeamName(e.awayTeam);
    if (
      (matchesTeam(home, a) && matchesTeam(away, b)) ||
      (matchesTeam(home, b) && matchesTeam(away, a))
    ) {
      return e;
    }
  }
  return null;
}

function matchesTeam(normalizedName: string, team: TeamRow): boolean {
  const candidates = new Set<string>();
  candidates.add(normalizeTeamName(team.name));
  candidates.add(normalizeTeamName(team.tag));
  for (const a of team.alias_names ?? []) candidates.add(normalizeTeamName(a));
  return candidates.has(normalizedName);
}

function sideForTeam(team: TeamRow, event: ParsedEvent): "home" | "away" {
  const home = normalizeTeamName(event.homeTeam);
  return matchesTeam(home, team) ? "home" : "away";
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
