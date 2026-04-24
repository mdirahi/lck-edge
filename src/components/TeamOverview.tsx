import type { Team, Player } from "@/lib/types";

export function TeamOverview({ team, players }: { team: Team; players: Player[] }) {
  const roleOrder: Record<Player["role"], number> = { TOP: 0, JNG: 1, MID: 2, ADC: 3, SUP: 4 };
  const sorted = [...players].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xl font-semibold tracking-tight text-text">{team.name}</h3>
        <span className="badge-muted">{team.tag}</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <Stat label="Recent form" value={"–"} />
        <Stat label="Split record" value={"–"} />
        <Stat label="Blue-side WR" value={"–"} />
        <Stat label="Red-side WR" value={"–"} />
      </div>
      <p className="mt-3 text-[11px] text-muted">
        Recent-form stats populate once Oracle&rsquo;s Elixir CSVs are imported.
      </p>

      <div className="mt-6">
        <h4 className="section-eyebrow">Roster</h4>
        {sorted.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No players seeded yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[color:var(--border-soft)] text-sm">
            {sorted.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="flex items-center gap-3">
                  <span className="inline-block w-10 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {p.role}
                  </span>
                  <span className="font-medium text-text">{p.ign}</span>
                </span>
                {p.real_name && <span className="text-xs text-muted">{p.real_name}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-inset">
      <div className="stat-label">{label}</div>
      <div className="mt-1 stat-value">{value}</div>
    </div>
  );
}
