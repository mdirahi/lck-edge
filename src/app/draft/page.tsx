export default function DraftPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Draft upload</h1>
        <p className="mt-1.5 text-xs text-muted">
          Standalone draft analysis (outside a specific match) — coming in v0.2.
        </p>
      </div>
      <div className="card text-sm leading-relaxed text-muted">
        Coming in v0.2. The schema (<code className="font-mono text-[12px] text-text">draft_uploads</code> table)
        and the API shape are already in place. The UI here will let you paste a screenshot, call a Python FastAPI
        service that parses it with a Vision LLM, correct any misread slots, then score the draft.
      </div>
    </div>
  );
}
