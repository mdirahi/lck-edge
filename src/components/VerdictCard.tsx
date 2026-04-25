import type { PredictionRow, PredictionFactorRow } from "@/lib/types";

const confBadge = {
  low: "badge-muted",
  medium: "badge-warn",
  high: "badge-good",
} as const;

const recBadge = {
  play: "badge-good",
  watch: "badge-warn",
  avoid: "badge-bad",
} as const;

export function VerdictCard({
  prediction,
  factors,
  teamATag,
  teamBTag,
  latestNovigA,
  latestNovigB,
}: {
  prediction: PredictionRow;
  factors: PredictionFactorRow[];
  teamATag: string;
  teamBTag: string;
  latestNovigA?: number;
  latestNovigB?: number;
}) {
  const modelA = prediction.team_a_prob;
  const modelB = 1 - modelA;
  const finalA = prediction.final_prob_a ?? prediction.team_a_prob;
  const finalB = 1 - finalA;
  const marketA = latestNovigA;
  const marketB = latestNovigB;
  const delta = prediction.market_delta;

  const independentDataCount = factors.filter(
    (f) => f.factor_key !== "market_signal" && f.team_a_value !== null
  ).length;
  const dataStarved = independentDataCount === 0;

  const valueSide: "A" | "B" | "even" | null =
    delta === null || delta === undefined
      ? null
      : Math.abs(delta) < 0.02
      ? "even"
      : delta > 0
      ? "A"
      : "B";

  const leanLabel =
    prediction.lean === "team_a"
      ? teamATag
      : prediction.lean === "team_b"
      ? teamBTag
      : "no lean";

  return (
    <div className="card-hero">
      <div className="flex items-baseline justify-between">
        <h3 className="section-title">Quick verdict</h3>
        <span className="text-[11px] text-muted tabular-nums">
          model {prediction.model_version}
        </span>
      </div>

      {/* Big projected scores with team-color accents */}
      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <ScoreTile tag={teamATag} score={prediction.team_a_score} side="blue" />
        <span className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted/70">
          vs
        </span>
        <ScoreTile tag={teamBTag} score={prediction.team_b_score} side="red" />
      </div>

      {/* Win probability bar - visualizes the final blended split */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-[11px] font-medium tabular-nums">
          <span className="text-accent">{teamATag} {(finalA * 100).toFixed(1)}%</span>
          <span className="text-muted">Final win probability</span>
          <span className="text-bad">{(finalB * 100).toFixed(1)}% {teamBTag}</span>
        </div>
        <div className="mt-2 prob-track">
          <div className="prob-fill-a" style={{ width: `${finalA * 100}%` }} />
          <div className="prob-fill-b" style={{ width: `${finalB * 100}%` }} />
        </div>
      </div>

      {/* Probability breakdown */}
      <div className="mt-6 overflow-hidden rounded-xl border border-border-soft">
        <table className="w-full text-sm">
          <thead className="bg-bg-elev/70 text-[10px] uppercase tracking-[0.1em] text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Win probability</th>
              <th className="px-3 py-2 text-right font-semibold">{teamATag}</th>
              <th className="px-3 py-2 text-right font-semibold">{teamBTag}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            <ProbRow label="Model" a={modelA} b={modelB} />
            {marketA !== undefined && marketB !== undefined ? (
              <ProbRow label="Market (no-vig)" a={marketA} b={marketB} />
            ) : (
              <tr>
                <td className="px-3 py-2 text-muted">Market (no-vig)</td>
                <td className="px-3 py-2 text-right italic text-muted" colSpan={2}>
                  no odds entered
                </td>
              </tr>
            )}
            <ProbRow label="Final (blended)" a={finalA} b={finalB} emphasize />
          </tbody>
        </table>
      </div>

      {/* Edge / value side, OR data-starved banner */}
      {dataStarved ? (
        <div className="mt-5 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-3 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="dot-warn dot-pulse mt-1.5 shrink-0" />
            <div>
              <span className="font-semibold text-warn">No independent signal yet.</span>{" "}
              <span className="text-muted">
                Numbers reflect market odds only. Enter a draft or import recent form data to unlock analysis.
              </span>
            </div>
          </div>
        </div>
      ) : delta !== null && delta !== undefined ? (
        <div className="mt-5 flex items-center justify-between rounded-xl border border-border-soft bg-bg-elev/60 px-3.5 py-3 text-sm">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            Model edge vs market
          </span>
          <span className="tabular-nums">
            {valueSide === "even" ? (
              <span className="text-muted">
                &asymp; even <span className="text-muted/60">({signed(delta * 100)} pts)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="font-semibold text-good">
                  {valueSide === "A" ? teamATag : teamBTag}
                </span>
                <span className="text-muted">value side</span>
                <span className="badge-good">{signed(Math.abs(delta) * 100)} pts</span>
              </span>
            )}
          </span>
        </div>
      ) : null}

      {/* Lean + confidence + recommendation */}
      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] uppercase tracking-[0.08em] text-muted">Lean</span>
        <span className="font-display text-sm font-semibold text-text">{leanLabel}</span>
        <span className="mx-1 h-4 w-px bg-border-soft" />
        <span className={confBadge[prediction.confidence]}>
          Confidence &middot; {prediction.confidence}
        </span>
        <span className={recBadge[prediction.recommendation]}>
          {prediction.recommendation.toUpperCase()}
        </span>
      </div>

      {prediction.reasons.length > 0 && (
        <div className="mt-6 divider-soft pt-5">
          <div className="section-eyebrow">Why</div>
          <ul className="mt-2.5 space-y-1.5 text-sm text-text">
            {prediction.reasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent/70" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[11px] text-muted">Factor scores are on a 0&ndash;100 scale.</p>
        </div>
      )}

      {prediction.risks.length > 0 && (
        <div className="mt-5">
          <div className="section-eyebrow">Risks</div>
          <ul className="mt-2.5 space-y-1.5 text-sm text-text">
            {prediction.risks.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warn/80" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {factors.length > 0 && (
        <details className="mt-6 divider-soft pt-5 group">
          <summary className="cursor-pointer select-none list-none text-xs font-medium uppercase tracking-[0.1em] text-muted transition-colors hover:text-text">
            <span className="inline-flex items-center gap-1.5">
              <span className="transition-transform group-open:rotate-90">&#9656;</span>
              Factor breakdown
            </span>
          </summary>
          <table className="mt-3 w-full border-collapse text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1.5 font-semibold">Factor</th>
                <th className="py-1.5 font-semibold">Weight</th>
                <th className="py-1.5 text-right font-semibold">{teamATag} /100</th>
                <th className="py-1.5 text-right font-semibold">{teamBTag} /100</th>
              </tr>
            </thead>
            <tbody>
              {factors.map((f) => (
                <tr key={f.id} className="border-t border-border-soft">
                  <td className="py-2 capitalize">{f.factor_key.replace(/_/g, " ")}</td>
                  <td className="py-2 tabular-nums text-muted">{(f.weight * 100).toFixed(0)}%</td>
                  <td className="py-2 text-right tabular-nums">{Number(f.team_a_score).toFixed(0)}</td>
                  <td className="py-2 text-right tabular-nums">{Number(f.team_b_score).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <p className="mt-6 text-[11px] italic text-muted">
        Analytical support, not guaranteed betting advice.
      </p>
    </div>
  );
}

function ScoreTile({ tag, score, side }: { tag: string; score: number; side: "blue" | "red" }) {
  const accent =
    side === "blue"
      ? "text-accent border-accent/30 bg-gradient-to-br from-accent/10 via-transparent to-transparent"
      : "text-bad border-bad/30 bg-gradient-to-br from-bad/10 via-transparent to-transparent";
  return (
    <div className={`relative rounded-xl border ${accent} px-4 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`}>
      <div className="stat-label">{tag}</div>
      <div className="mt-1.5 stat-value-lg">
        {Number(score).toFixed(1)}
        <span className="ml-1 align-top text-xs font-normal text-muted">/100</span>
      </div>
    </div>
  );
}

function ProbRow({
  label, a, b, emphasize = false,
}: {
  label: string; a: number; b: number; emphasize?: boolean;
}) {
  const cellClass = `px-3 py-2 text-right tabular-nums ${emphasize ? "font-semibold text-text" : "text-text"}`;
  const rowClass = emphasize ? "bg-accent/5" : "";
  const labelClass = `px-3 py-2 ${emphasize ? "font-semibold text-text" : "text-muted"}`;
  return (
    <tr className={rowClass}>
      <td className={labelClass}>{label}</td>
      <td className={cellClass}>{(a * 100).toFixed(1)}%</td>
      <td className={cellClass}>{(b * 100).toFixed(1)}%</td>
    </tr>
  );
}

function signed(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(1);
}
