export function Footer() {
  return (
    <footer className="mt-20 border-t border-[color:var(--border-soft)] bg-[color:rgba(20,24,35,0.4)]">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-xs leading-relaxed text-muted">
        <p>
          <strong className="text-text">Analytical support, not guaranteed betting advice.</strong>{" "}
          This tool is for research. Every prediction can be wrong. Betting markets are efficient;
          no analytical system reliably beats them.
        </p>
        <p>
          Gamble responsibly and only if it is legal where you live and you are of legal age.
          If gambling is becoming a problem, seek help from a regional responsible-gambling
          resource.
        </p>
        <p>
          Data attribution: team and match data from Leaguepedia (CC BY-SA) and Oracle&rsquo;s Elixir
          when imported. Champion images and names from Riot Data Dragon.
        </p>
      </div>
    </footer>
  );
}
