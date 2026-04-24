/**
 * Companion to ingest-leaguepedia: for every completed match we have in the DB
 * from LCK 2026 Spring, pull the PicksAndBansS7 cargo table and upsert a draft
 * plus draft_slots for game 1.
 *
 * Keeps it simple: one draft per match (game 1), which is what our schema
 * assumes. Upsert semantics match saveDraftAction.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npm run ingest:drafts
 *
 * Env:
 *   LP_OVERVIEW="LCK/2026 Season/Spring Season"
 *   LP_DRY_RUN=1
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { matchChampionName } from "../src/lib/championNameNormalizer.ts";
import type { Champion, RoleCode } from "../src/lib/types.ts";

const LP_API = "https://lol.fandom.com/wiki/Special:CargoExport";
const OVERVIEW = process.env.LP_OVERVIEW ?? "LCK/2026 Season/Spring Season";
const DRY_RUN = process.env.LP_DRY_RUN === "1";

interface PnBRow {
  GameId: string;
  Team1: string;
  Team2: string;
  Winner: string | null;
  DateTime_UTC: string;
  // Blue side
  Team1Ban1: string | null; Team1Ban2: string | null; Team1Ban3: string | null; Team1Ban4: string | null; Team1Ban5: string | null;
  Team1Pick1: string | null; Team1Pick2: string | null; Team1Pick3: string | null; Team1Pick4: string | null; Team1Pick5: string | null;
  Team1Role1: string | null; Team1Role2: string | null; Team1Role3: string | null; Team1Role4: string | null; Team1Role5: string | null;
  // Red side
  Team2Ban1: string | null; Team2Ban2: string | null; Team2Ban3: string | null; Team2Ban4: string | null; Team2Ban5: string | null;
  Team2Pick1: string | null; Team2Pick2: string | null; Team2Pick3: string | null; Team2Pick4: string | null; Team2Pick5: string | null;
  Team2Role1: string | null; Team2Role2: string | null; Team2Role3: string | null; Team2Role4: string | null; Team2Role5: string | null;
  OverviewPage: string;
  Tab: string | null;
  N_GameInMatch: string | null; // "1" for first game of the series
}

const ROLE_MAP: Record<string, RoleCode> = {
  Top: "TOP", Jungle: "JNG", Mid: "MID", Bot: "ADC", Support: "SUP",
  TOP: "TOP", JNG: "JNG", MID: "MID", ADC: "ADC", SUP: "SUP",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cargoQuery<T>(params: {
  tables: string; fields: string; where: string; orderBy?: string; limit?: number; joinOn?: string;
}): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  const pageSize = params.limit ?? 500;
  while (true) {
    const qs = new URLSearchParams({
      tables: params.tables, fields: params.fields, where: params.where,
      limit: String(pageSize), offset: String(offset), format: "json",
    });
    if (params.orderBy) qs.set("order_by", params.orderBy);
    if (params.joinOn) qs.set("join_on", params.joinOn);

    let attempt = 0;
    let body: any;
    while (true) {
      const res = await fetch(`${LP_API}?${qs}`, {
        headers: { "User-Agent": "lck-edge/0.1 (contact: admin; internal LCK analytics)" },
      });
      if (!res.ok) {
        const text = await res.text();
        if ((res.status === 429 || res.status >= 500) && attempt < 5) {
          const wait = 2000 * Math.pow(2, attempt);
          console.warn(`  [retry] HTTP ${res.status}, waiting ${wait}ms`);
          await sleep(wait); attempt++; continue;
        }
        throw new Error(`cargo HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const raw = await res.text();
      try { body = JSON.parse(raw); } catch (e) {
        console.error(`  [cargo] URL: ${LP_API}?${qs}`);
        console.error(`  [cargo] non-JSON response body (first 500 chars):`);
        console.error(`  ${raw.slice(0, 500)}`);
        throw new Error(`cargo: non-JSON response: ${String(e)}`);
      }
      break;
    }

    const rawRows: any[] = Array.isArray(body) ? body : ((body.cargoquery ?? []).map((r: any) => r.title));
    // CargoExport returns field names with spaces (e.g. "DateTime UTC"); normalize to underscores.
    const rows: T[] = rawRows.map((raw: any) => {
      const norm: any = {};
      for (const [k, v] of Object.entries(raw)) norm[k.replace(/ /g, "_")] = v;
      return norm as T;
    });
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
    await sleep(500);
  }
  return all;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env vars");
    process.exit(1);
  }
  const sb = createClient(url, key);

  console.log(`[drafts] OverviewPage=${OVERVIEW} dryRun=${DRY_RUN}`);

  // Load champions once for name normalization.
  const { data: champRows, error: champErr } = await sb
    .from("champions")
    .select("id, display_name, primary_role");
  if (champErr || !champRows) {
    console.error("Failed to load champions:", champErr);
    process.exit(1);
  }
  const champions = champRows as Champion[];

  // Pull picks and bans for all games in the tournament. We'll only use game 1.
  console.log("[drafts] fetching PicksAndBansS7...");
  const fieldList = [
    "P.GameId=GameId", "P.Team1=Team1", "P.Team2=Team2", "P.Winner=Winner",
    "SG.DateTime_UTC=DateTime_UTC", "P.OverviewPage=OverviewPage", "P.Tab=Tab",
    "P.N_GameInMatch=N_GameInMatch",
    "P.Team1Ban1=Team1Ban1", "P.Team1Ban2=Team1Ban2", "P.Team1Ban3=Team1Ban3", "P.Team1Ban4=Team1Ban4", "P.Team1Ban5=Team1Ban5",
    "P.Team1Pick1=Team1Pick1", "P.Team1Pick2=Team1Pick2", "P.Team1Pick3=Team1Pick3", "P.Team1Pick4=Team1Pick4", "P.Team1Pick5=Team1Pick5",
    "P.Team1Role1=Team1Role1", "P.Team1Role2=Team1Role2", "P.Team1Role3=Team1Role3", "P.Team1Role4=Team1Role4", "P.Team1Role5=Team1Role5",
    "P.Team2Ban1=Team2Ban1", "P.Team2Ban2=Team2Ban2", "P.Team2Ban3=Team2Ban3", "P.Team2Ban4=Team2Ban4", "P.Team2Ban5=Team2Ban5",
    "P.Team2Pick1=Team2Pick1", "P.Team2Pick2=Team2Pick2", "P.Team2Pick3=Team2Pick3", "P.Team2Pick4=Team2Pick4", "P.Team2Pick5=Team2Pick5",
    "P.Team2Role1=Team2Role1", "P.Team2Role2=Team2Role2", "P.Team2Role3=Team2Role3", "P.Team2Role4=Team2Role4", "P.Team2Role5=Team2Role5",
  ].join(",");

  const rows = await cargoQuery<PnBRow>({
    tables: "PicksAndBansS7=P,ScoreboardGames=SG",
    joinOn: "P.GameId=SG.GameId",
    fields: fieldList,
    where: `P.OverviewPage="${OVERVIEW}" AND P.N_GameInMatch="1"`,
    orderBy: "SG.DateTime_UTC ASC",
  });
  console.log(`[drafts]  ${rows.length} game-1 drafts`);
  if (rows.length > 0) {
    console.log(`[drafts]  first row keys: ${Object.keys(rows[0] as any).join(", ")}`);
    console.log(`[drafts]  first row sample: ${JSON.stringify(rows[0], null, 2).slice(0, 600)}`);
  }

  // Dump the first row with real data so we can see what Leaguepedia actually sends.
  const firstReal = rows.find((r) => (r as any).DateTime_UTC && (r as any).Team1Pick1);
  if (firstReal) {
    console.log(`[drafts]  first completed row (full dump):`);
    console.log(JSON.stringify(firstReal, null, 2));
  }

  let upserted = 0;
  let skipped = 0;
  const missingChamps = new Set<string>();

  for (const r of rows) {
    const rawDt = (r as any).DateTime_UTC ?? (r as any)["DateTime UTC"] ?? (r as any).DateTime;
    if (!rawDt) {
      console.warn(`  no DateTime for ${r.Team1} vs ${r.Team2}, skipping`);
      skipped++;
      continue;
    }
    const startAtIso = new Date(String(rawDt) + "Z").toISOString();

    // Look up the match using the unique (team_a_id, team_b_id, start_at) constraint.
    const [{ data: teamA }, { data: teamB }] = await Promise.all([
      sb.from("teams").select("id").eq("name", r.Team1).maybeSingle(),
      sb.from("teams").select("id").eq("name", r.Team2).maybeSingle(),
    ]);
    if (!teamA || !teamB) {
      console.warn(`  team not found for ${r.Team1} vs ${r.Team2}, skipping`);
      skipped++;
      continue;
    }

    // ScoreboardGames time differs from MatchSchedule time (kickoff vs scheduled),
    // and team order in ScoreboardGames reflects blue/red for that specific game
    // rather than series ordering. Match by either ordering within a day window.
    const startMs = new Date(startAtIso).getTime();
    const windowStart = new Date(startMs - 12 * 3600 * 1000).toISOString();
    const windowEnd = new Date(startMs + 12 * 3600 * 1000).toISOString();
    const { data: matchCandidates } = await sb
      .from("matches").select("id, team_a_id, team_b_id, start_at")
      .or(
        `and(team_a_id.eq.${teamA.id},team_b_id.eq.${teamB.id}),` +
        `and(team_a_id.eq.${teamB.id},team_b_id.eq.${teamA.id})`
      )
      .gte("start_at", windowStart).lte("start_at", windowEnd)
      .order("start_at", { ascending: true });
    const match = matchCandidates?.[0];
    if (!match) {
      // Diagnostic: find ANY match between these teams, without time filter.
      const { data: allCandidates, count: totalMatchCount } = await sb
        .from("matches").select("id, team_a_id, team_b_id, start_at", { count: "exact" })
        .or(
          `and(team_a_id.eq.${teamA.id},team_b_id.eq.${teamB.id}),` +
          `and(team_a_id.eq.${teamB.id},team_b_id.eq.${teamA.id})`
        )
        .order("start_at", { ascending: true });
      if (skipped < 3) {
        const { count: allMatches } = await sb.from("matches").select("id", { count: "exact", head: true });
        console.warn(`  match not found for ${r.Team1} vs ${r.Team2} @ ${startAtIso}`);
        console.warn(`    window: ${windowStart} → ${windowEnd}`);
        console.warn(`    teamA.id=${teamA.id} teamB.id=${teamB.id}`);
        console.warn(`    matches for this pair (any time): ${allCandidates?.length ?? 0}`);
        if (allCandidates && allCandidates.length > 0) {
          console.warn(`    sample: ${JSON.stringify(allCandidates.slice(0, 3))}`);
        }
        console.warn(`    total matches in DB: ${allMatches}`);
      } else {
        console.warn(`  match not found for ${r.Team1} vs ${r.Team2} @ ${startAtIso}, skipping`);
      }
      skipped++;
      continue;
    }

    // Build slot rows. In our schema, side "A" = blue (= Team1 here).
    const slots: Array<{
      side: "blue" | "red"; slot_type: "pick" | "ban"; slot_index: number;
      role: RoleCode | null; champion_id: string | null;
    }> = [];

    const pushSlot = (
      side: "blue" | "red", kind: "pick" | "ban", idx: number,
      champName: string | null, roleRaw: string | null
    ) => {
      if (!champName) return;
      const matched = matchChampionName(champName, champions);
      if (!matched.championId) {
        missingChamps.add(champName);
        return;
      }
      const role = kind === "pick" && roleRaw ? (ROLE_MAP[roleRaw] ?? null) : null;
      slots.push({
        side, slot_type: kind, slot_index: idx,
        role, champion_id: matched.championId,
      });
    };

    for (let i = 0; i < 5; i++) {
      const n = i + 1;
      pushSlot("blue", "ban", i, (r as any)[`Team1Ban${n}`], null);
      pushSlot("red", "ban", i, (r as any)[`Team2Ban${n}`], null);
      pushSlot("blue", "pick", i, (r as any)[`Team1Pick${n}`], (r as any)[`Team1Role${n}`]);
      pushSlot("red", "pick", i, (r as any)[`Team2Pick${n}`], (r as any)[`Team2Role${n}`]);
    }

    if (slots.length === 0) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry] ${r.Team1} vs ${r.Team2} @ ${startAtIso}  ${slots.length} slots`);
      upserted++;
      continue;
    }

    // Upsert draft row.
    const { data: draft, error: dErr } = await sb
      .from("drafts")
      .upsert(
        {
          match_id: match.id,
          blue_team_id: teamA.id,
          red_team_id: teamB.id,
          source: "leaguepedia",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "match_id" }
      )
      .select("id")
      .single();
    if (dErr || !draft) {
      console.error(`  draft upsert failed for match ${match.id}:`, dErr?.message);
      skipped++;
      continue;
    }

    // Wipe and re-insert slots, matching saveDraftAction's pattern.
    await sb.from("draft_slots").delete().eq("draft_id", draft.id);
    const rowsToInsert = slots.map((s) => ({
      draft_id: draft.id,
      side: s.side,
      slot_type: s.slot_type,
      slot_index: s.slot_index,
      role: s.role,
      champion_id: s.champion_id,
    }));
    const { error: sErr } = await sb.from("draft_slots").insert(rowsToInsert);
    if (sErr) {
      console.error(`  slot insert failed for match ${match.id}:`, sErr.message);
      skipped++;
      continue;
    }

    upserted++;
  }

  console.log(`[drafts] done. upserted=${upserted} skipped=${skipped}`);
  if (missingChamps.size > 0) {
    console.log(`[drafts] UNMATCHED champion names (likely missing from champions table):`);
    for (const name of Array.from(missingChamps).sort()) console.log(`  - ${name}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
