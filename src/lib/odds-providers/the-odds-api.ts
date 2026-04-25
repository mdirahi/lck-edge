// The Odds API (the-odds-api.com) integration.
//
// Strategy:
//   1. Discover the active LoL/LCK sport key once per call (cached in-process).
//   2. Hit /odds for that sport, regions=us,eu, h2h market, decimal format.
//   3. For each event, pick a single book to record:
//        - prefer Pinnacle if present (sharpest line)
//        - else fall back to the first bookmaker in the response
//      We record only one book per snapshot to keep the schema simple — the
//      caller can call refresh again if the line moves.
//
// The output is shape-stable: callers use mapTheOddsApiEventsToMatches() to
// join against our DB by team aliases.
import "server-only";

const BASE = "https://api.the-odds-api.com/v4";

export interface TheOddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;            // ISO timestamp
  home_team: string;
  away_team: string;
  bookmakers: TheOddsApiBookmaker[];
}

export interface TheOddsApiBookmaker {
  key: string;        // e.g. "pinnacle", "draftkings"
  title: string;
  last_update: string;
  markets: { key: string; outcomes: { name: string; price: number }[] }[];
}

export interface ParsedEvent {
  /** Provider event id, useful for debugging only. */
  externalId: string;
  /** ISO start time. */
  commenceTime: string;
  /** Raw provider names — caller maps these to our teams.id via aliases. */
  homeTeam: string;
  awayTeam: string;
  /** Selected book key, e.g. "pinnacle". */
  bookmaker: string;
  /** Decimal odds for each side. */
  homePriceDecimal: number;
  awayPriceDecimal: number;
}

interface SportRow {
  key: string;
  group: string;
  title: string;
  active: boolean;
  has_outrights: boolean;
}

let cachedLolKey: string | null = null;
let cachedAt = 0;
const SPORT_TTL_MS = 6 * 3600 * 1000;

/**
 * Resolve the active LoL sport key. The Odds API has used different keys over
 * time: 'esports_lol', 'league_of_legends', 'esports_league_of_legends', etc.
 * We auto-detect to stay resilient.
 */
async function resolveLolSportKey(apiKey: string): Promise<string | null> {
  if (cachedLolKey && Date.now() - cachedAt < SPORT_TTL_MS) return cachedLolKey;

  const url = `${BASE}/sports/?all=true&apiKey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`The Odds API /sports failed: ${res.status} ${res.statusText}`);
  }
  const rows = (await res.json()) as SportRow[];

  // Prefer an active LCK-specific key, then any LoL key, then first esports row.
  const isLol = (k: string) =>
    /league[-_ ]?of[-_ ]?legends/i.test(k) || /\blol\b/i.test(k);
  const isLck = (s: SportRow) => /lck/i.test(s.key) || /lck/i.test(s.title);

  const lck = rows.find((s) => s.active && isLck(s));
  const lol = rows.find((s) => s.active && isLol(s.key));
  const fallback = rows.find((s) => s.active && /esports/i.test(s.group));

  cachedLolKey = lck?.key ?? lol?.key ?? fallback?.key ?? null;
  cachedAt = Date.now();
  return cachedLolKey;
}

/**
 * Fetch upcoming LoL/LCK events with one selected bookmaker line each.
 * Returns [] if no API key is configured (so callers can no-op safely).
 */
export async function fetchLckOdds(): Promise<ParsedEvent[]> {
  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) return [];

  const sportKey = await resolveLolSportKey(apiKey);
  if (!sportKey) return [];

  const params = new URLSearchParams({
    apiKey,
    regions: "us,eu",
    markets: "h2h",
    oddsFormat: "decimal",
    dateFormat: "iso",
  });
  const url = `${BASE}/sports/${encodeURIComponent(sportKey)}/odds/?${params}`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `The Odds API /odds failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`
    );
  }

  const events = (await res.json()) as TheOddsApiEvent[];
  const parsed: ParsedEvent[] = [];
  for (const e of events) {
    const pick = pickBookmaker(e);
    if (!pick) continue;
    parsed.push({
      externalId: e.id,
      commenceTime: e.commence_time,
      homeTeam: e.home_team,
      awayTeam: e.away_team,
      bookmaker: pick.book,
      homePriceDecimal: pick.home,
      awayPriceDecimal: pick.away,
    });
  }
  return parsed;
}

/**
 * Pick one book per event:
 *   - prefer Pinnacle if listed
 *   - else first available with a 2-way h2h price
 */
function pickBookmaker(
  e: TheOddsApiEvent
): { book: string; home: number; away: number } | null {
  if (!e.bookmakers?.length) return null;

  const prefOrder = ["pinnacle", "betonlineag", "draftkings", "fanduel"];
  const candidates = [...e.bookmakers].sort((a, b) => {
    const ai = prefOrder.indexOf(a.key);
    const bi = prefOrder.indexOf(b.key);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  for (const book of candidates) {
    const h2h = book.markets.find((m) => m.key === "h2h");
    if (!h2h || h2h.outcomes.length < 2) continue;
    const home = h2h.outcomes.find((o) => o.name === e.home_team)?.price;
    const away = h2h.outcomes.find((o) => o.name === e.away_team)?.price;
    if (!home || !away || home <= 1 || away <= 1) continue;
    return { book: book.key, home, away };
  }
  return null;
}

/** Lower-case + collapse spaces for alias comparison. */
export function normalizeTeamName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
