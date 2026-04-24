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
      <div className="rounded-lg border border-border bg-panel p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Draft</h3>
        <p className="mt-2 text-sm text-muted">
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
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Draft</h3>
        <span className="text-[11px] text-muted">
          Updated {new Date(draft.updated_at).toLocaleString()}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <SideBlock side="blue" tag={blueTag} data={blueSide} />
        <SideBlock side="red" tag={redTag} data={redSide} />
      </div>

      {draft.notes && (
        <p className="mt-3 text-xs text-muted">&ldquo;{draft.notes}&rdquo;</p>
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
  const accent = side === "blue" ? "text-accent" : "text-bad";
  const ring = side === "blue" ? "border-accent/40" : "border-bad/40";
  return (
    <div className={`rounded border ${ring} bg-bg/30 p-3`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>
        {side} side {"\u2014"} {tag}
      </div>

      <ul className="mt-2 divide-y divide-border">
        {ROLES.map((role) => {
          const p = data.picks.get(role);
          return (
            <li key={role} className="flex items-center justify-between py-1.5 text-sm">
              <span className="inline-block w-12 text-xs text-muted">{role}</span>
              <span className="font-medium">{p?.champion?.display_name ?? "\u2013"}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-wide text-muted">Bans</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {data.bans.map((b, i) => (
            <span
              key={i}
              className="rounded border border-border bg-bg/40 px-2 py-0.5 text-xs"
            >
              {b?.champion?.display_name ?? "\u2013"}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
