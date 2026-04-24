import test from "node:test";
import assert from "node:assert/strict";
import { matchChampionName } from "./championNameNormalizer.ts";
import type { Champion } from "./types.ts";

const champions: Champion[] = [
  { id: "1", display_name: "Aatrox", primary_role: "TOP" },
  { id: "2", display_name: "K'Sante", primary_role: "TOP" },
  { id: "3", display_name: "Kai'Sa", primary_role: "ADC" },
  { id: "4", display_name: "Renata Glasc", primary_role: "SUP" },
  { id: "5", display_name: "Jarvan IV", primary_role: "JNG" },
  { id: "6", display_name: "Karma", primary_role: "SUP" },
  { id: "7", display_name: "Karthus", primary_role: "MID" },
  { id: "8", display_name: "Kassadin", primary_role: "MID" },
  { id: "9", display_name: "Wukong", primary_role: "JNG" },
  { id: "10", display_name: "Dr. Mundo", primary_role: "TOP" },
] as any;

test("exact match is case-insensitive", () => {
  const r = matchChampionName("aatrox", champions);
  assert.equal(r.championId, "1");
  assert.equal(r.confidence, "exact");
});

test("normalized match strips apostrophes and spaces", () => {
  const r = matchChampionName("KSante", champions);
  assert.equal(r.championId, "2");
  assert.equal(r.confidence, "normalized");
});

test("normalized match handles 'Kai Sa' and 'KaiSa'", () => {
  assert.equal(matchChampionName("Kai Sa", champions).championId, "3");
  assert.equal(matchChampionName("KaiSa", champions).championId, "3");
  assert.equal(matchChampionName("kai'sa", champions).confidence, "exact"); // exact case-insensitive
});

test("prefix match: 'Renata' → 'Renata Glasc' (unambiguous)", () => {
  const r = matchChampionName("Renata", champions);
  assert.equal(r.championId, "4");
  assert.equal(r.confidence, "prefix");
});

test("prefix match: 'Jarvan' → 'Jarvan IV' (unambiguous)", () => {
  const r = matchChampionName("Jarvan", champions);
  assert.equal(r.championId, "5");
  assert.equal(r.confidence, "prefix");
});

test("ambiguous prefix returns none", () => {
  // "Ka" matches Kai'Sa, Karma, Karthus, Kassadin → ambiguous
  const r = matchChampionName("Ka", champions);
  assert.equal(r.championId, null);
  assert.equal(r.confidence, "none");
});

test("empty or null input returns none", () => {
  assert.equal(matchChampionName("", champions).confidence, "none");
  assert.equal(matchChampionName(null, champions).confidence, "none");
  assert.equal(matchChampionName(undefined, champions).confidence, "none");
  assert.equal(matchChampionName("   ", champions).confidence, "none");
});

test("no match returns none confidently", () => {
  const r = matchChampionName("ZzzUnknownChamp", champions);
  assert.equal(r.championId, null);
  assert.equal(r.confidence, "none");
});

test("'Dr Mundo' (no period) normalizes to 'Dr. Mundo'", () => {
  const r = matchChampionName("Dr Mundo", champions);
  assert.equal(r.championId, "10");
  assert.equal(r.confidence, "normalized");
});
