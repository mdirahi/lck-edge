import { createServerClient } from "@/lib/supabase/server";
import type { RoleCode } from "@/lib/types";

interface Props {
  matchId: string;
  teamAId: string;
  teamBId: string;
  teamATag: string;
  teamBTag: string;
}

interface JoinedSlot {
  side: "blue" | "red";
  slot_type: "pick" | "ban";
  slot_index: number;
  role: RoleCode | null;
  champion: { id: string; display_name: string; primary_role: RoleCode | null } | null;
}

const ROLES: RoleCode[] = ["TOP", "JNG", "MID", "ADC", "SUP"];

/**
 * Read-only display of the draft saved for a match. Spans the full grid width.
 * Async server component - reads directly from Supabase.
 */
export async function DraftView({
  matchId, teamAId, teamBId, teamATag, teamBTag,
}: Props) {
  const sb = createServerClient();

  const { data: draft } = await sb
    .from("drafts")
    .select("id, blue_team_id, red_team_id, notes, updated_at")
    .eq("match_id", matchId)
    .maybeSingle();

  if (!draft) {
    return (
      <div className="card">
        <h3 className="section-eyebrow">Draft</h3>
        <p className="mt-3 text-sm text-muted">
          No draft on file yet. Enter picks and bans in the form below to unlock
          draft-based scoring.
        </p>
      </div>
    );
  }

  const { data: slots } = await sb
    .from("draft_slots")
    .select(`
      side, slot_type, slot_index, role,
      champion:champions (id, display_name, primary_role)
    `)
    .eq("draft_id", draft.id);

  const rows = (slots ?? []) as unknown as JoinedSlot[];
  const blueTag = draft.blue_team_id === teamAId ? teamATag : teamBTag;
  const redTag = draft.red_team_id === teamAId ? teamATag : teamBTag;

  const blueSide = sideData(rows, "blue");
  const redSide = sideData(rows, "red");

  return (
    <div className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="section-eyebrow">Draft</h3>
        <span className="text-[11px] tabular-nums text-muted" suppressHydrationWarning>
          Updated {new Date(draft.updated_at).toLocaleString()}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <SideBlock side="blue" tag={blueTag} data={blueSide} />
        <SideBlock side="red" tag={redTag} data={redSide} />
      </div>

      {draft.notes && (
        <p className="mt-4 rounded-lg border border-[color:var(--border-soft)] bg-bg-elev/50 px-3 py-2 text-xs italic text-muted">
          &ldquo;{draft.notes}&rdquo;
        </p>
      )}
    </div>
  );
}

function sideData(rows: JoinedSlot[], side: "blue" | "red") {
  const picks = new Map<RoleCode, JoinedSlot>();
  const bans: (JoinedSlot | null)[] = [null, null, null, null, null];
  for (const r of rows) {
    if (r.side !== side) continue;
    if (r.slot_type === "pick" && r.role) picks.set(r.role, r);
    if (r.slot_type === "ban" && r.slot_index >= 0 && r.slot_index < 5) {
      bans[r.slot_index] = r;
    }
  }
  return { picks, bans };
}

function SideBlock({
  side, tag, data,
}: {
  side: "blue" | "red";
  tag: string;
  data: { picks: Map<RoleCode, JoinedSlot>; bans: (JoinedSlot | null)[] };
}) {
  const sideColor = side === "blue" ? "text-accent" : "text-bad";
  const sideRing = side === "blue" ? "border-accent/30" : "border-bad/30";
  const sideGlow =
    side === "blue"
      ? "bg-[linear-gradient(180deg,rgba(106,169,255,0.05),transparent_40%)]"
      : "bg-[linear-gradient(180deg,rgba(240,110,91,0.05),transparent_40%)]";

  return (
    <div className={`rounded-xl border ${sideRing} ${sideGlow} bg-bg-elev/40 p-4`}>
      <div className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${sideColor}`}>
        {side} side <span className="text-muted">— {tag}</span>
      </div>

      <ul className="mt-3 divide-y divide-[color:var(--border-soft)]">
        {ROLES.map((role) => {
          const p = data.picks.get(role);
          return (
            <li key={role} className="flex items-center justify-between py-2 text-sm">
              <span className="inline-block w-12 text-[11px] font-semibold uppercase tracking-wider text-muted">
                {role}
              </span>
              <span className={`font-medium ${p?.champion ? "text-text" : "text-muted"}`}>
                {p?.champion?.display_name ?? "–"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        <div className="stat-label">Bans</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.bans.map((b, i) => (
            <span
              key={i}
              className={`rounded-md border border-[color:var(--border-soft)] bg-bg-elev/60 px-2 py-1 text-[11px] ${
                b?.champion ? "text-text" : "text-muted"
              }`}
            >
              {b?.champion?.display_name ?? "–"}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
