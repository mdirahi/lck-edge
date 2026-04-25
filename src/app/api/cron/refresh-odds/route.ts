// External-scheduler entrypoint for auto-refreshing odds.
//
// Triggered by .github/workflows/refresh-odds.yml every 30 minutes (Vercel
// Hobby crons are daily-only, so we use GitHub Actions instead).
//
// Cadence policy: enforced inside the handler so the same 30-min schedule can
// pull less aggressively for matches that are days out.
//
// Auth: caller must send `Authorization: Bearer <CRON_SECRET>`. We reject
// everything else with 401.
import { NextResponse } from "next/server";
import { refreshAllUpcoming } from "@/server/refresh-odds";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Tiered cadence:
  //   - kickoff in (-1h, 12h]  → always refresh (every 30min cron tick)
  //   - kickoff in (12h, 72h]  → refresh only on the top-of-hour ticks
  //                              that fall on a 6h boundary (00:00, 06:00, ...)
  //   - everything else        → skip
  const now = new Date();
  const hour = now.getUTCHours();
  const isMidCadenceTick = now.getUTCMinutes() < 5; // top-of-hour
  const isLongCadenceTick = isMidCadenceTick && hour % 6 === 0;

  const summary = await refreshAllUpcoming({
    cadenceFilter: (hoursToKickoff) => {
      if (hoursToKickoff <= -1) return false;
      if (hoursToKickoff <= 12) return true;
      if (hoursToKickoff <= 72) return isLongCadenceTick;
      return false;
    },
  });

  return NextResponse.json(summary, { status: summary.ok ? 200 : 500 });
}
