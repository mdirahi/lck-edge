export default function DraftPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Draft upload</h1>
      <div className="rounded-lg border border-border bg-panel p-6 text-sm text-muted">
        Coming in v0.2. The schema (<code>draft_uploads</code> table) and the API shape are already in place.
        The UI here will let you paste a screenshot, call a Python FastAPI service that parses it with a
        Vision LLM, correct any misread slots, then score the draft.
      </div>
    </div>
  );
}
