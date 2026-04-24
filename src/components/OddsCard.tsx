"use client";

import { useState, useTransition } from "react";
import {
  convertOdds,
  formatProb,
  parseOddsInput,
  type OddsFormat,
} from "@/lib/odds";
import { saveOddsAction } from "@/actions/saveOdds";

interface Props {
  matchId: string;
  teamATag: string;
  teamBTag: string;
  latestNovigA?: number;      // from DB if a snapshot already exists
  latestNovigB?: number;
  latestSource?: string;
  latestCapturedAt?: string;
}

type PreviewState =
  | { ok: true; teamA: number; teamB: number; result: ReturnType<typeof convertOdds> }
  | { ok: false; error: string; field: "teamA" | "teamB" | "both" }
  | null;

export function OddsCard({
  matchId, teamATag, teamBTag,
  latestNovigA, latestNovigB, latestSource, latestCapturedAt,
}: Props) {
  const [format, setFormat] = useState<OddsFormat>("decimal");
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [source, setSource] = useState("manual");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Live preview as the user types (doesn't write to DB).
  const preview: PreviewState = computePreview(format, teamA, teamB);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!preview || !preview.ok) {
      setError(preview?.ok === false ? preview.error : "Enter both prices");
      return;
    }
    start(async () => {
      const res = await saveOddsAction({
        matchId,
        format,
        teamARaw: teamA,
        teamBRaw: teamB,
        source,
      });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="section-title">Odds</h3>
        <span className="text-xs text-muted">
          Paste your line. Enter once per new price you see.
        </span>
      </div>

      {(latestNovigA !== undefined && latestNovigB !== undefined) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <SnapshotTile tag={teamATag} novig={latestNovigA} />
          <SnapshotTile tag={teamBTag} novig={latestNovigB} />
        </div>
      )}
      {latestSource && (
        <p className="mt-2 text-[11px] text-muted" suppressHydrationWarning>
          Last: {latestSource}
          {latestCapturedAt ? ` · ${formatCapturedAt(latestCapturedAt)}` : ""}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <LabeledSelect
            label="Format"
            value={format}
            onChange={(v) => setFormat(v as OddsFormat)}
            options={[
              { v: "decimal", l: "Decimal (1.85)" },
              { v: "american", l: "American (-150)" },
              { v: "implied_prob", l: "Probability (62%)" },
            ]}
          />
          <LabeledInput
            label={`${teamATag} price`}
            value={teamA}
            onChange={setTeamA}
            placeholder={placeholderFor(format)}
            inputMode={inputModeFor(format)}
            invalid={preview?.ok === false && (preview.field === "teamA" || preview.field === "both")}
          />
          <LabeledInput
            label={`${teamBTag} price`}
            value={teamB}
            onChange={setTeamB}
            placeholder={placeholderFor(format)}
            inputMode={inputModeFor(format)}
            invalid={preview?.ok === false && (preview.field === "teamB" || preview.field === "both")}
          />
        </div>

        <div className="text-[11px] text-muted">{helpFor(format)}</div>

        <LabeledInput
          label="Source label"
          value={source}
          onChange={setSource}
          placeholder={"manual, kalshi, rainbet_manual, \u2026"}
        />

        {preview?.ok && (
          <div className="card-inset grid grid-cols-2 gap-3 text-sm">
            <PreviewLine tag={teamATag} implied={preview.result.teamAImpliedProb} novig={preview.result.novigA} />
            <PreviewLine tag={teamBTag} implied={preview.result.teamBImpliedProb} novig={preview.result.novigB} />
            <div className="col-span-2 text-xs text-muted">
              Overround (vig): {(preview.result.overround * 100 - 100).toFixed(2)}%
            </div>
          </div>
        )}

        {preview?.ok === false && teamA && teamB && (
          <div className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
            {preview.error}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !preview?.ok}
          className="btn-primary w-full sm:w-auto"
        >
          {pending ? "Saving…" : "Save & re-score"}
        </button>
      </form>
    </div>
  );
}

function computePreview(format: OddsFormat, rawA: string, rawB: string): PreviewState {
  if (!rawA && !rawB) return null;

  let a: number | null = null;
  let errA: string | null = null;
  let b: number | null = null;
  let errB: string | null = null;

  if (rawA) {
    try { a = parseOddsInput(rawA, format); } catch (e: any) { errA = e.message; }
  }
  if (rawB) {
    try { b = parseOddsInput(rawB, format); } catch (e: any) { errB = e.message; }
  }

  if (errA && errB) return { ok: false, error: errA, field: "both" };
  if (errA) return { ok: false, error: errA, field: "teamA" };
  if (errB) return { ok: false, error: errB, field: "teamB" };
  if (a === null || b === null) return null; // waiting on the other side

  try {
    const result = convertOdds({ format, teamA: a, teamB: b });
    return { ok: true, teamA: a, teamB: b, result };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Could not convert odds", field: "both" };
  }
}

function placeholderFor(f: OddsFormat) {
  if (f === "decimal") return "1.85";
  if (f === "american") return "-150";
  return "62%";
}

function inputModeFor(f: OddsFormat): "decimal" | "text" {
  // american can start with "-" or "+"; implied_prob can end with "%"
  if (f === "decimal") return "decimal";
  return "text";
}

function helpFor(f: OddsFormat): string {
  if (f === "decimal") return "European decimal, e.g. 1.65 or 2.20.";
  if (f === "american") return "US odds: -150 (favorite) or +120 (underdog). The + is optional.";
  return "Percent, e.g. 62 or 62%. Use 0.62 if you prefer.";
}

function LabeledInput({
  label, value, onChange, placeholder, inputMode = "decimal", invalid = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "text";
  invalid?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="field-label">{label}</span>
      <input
        className={`input ${invalid ? "input-invalid" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </label>
  );
}

function LabeledSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <label className="block space-y-1.5">
      <span className="field-label">{label}</span>
      <select
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </label>
  );
}

function PreviewLine({ tag, implied, novig }: { tag: string; implied: number; novig: number }) {
  return (
    <div>
      <div className="stat-label">{tag}</div>
      <div className="mt-0.5 text-base font-semibold text-text tabular-nums">
        {formatProb(novig)} <span className="text-xs font-normal text-muted">fair</span>
      </div>
      <div className="text-[11px] text-muted tabular-nums">raw {formatProb(implied)}</div>
    </div>
  );
}

function SnapshotTile({ tag, novig }: { tag: string; novig: number }) {
  return (
    <div className="card-inset">
      <div className="stat-label">{tag} fair</div>
      <div className="mt-1 text-2xl font-semibold text-text tabular-nums">{formatProb(novig)}</div>
    </div>
  );
}

function formatCapturedAt(iso: string): string {
  // America/New_York auto-handles EST vs EDT; label as "ET" year-round.
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }) + " ET";
}
