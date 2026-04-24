# LCK Edge \u2014 MVP

Research and analysis tool for LCK matches. Not a sportsbook. Not a pick service. Every prediction is analytical support, not guaranteed betting advice.

## What this MVP does

- Lists upcoming and recent LCK matches (home page).
- Match detail page with team overview, player cards, manual-odds card, and a weighted-sum prediction.
- Manual odds entry for any source (Rainbet, Kalshi, a sportsbook screenshot, whatever). You type in the line; the app converts to implied probability, removes vig, compares against the model, and saves a snapshot.
- Transparent prediction scoring. Every factor is visible and tunable in one file.

## Stack

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS for styling
- Supabase (Postgres + auth + storage) as the database
- Zero other services required for the MVP

## First-time setup (follow in order)

### 1. Install prerequisites

- Node.js 20 or newer \u2014 <https://nodejs.org>
- Git \u2014 <https://git-scm.com>
- A Supabase account \u2014 <https://supabase.com> (free tier is enough)

### 2. Create a Supabase project

1. Log into Supabase, click "New Project".
2. Name it `lck-edge`. Pick any region close to you.
3. Wait a minute for it to provision.
4. Go to **Settings \u2192 API**. Copy three values:
   - Project URL
   - `anon` / `publishable` key
   - `service_role` key

### 3. Install the schema

1. In your Supabase project, open **SQL Editor**.
2. Open `supabase/schema.sql` from this repo, paste the whole file into the SQL editor, click **Run**.
3. Open `supabase/seed.sql`, paste it, click **Run**. You now have 10 LCK teams, a few star players, one upcoming match (Gen.G vs T1), and one completed match.

### 4. Configure the app

```bash
cp .env.local.example .env.local
# Edit .env.local and paste in the three values from step 2.
```

### 5. Install dependencies and run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. You should see the home page with at least one upcoming match. Click it.

### 6. Enter odds on the match page

On the match detail page, find the **Odds** card. Enter prices in American, Decimal, or Implied % format and click **Save & re-score**. The card will show implied probability, vig-removed fair probability, and the model-vs-market delta. A new row is written to `odds_snapshots` and a fresh `predictions` row is generated.

## How to add matches manually (until the Leaguepedia importer exists)

For now, add matches by editing `supabase/seed.sql` or running quick inserts in the Supabase SQL editor:

```sql
insert into matches (start_at, best_of, team_a_id, team_b_id, patch_id, split)
select now() + interval '1 day', 3, a.id, b.id, p.id, 'LCK 2026 Spring'
from teams a, teams b, patches p
where a.tag='KT' and b.tag='HLE' and p.version='16.6';
```

## Where to look when you want to change something

| You want to\u2026 | Edit this file |
|---|---|
| Tune the prediction weights | `src/lib/prediction.ts` (PREDICTION_WEIGHTS constant) |
| Change odds math / vig removal | `src/lib/odds.ts` |
| Tweak the match page layout | `src/app/matches/[id]/page.tsx` |
| Style the odds card | `src/components/OddsCard.tsx` |
| Update the DB shape | `supabase/schema.sql` (then re-run it) |

## Running tests

The odds and prediction libraries have Node's built-in test runner tests:

```bash
npm test
```

These are plain `node:test` tests, no extra frameworks. Good for sanity-checking math before a real match.

## What\u2019s intentionally NOT in this MVP

- No automated odds scraping. Manual entry only.
- No draft screenshot upload yet (schema is ready, UI will follow in v0.2).
- No authentication. Everything is read-public; writes go through server actions using the service role key.
- No scheduler job for pulling matches. Add matches via SQL until the Leaguepedia importer is built.
- No multi-league support. LCK only.

## Disclaimers

- This is a research tool. It does not guarantee outcomes. Betting markets are efficient enough that no analytical tool reliably beats them.
- Gamble only what you can afford to lose, and only if it is legal in your jurisdiction and you are of legal age.
- When displaying third-party odds, the app cites the source and timestamp. The app never acts as a bookmaker.
- Data attribution: teams, patches, and match data when imported come from Leaguepedia (CC BY-SA) and Oracle\u2019s Elixir.
