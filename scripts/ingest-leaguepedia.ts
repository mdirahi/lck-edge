/**
 * One-shot backfill: pull LCK 2026 Spring matches from Leaguepedia's cargo API
 * and upsert them into our Supabase DB.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npm run ingest:leaguepedia
 *
 * Optional env:
 *   LP_OVERVIEW="LCK/2026 Season/Spring Season"   (default)
 *   LP_DRY_RUN=1                                  (print, don't write)
 *
 * Safe to re-run: upserts on (team_a_id, team_b_id, start_at) and
 * (name) for teams.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const LP_API = "https://lol.fandom.com/wiki/Special:CargoExport";
const OVERVIEW = process.env.LP_OVERVIEW ?? "LCK/2026 Season/Spring Season";
const DRY_RUN = process.env.LP_DRY_RUN === "1";

interface MatchScheduleRow {
  DateTime_UTC: string;
  Team1: string;
  Team2: string;
  Team1Score: string | null;
  Team2Score: string | null;
  Winner: string | null; // "1" | "2" | null
  BestOf: string | null;
  Tab: string | null;
  OverviewPage: string;
  Patch: string | null;
}

interface TeamsRow {
  Name: string;
  Short: string | null;
  Region: string | null;
  OverviewPage: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cargoQuery<T>(params: {
  tables: string;
  fields: string;
  where: string;
  orderBy?: string;
  limit?: number;
}): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  const pageSize = params.limit ?? 500;

  while (true) {
    const qs = new URLSearchParams({
      tables: params.tables,
      fields: params.fields,
      where: params.where,
      limit: String(pageSize),
      offset: String(offset),
      format: "json",
    });
    if (params.orderBy) qs.set("order_by", params.orderBy);

    // Retry on rate limit / transient errors with exponential backoff.
    let attempt = 0;
    let body: any;
    while (true) {
      if (attempt === 0 && offset === 0) {
        console.log(`  [url] ${LP_API}?${qs}`);
      }
      const res = await fetch(`${LP_API}?${qs}`, {
        headers: { "User-Agent": "lck-edge/0.1 (contact: admin; internal LCK analytics)" },
      });
      if (!res.ok) {
        const text = await res.text();
        if ((res.status === 429 || res.status >= 500) && attempt < 5) {
          const wait = 2000 * Math.pow(2, attempt);
          console.warn(`  [retry] HTTP ${res.status}, waiting ${wait}ms`);
          await sleep(wait);
          attempt++;
          continue;
        }
        throw new Error(`cargo HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      try { body = await res.json(); } catch (e) {
        throw new Error(`cargo: non-JSON response (likely rate limit page): ${String(e)}`);
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
    // Be gentle between pages.
    await sleep(500);
  }

  return all;
}

async function upsertTeam(
  sb: SupabaseClient,
  name: string,
  hints: { tag?: string | null; region?: string | null; slug?: string | null }
): Promise<string | null> {
  // 1. Exact match by name.
  const { data: byName } = await sb
    .from("teams")
    .select("id, name, tag, region, leaguepedia_slug")
    .eq("name", name)
    .maybeSingle();

  if (byName) {
    const patch: Record<string, unknown> = {};
    if (!byName.tag && hints.tag) patch.tag = hints.tag;
    if (!byName.region && hints.region) patch.region = hints.region;
    if (!byName.leaguepedia_slug && hints.slug) patch.leaguepedia_slug = hints.slug;
    if (Object.keys(patch).length && !DRY_RUN) {
      await sb.from("teams").update(patch).eq("id", byName.id);
    }
    return byName.id;
  }

  // 2. Fall back to tag match (handles "Dplus Kia" vs existing seed with tag "DK").
  //    If we find one, rename it to the Leaguepedia-canonical name and return its id.
  if (hints.tag) {
    const { data: byTag } = await sb
      .from("teams")
      .select("id, name, tag, region, leaguepedia_slug")
      .eq("tag", hints.tag)
      .maybeSingle();
    if (byTag) {
      if (!DRY_RUN) {
        const patch: Record<string, unknown> = { name };
        if (hints.region) patch.region = hints.region;
        if (hints.slug) patch.leaguepedia_slug = hints.slug;
        const { error } = await sb.from("teams").update(patch).eq("id", byTag.id);
        if (error) {
          console.error(`  tag-merge rename failed for ${name} (tag=${hints.tag}):`, error.message);
          return byTag.id;
        }
        console.log(`  [merge] renamed "${byTag.name}" -> "${name}" (tag=${hints.tag})`);
      }
      return byTag.id;
    }
  }

  if (DRY_RUN) {
    console.log(`  [dry] would create team ${name}`);
    return null;
  }

  // 3. Build a tag that won't collide. Start with the hint, fall back to derived.
  let tag = hints.tag ?? name.slice(0, 4).toUpperCase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: collision } = await sb
      .from("teams")
      .select("id")
      .eq("tag", tag)
      .maybeSingle();
    if (!collision) break;
    // Already taken by a team we couldn't match by name. Suffix and try again.
    tag = `${hints.tag ?? name.slice(0, 3).toUpperCase()}${attempt + 2}`.slice(0, 8);
  }

  const { data: created, error } = await sb
    .from("teams")
    .insert({
      name,
      tag,
      region: hints.region ?? "LCK",
      leaguepedia_slug: hints.slug ?? name.replace(/ /g, "_"),
    })
    .select("id")
    .single();

  if (error) {
    console.error(`  team insert failed for ${name}:`, error.message);
    return null;
  }
  return created.id;
}

async function ensurePatch(
  sb: SupabaseClient,
  version: string | null
): Promise<string | null> {
  if (!version) return null;
  const { data: existing } = await sb
    .from("patches")
    .select("id")
    .eq("version", version)
    .maybeSingle();
  if (existing) return existing.id;
  if (DRY_RUN) return null;
  const { data: created, error } = await sb
    .from("patches")
    .insert({ version, released_on: new Date().toISOString().slice(0, 10) })
    .select("id")
    .single();
  if (error) {
    console.error(`  patch insert failed for ${version}:`, error.message);
    return null;
  }
  return created.id;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }
  const sb = createClient(url, key);

  console.log(`[ingest] OverviewPage=${OVERVIEW} dryRun=${DRY_RUN}`);

  // 1. Pull the team list for the tournament so we have tag/region hints.
  console.log("[ingest] fetching Teams from Leaguepedia...");
  const teamRows = await cargoQuery<TeamsRow>({
    tables: "TournamentRosters,Teams",
    fields: "Teams.Name=Name, Teams.Short=Short, Teams.Region=Region, Teams.OverviewPage=OverviewPage",
    where: `TournamentRosters.OverviewPage="${OVERVIEW}" AND Teams.Name=TournamentRosters.Team`,
  }).catch(async () => {
    // Fall back to a simpler Teams query by region if the join fails.
    return cargoQuery<TeamsRow>({
      tables: "Teams",
      fields: "Teams.Name=Name, Teams.Short=Short, Teams.Region=Region, Teams.OverviewPage=OverviewPage",
      where: `Teams.Region="Korea"`,
    });
  });
  const hintsByName = new Map<string, { tag: string | null; region: string | null; slug: string }>();
  for (const t of teamRows) {
    hintsByName.set(t.Name, {
      tag: t.Short,
      region: t.Region === "Korea" ? "LCK" : t.Region,
      slug: t.OverviewPage,
    });
  }
  console.log(`[ingest]  ${teamRows.length} team hints`);

  // 2. Pull match schedule.
  console.log("[ingest] fetching MatchSchedule...");
  const matchRows = await cargoQuery<MatchScheduleRow>({
    tables: "MatchSchedule",
    fields:
      "MatchSchedule.DateTime_UTC, MatchSchedule.Team1, MatchSchedule.Team2, " +
      "MatchSchedule.Team1Score, MatchSchedule.Team2Score, MatchSchedule.Winner, " +
      "MatchSchedule.BestOf, MatchSchedule.Tab, MatchSchedule.OverviewPage, MatchSchedule.Patch",
    where: `MatchSchedule.OverviewPage="${OVERVIEW}"`,
    orderBy: "MatchSchedule.DateTime_UTC ASC",
  });
  console.log(`[ingest]  ${matchRows.length} matches`);

  let upserted = 0;
  let skipped = 0;
  let completed = 0;

  for (const m of matchRows) {
    if (!m.Team1 || !m.Team2 || !m.DateTime_UTC) {
      skipped++;
      continue;
    }
    // Leaguepedia uses "TBD" for unknown opponents in draws
    if (m.Team1 === "TBD" || m.Team2 === "TBD") {
      skipped++;
      continue;
    }

    const teamAId = await upsertTeam(sb, m.Team1, hintsByName.get(m.Team1) ?? {});
    const teamBId = await upsertTeam(sb, m.Team2, hintsByName.get(m.Team2) ?? {});
    if (!teamAId || !teamBId) {
      skipped++;
      continue;
    }

    const startAtIso = new Date(m.DateTime_UTC + "Z").toISOString();
    const bestOf = m.BestOf ? parseInt(m.BestOf, 10) : 3;
    const patchId = await ensurePatch(sb, m.Patch);

    // Leaguepedia returns Winner as either string "1"/"2" or number 1/2 depending on endpoint.
    const winnerNum = typeof m.Winner === "number" ? m.Winner : parseInt(String(m.Winner ?? ""), 10);
    const isCompleted = winnerNum === 1 || winnerNum === 2;
    const winnerTeamId = winnerNum === 1 ? teamAId : winnerNum === 2 ? teamBId : null;

    if (DRY_RUN) {
      console.log(
        `  [dry] ${startAtIso}  ${m.Team1} vs ${m.Team2}  ` +
          (isCompleted ? `(${m.Team1Score}-${m.Team2Score} W=${winnerTeamId === teamAId ? m.Team1 : m.Team2})` : "(scheduled)")
      );
      upserted++;
      continue;
    }

    // Try to find an existing match on the unique (team_a_id, team_b_id, start_at) pairing.
    const { data: existing } = await sb
      .from("matches")
      .select("id")
      .eq("team_a_id", teamAId)
      .eq("team_b_id", teamBId)
      .eq("start_at", startAtIso)
      .maybeSingle();

    const matchPayload = {
      start_at: startAtIso,
      status: isCompleted ? "completed" : "scheduled",
      best_of: bestOf,
      team_a_id: teamAId,
      team_b_id: teamBId,
      winner_team_id: winnerTeamId,
      patch_id: patchId,
      split: "2026 Spring",
    };

    if (existing) {
      const { error } = await sb.from("matches").update(matchPayload).eq("id", existing.id);
      if (error) {
        console.error(`  update failed ${m.Team1} vs ${m.Team2} @ ${startAtIso}:`, error.message);
        skipped++;
        continue;
      }
    } else {
      const { error } = await sb.from("matches").insert(matchPayload);
      if (error) {
        console.error(`  insert failed ${m.Team1} vs ${m.Team2} @ ${startAtIso}:`, error.message);
        skipped++;
        continue;
      }
    }
    upserted++;
    if (isCompleted) completed++;
  }

  console.log(`[ingest] done. upserted=${upserted} skipped=${skipped} completed=${completed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
