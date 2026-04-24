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

  // Count non-market factors with real input. 0 = model has nothing to say.
  const independentDataCount = factors.filter(
    (f) => f.factor_key !== "market_signal" && f.team_a_value !== null
  ).length;
  const dataStarved = independentDataCount === 0;

  // Value side: sign of delta (model minus market). Tiny deltas = "no clear edge".
  const valueSide: "A" | "B" | "even" | null =
    delta === null || delta === undefined
      ? null
      : Math.abs(delta) < 0.02
      ? "even"
      : delta > 0
      ? "A"
      : "B";

  // Lean display (model-only call for who wins the series)
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

      {/* Projected scores (0–100) */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <ScoreTile tag={teamATag} score={prediction.team_a_score} />
        <ScoreTile tag={teamBTag} score={prediction.team_b_score} />
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">
        Projected score out of 100 — weighted sum of 7 factors
      </p>

      {/* Probability breakdown */}
      <div className="mt-5 overflow-hidden rounded-lg border border-[color:var(--border-soft)]">
        <table className="w-full text-sm">
          <thead className="bg-bg-elev/70 text-[10px] uppercase tracking-[0.1em] text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Win probability</th>
              <th className="px-3 py-2 text-right font-semibold">{teamATag}</th>
              <th className="px-3 py-2 text-right font-semibold">{teamBTag}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border-soft)]">
            <ProbRow label="Model" a={modelA} b={modelB} />
            {marketA !== undefined && marketB !== undefined ? (
              <ProbRow label="Market (no-vig)" a={marketA} b={marketB} />
            ) : (
              <tr>
                <td className="px-3 py-2 text-muted">Market (no-vig)</td>
                <td className="px-3 py-2 text-right text-muted" colSpan={2}>
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
        <div className="mt-4 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5 text-xs">
          <span className="font-semibold text-warn">No independent signal yet.</span>{" "}
          <span className="text-muted">
            Numbers reflect market odds only. Enter a draft or import recent form data to unlock analysis.
          </span>
        </div>
      ) : delta !== null && delta !== undefined ? (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-[color:var(--border-soft)] bg-bg-elev/60 px-3 py-2.5 text-sm">
          <span className="text-muted">Model edge vs market</span>
          <span className="tabular-nums">
            {valueSide === "even" ? (
              <span className="text-muted">
                ≈ even ({signed(delta * 100)} pts)
              </span>
            ) : (
              <>
                <span className="font-semibold text-good">
                  {valueSide === "A" ? teamATag : teamBTag}
                </span>
                <span className="mx-1.5 text-muted">value side</span>
                <span className="font-medium">
                  ({signed(Math.abs(delta) * 100)} pts)
                </span>
              </>
            )}
          </span>
        </div>
      ) : null}

      {/* Lean + confidence + recommendation */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted">Lean:</span>
        <span className="text-sm font-semibold text-text">{leanLabel}</span>
        <span className={confBadge[prediction.confidence]}>
          Confidence: {prediction.confidence}
        </span>
        <span className={recBadge[prediction.recommendation]}>
          {prediction.recommendation.toUpperCase()}
        </span>
      </div>

      {prediction.reasons.length > 0 && (
        <div className="mt-5 divider-soft pt-4">
          <div className="section-eyebrow">Why</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text">
            {prediction.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <p className="mt-2 text-[11px] text-muted">Factor scores are on a 0–100 scale.</p>
        </div>
      )}

      {prediction.risks.length > 0 && (
        <div className="mt-4">
          <div className="section-eyebrow">Risks</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text">
            {prediction.risks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {factors.length > 0 && (
        <details className="mt-5 divider-soft pt-4">
          <summary className="cursor-pointer select-none text-xs text-muted transition-colors hover:text-text">
            Factor breakdown
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
                <tr key={f.id} className="border-t border-[color:var(--border-soft)]">
                  <td className="py-1.5">{f.factor_key.replace(/_/g, " ")}</td>
                  <td className="py-1.5 tabular-nums">{(f.weight * 100).toFixed(0)}%</td>
                  <td className="py-1.5 text-right tabular-nums">{Number(f.team_a_score).toFixed(0)}</td>
                  <td className="py-1.5 text-right tabular-nums">{Number(f.team_b_score).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <p className="mt-5 text-[11px] text-muted">
        Analytical support, not guaranteed betting advice.
      </p>
    </div>
  );
}

function ScoreTile({ tag, score }: { tag: string; score: number }) {
  return (
    <div className="card-inset text-center">
      <div className="stat-label">{tag}</div>
      <div className="mt-1 stat-value-lg">
        {Number(score).toFixed(1)}
        <span className="ml-0.5 text-sm font-normal text-muted">/100</span>
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
