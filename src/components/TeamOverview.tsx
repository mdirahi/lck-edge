import type { Team, Player } from "@/lib/types";

export function TeamOverview({ team, players }: { team: Team; players: Player[] }) {
  const roleOrder: Record<Player["role"], number> = { TOP: 0, JNG: 1, MID: 2, ADC: 3, SUP: 4 };
  const sorted = [...players].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

  return (
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xl font-semibold">{team.name}</h3>
        <span className="text-sm text-muted">{team.tag}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Recent form" value={"\u2013"} />
        <Stat label="Split record" value={"\u2013"} />
        <Stat label="Blue-side WR" value={"\u2013"} />
        <Stat label="Red-side WR" value={"\u2013"} />
      </div>
      <p className="mt-3 text-xs text-muted">
        (Recent form data is populated once you import Oracle&rsquo;s Elixir CSVs. See README.)
      </p>

      <h4 className="mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Roster</h4>
      <ul className="mt-2 divide-y divide-border text-sm">
        {sorted.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2">
            <span>
              <span className="inline-block w-10 text-xs text-muted">{p.role}</span>
              <span className="font-medium">{p.ign}</span>
            </span>
            {p.real_name && <span className="text-xs text-muted">{p.real_name}</span>}
          </li>
        ))}
        {sorted.length === 0 && (
          <li className="py-2 text-xs text-muted">No players seeded yet.</li>
        )}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-bg/40 px-2 py-1.5">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
