/**
 * Seed the champions table from Riot's public Data Dragon.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npm run seed:champions
 *
 * Re-runs are safe (upsert on champions.key).
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env vars");
    process.exit(1);
  }
  const sb = createClient(url, key);

  // Pick the latest patch, then pull the champion list
  const versionsRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  const versions: string[] = await versionsRes.json();
  const version = versions[0];

  const champsRes = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );
  const body = await champsRes.json() as { data: Record<string, any> };

  // Data Dragon uses lowercase snake-case keys (e.g. "JarvanIV" → "jarvaniv")
  // to match what the existing seed did. Primary role left null — Data Dragon
  // doesn't provide LoL position data directly, and per-pick roles come from
  // Leaguepedia during ingest anyway.
  const rows = Object.values(body.data).map((c: any) => ({
    key: (c.id as string).toLowerCase(),
    display_name: c.name as string,
    primary_role: null as string | null,
  }));

  // Upsert in batches of 100 (onConflict on `key` preserves existing primary_role).
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await sb
      .from("champions")
      .upsert(batch, { onConflict: "key", ignoreDuplicates: false });
    if (error) {
      console.error("upsert failed at batch", i, error);
      process.exit(1);
    }
  }
  console.log(`Seeded ${rows.length} champions from Data Dragon ${version}.`);
}

main();
