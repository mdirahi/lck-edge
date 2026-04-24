import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Health check. Public (whitelisted in middleware) so uptime monitors can
 * poll it. Verifies the DB is reachable and the basic tables exist.
 */
export async function GET() {
  const started = Date.now();
  const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {};

  try {
    const sb = createServerClient();
    const t0 = Date.now();
    const { error } = await sb.from("teams").select("id", { count: "exact", head: true }).limit(1);
    checks.db = error
      ? { ok: false, ms: Date.now() - t0, error: error.message }
      : { ok: true, ms: Date.now() - t0 };
  } catch (e: any) {
    checks.db = { ok: false, error: e?.message ?? String(e) };
  }

  checks.env = {
    ok: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
  };
  checks.anthropic = { ok: Boolean(process.env.ANTHROPIC_API_KEY) };

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      ok,
      ts: new Date().toISOString(),
      latencyMs: Date.now() - started,
      checks,
    },
    { status: ok ? 200 : 503 }
  );
}
