import { test } from "node:test";
import assert from "node:assert/strict";
import { runPrediction, PREDICTION_WEIGHTS } from "./prediction.ts";

test("weights sum to 1", () => {
  const sum = Object.values(PREDICTION_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights sum to ${sum}`);
});

test("no inputs -> 50/50", () => {
  const p = runPrediction({});
  assert.ok(Math.abs(p.teamAScore - p.teamBScore) < 0.01);
  assert.equal(p.confidence, "low");
  assert.equal(p.lean, "pass");
});

test("strong A on recent form tilts the model A", () => {
  const p = runPrediction({
    recentForm: { teamA: 0.9, teamB: 0.3 },
  });
  assert.ok(p.teamAScore > p.teamBScore);
  assert.ok(p.teamAProb > 0.5);
});

test("market supplied -> marketDelta + finalProbA computed", () => {
  const p = runPrediction({
    recentForm: { teamA: 0.7, teamB: 0.5 },
    draftStrength: { teamA: 0.6, teamB: 0.5 },
    marketSignal: { teamA: 0.45, teamB: 0.55 }, // market thinks A is dog
  });
  assert.ok(p.marketDelta !== undefined);
  assert.ok(p.finalProbA !== undefined);
  // Model likes A more than market -> delta positive
  assert.ok((p.marketDelta ?? 0) > 0);
});

test("draft strength dominates the weight distribution", () => {
  // If we give team A a big draft edge and nothing else, team A should
  // pull ahead by roughly 0.25 * (100 - 50) = 12.5 pts.
  const p = runPrediction({
    draftStrength: { teamA: 1.0, teamB: 0.4 },
  });
  assert.ok(p.teamAScore - p.teamBScore >= 5);
});

test("recommendation respects low confidence", () => {
  const p = runPrediction({
    marketSignal: { teamA: 0.50, teamB: 0.50 },
  });
  // No strong signals + low confidence + zero edge -> avoid
  assert.equal(p.confidence, "low");
  assert.ok(["avoid", "watch"].includes(p.recommendation));
});
