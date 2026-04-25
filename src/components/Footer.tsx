export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-24 border-t border-border-soft bg-bg-elev/40">
      {/* Soft top hairline accent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* Brand + tagline */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 font-display text-sm font-semibold tracking-tight text-text">
              <span
                aria-hidden
                className="relative inline-flex h-6 w-6 items-center justify-center rounded-md border border-accent/25 bg-gradient-to-br from-accent/20 via-accent/5 to-accent-2/15"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M13 3L4 14h6l-1 7 9-11h-6l1-7z" fill="currentColor" className="text-accent" />
                </svg>
              </span>
              LCK{" "}
              <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
                Edge
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              <span className="font-semibold text-text">Analytical support, not guaranteed betting advice.</span>{" "}
              Research tool for LCK match analysis. Every prediction can be wrong. Betting markets are
              efficient; no analytical system reliably beats them.
            </p>
          </div>

          {/* Responsible play */}
          <div className="space-y-2.5">
            <div className="section-eyebrow">Play responsibly</div>
            <p className="text-xs leading-relaxed text-muted">
              Gamble only if it is legal where you live and you are of legal age. If gambling is becoming
              a problem, please reach out to a regional responsible-gambling resource for support.
            </p>
          </div>

          {/* Attribution */}
          <div className="space-y-2.5">
            <div className="section-eyebrow">Data attribution</div>
            <ul className="space-y-1.5 text-xs text-muted">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/60" />
                <span>Leaguepedia (CC&nbsp;BY-SA) &mdash; teams &amp; matches</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/60" />
                <span>Oracle&rsquo;s Elixir &mdash; player &amp; team stats</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/60" />
                <span>Riot Data Dragon &mdash; champion images</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-border-soft/60 pt-5 text-[11px] text-muted sm:flex-row sm:items-center">
          <span>&copy; {year} LCK Edge &middot; Private research build</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="dot-accent" />
            LCK 2026 Spring
          </span>
        </div>
      </div>
    </footer>
  );
}
