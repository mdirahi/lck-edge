import { test } from "node:test";
import assert from "node:assert/strict";
import {
  priceToImpliedProb,
  convertOdds,
  edge,
  scoresToProb,
  blendByConfidence,
  recommend,
  parseOddsInput,
} from "./odds.ts";

const approx = (actual: number, expected: number, eps = 1e-3) => {
  assert.ok(
    Math.abs(actual - expected) < eps,
    `expected ${expected}, got ${actual}`
  );
};

test("decimal 1.85 -> 0.5405 implied", () => {
  approx(priceToImpliedProb(1.85, "decimal"), 0.54054);
});

test("american -150 -> 0.60 implied", () => {
  approx(priceToImpliedProb(-150, "american"), 0.6);
});

test("american +130 -> 0.4348 implied", () => {
  approx(priceToImpliedProb(130, "american"), 100 / 230);
});

test("implied_prob passes through", () => {
  approx(priceToImpliedProb(0.62, "implied_prob"), 0.62);
});

test("invalid decimal is rejected", () => {
  assert.throws(() => priceToImpliedProb(1.0, "decimal"));
  assert.throws(() => priceToImpliedProb(0.9, "decimal"));
});

test("convertOdds removes vig correctly", () => {
  // A 5% overround: 0.57 + 0.48 = 1.05
  const r = convertOdds({ format: "implied_prob", teamA: 0.57, teamB: 0.48 });
  approx(r.overround, 1.05);
  approx(r.novigA, 0.57 / 1.05);
  approx(r.novigB, 0.48 / 1.05);
});

test("edge = model - novig", () => {
  approx(edge(0.58, 0.52), 0.06);
});

test("scoresToProb is symmetric", () => {
  approx(scoresToProb(60, 60), 0.5);
  // Higher score => higher prob
  assert.ok(scoresToProb(70, 60) > 0.5);
});

test("blendByConfidence medium weights sensibly", () => {
  const out = blendByConfidence(0.6, 0.5, "medium");
  // 0.6 * 0.6 + 0.4 * 0.5 = 0.56
  approx(out, 0.56);
});

test("recommend marks play when edge >= 5pts at medium+", () => {
  assert.equal(recommend(0.58, 0.52, "medium"), "play");
  assert.equal(recommend(0.51, 0.50, "medium"), "watch");
  assert.equal(recommend(0.51, 0.50, "low"), "avoid");
});

// ---- parseOddsInput ----

test("parseOddsInput decimal accepts common formats", () => {
  approx(parseOddsInput("1.85", "decimal"), 1.85);
  approx(parseOddsInput(" 2.20 ", "decimal"), 2.2);
  approx(parseOddsInput("1.65", "decimal"), 1.65);
});

test("parseOddsInput decimal rejects <= 1 and non-numbers", () => {
  assert.throws(() => parseOddsInput("1", "decimal"));
  assert.throws(() => parseOddsInput("0.9", "decimal"));
  assert.throws(() => parseOddsInput("abc", "decimal"));
  assert.throws(() => parseOddsInput("", "decimal"));
});

test("parseOddsInput american handles + / - / bare", () => {
  assert.equal(parseOddsInput("-150", "american"), -150);
  assert.equal(parseOddsInput("+120", "american"), 120);
  assert.equal(parseOddsInput("120", "american"), 120);
  assert.equal(parseOddsInput("-100", "american"), -100);
});

test("parseOddsInput american rejects zero and in-between", () => {
  assert.throws(() => parseOddsInput("0", "american"));
  assert.throws(() => parseOddsInput("50", "american"));
  assert.throws(() => parseOddsInput("-50", "american"));
});

test("parseOddsInput implied_prob accepts 62 / 62% / 0.62", () => {
  approx(parseOddsInput("62", "implied_prob"), 0.62);
  approx(parseOddsInput("62%", "implied_prob"), 0.62);
  approx(parseOddsInput("0.62", "implied_prob"), 0.62);
  approx(parseOddsInput(" 55 % ", "implied_prob"), 0.55);
  approx(parseOddsInput("100%", "implied_prob"), 1.0);
  approx(parseOddsInput("0", "implied_prob"), 0);
});

test("parseOddsInput implied_prob rejects out-of-range", () => {
  assert.throws(() => parseOddsInput("120", "implied_prob"));
  assert.throws(() => parseOddsInput("120%", "implied_prob"));
  assert.throws(() => parseOddsInput("-1", "implied_prob"));
  assert.throws(() => parseOddsInput("abc", "implied_prob"));
});
