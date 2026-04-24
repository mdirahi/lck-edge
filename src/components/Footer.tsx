export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-panel/40">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted space-y-2">
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
