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
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">Odds</h3>
        <span className="text-xs text-muted">
          Paste your line. Enter once per new price you see.
        </span>
      </div>

      {(latestNovigA !== undefined && latestNovigB !== undefined) && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <SnapshotTile tag={teamATag} novig={latestNovigA} />
          <SnapshotTile tag={teamBTag} novig={latestNovigB} />
        </div>
      )}
      {latestSource && (
        <p className="mt-2 text-[11px] text-muted" suppressHydrationWarning>
          Last: {latestSource}{latestCapturedAt ? ` \u00b7 ${new Date(latestCapturedAt).toLocaleString()}` : ""}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
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
          <div className="grid grid-cols-2 gap-3 rounded border border-border bg-bg/40 p-3 text-sm">
            <PreviewLine tag={teamATag} implied={preview.result.teamAImpliedProb} novig={preview.result.novigA} />
            <PreviewLine tag={teamBTag} implied={preview.result.teamBImpliedProb} novig={preview.result.novigB} />
            <div className="col-span-2 text-xs text-muted">
              Overround (vig): {(preview.result.overround * 100 - 100).toFixed(2)}%
            </div>
          </div>
        )}

        {preview?.ok === false && teamA && teamB && (
          <div className="rounded border border-warn/40 bg-warn/10 p-2 text-xs text-warn">
            {preview.error}
          </div>
        )}

        {error && <div className="rounded border border-bad/40 bg-bad/10 p-2 text-xs text-bad">{error}</div>}

        <button
          type="submit"
          disabled={pending || !preview?.ok}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-bg hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving\u2026" : "Save & re-score"}
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
  const borderClass = invalid ? "border-warn" : "border-border";
  return (
    <label className="block text-xs text-muted">
      <span>{label}</span>
      <input
        className={`mt-1 w-full rounded border ${borderClass} bg-bg/60 px-2 py-1.5 text-sm text-text`}
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
    <label className="block text-xs text-muted">
      <span>{label}</span>
      <select
        className="mt-1 w-full rounded border border-border bg-bg/60 px-2 py-1.5 text-sm text-text"
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
      <div className="text-xs text-muted">{tag}</div>
      <div className="font-medium">{formatProb(novig)} <span className="text-xs text-muted">fair</span></div>
      <div className="text-[11px] text-muted">raw {formatProb(implied)}</div>
    </div>
  );
}

function SnapshotTile({ tag, novig }: { tag: string; novig: number }) {
  return (
    <div className="rounded border border-border bg-bg/40 px-3 py-2">
      <div className="text-xs text-muted">{tag} fair</div>
      <div className="text-xl font-semibold">{formatProb(novig)}</div>
    </div>
  );
}
