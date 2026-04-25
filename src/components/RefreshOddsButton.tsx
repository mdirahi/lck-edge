"use client";

import { useState, useTransition } from "react";
import { refreshOddsAction } from "@/actions/refreshOdds";

interface Props {
  matchId: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "ok"; updated: boolean }
  | { kind: "error"; message: string };

export function RefreshOddsButton({ matchId }: Props) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function onClick() {
    setStatus({ kind: "idle" });
    start(async () => {
      const res = await refreshOddsAction(matchId);
      if (!res.ok) {
        setStatus({ kind: "error", message: res.error });
      } else {
        setStatus({ kind: "ok", updated: res.updated });
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border-soft bg-bg-elev/40 px-3.5 py-2.5">
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <span className="dot-accent" />
        <span>
          Auto-pull from The Odds API.{" "}
          <span className="text-muted/70">Cron runs every 30 min;</span>{" "}
          use this for an immediate snapshot.
        </span>
      </div>
      <div className="flex items-center gap-2">
        {status.kind === "ok" && (
          <span className={status.updated ? "badge-good" : "badge-muted"}>
            {status.updated ? "snapshot saved" : "no matching event"}
          </span>
        )}
        {status.kind === "error" && (
          <span className="badge-bad" title={status.message}>
            error
          </span>
        )}
        <button
          type="button"
          onClick={onClick}
          disabled={pending}
          className="btn-ghost btn-sm"
        >
          {pending ? "Refreshing…" : "Refresh now"}
        </button>
      </div>
    </div>
  );
}
