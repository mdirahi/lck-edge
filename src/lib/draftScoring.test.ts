import test from "node:test";
import assert from "node:assert/strict";
import { computeDraftStrength, type DraftSlotInput } from "./draftScoring.ts";
import { TIER_VALUE, OFF_ROLE_PENALTY } from "./championTiers.ts";

const BLUE = "team-blue";
const RED = "team-red";

function pick(
  side: "blue" | "red",
  role: DraftSlotInput["role"],
  champion: string,
  primaryRole: DraftSlotInput["role"] = role
): DraftSlotInput {
  return {
    side,
    slot_type: "pick",
    role,
    champion_display_name: champion,
    champion_primary_role: primaryRole,
  };
}

test("returns undefined when fewer than 3 picks per side", () => {
  const slots: DraftSlotInput[] = [
    pick("blue", "TOP", "Aatrox"),
    pick("blue", "JNG", "Vi"),
    pick("red", "TOP", "K'Sante"),
  ];
  const r = computeDraftStrength(slots, BLUE, RED, BLUE);
  assert.equal(r, undefined);
});

test("scores 5 full picks per side and averages correctly", () => {
  const slots: DraftSlotInput[] = [
    pick("blue", "TOP", "Aatrox"),
    pick("blue", "JNG", "Vi"),
    pick("blue", "MID", "Azir"),
    pick("blue", "ADC", "Jinx"),
    pick("blue", "SUP", "Nautilus"),
    pick("red", "TOP", "Sion"),
    pick("red", "JNG", "Graves"),
    pick("red", "MID", "Ahri"),
    pick("red", "ADC", "Senna"),
    pick("red", "SUP", "Bard"),
  ];
  const r = computeDraftStrength(slots, BLUE, RED, BLUE);
  assert.ok(r);
  // Blue team: A + A + S + A + A = 0.85+0.85+1.0+0.85+0.85 = 4.4 / 5 = 0.88
  assert.equal(r!.teamA.toFixed(2), "0.88");
  // Red team: C + B + B + C + C = 0.55+0.7+0.7+0.55+0.55 = 3.05 / 5 = 0.61
  assert.equal(r!.teamB.toFixed(2), "0.61");
  assert.equal(r!.aPickCount, 5);
  assert.equal(r!.bPickCount, 5);
});

test("teamAId=RED flips which side is A", () => {
  const slots: DraftSlotInput[] = [
    pick("blue", "TOP", "Sion"), pick("blue", "JNG", "Graves"),
    pick("blue", "MID", "Ahri"), pick("blue", "ADC", "Senna"), pick("blue", "SUP", "Bard"),
    pick("red", "TOP", "Aatrox"), pick("red", "JNG", "Vi"),
    pick("red", "MID", "Azir"), pick("red", "ADC", "Jinx"), pick("red", "SUP", "Nautilus"),
  ];
  const r = computeDraftStrength(slots, BLUE, RED, RED);
  assert.ok(r);
  assert.equal(r!.teamA.toFixed(2), "0.88"); // red side is A now
  assert.equal(r!.teamB.toFixed(2), "0.61");
});

test("applies off-role penalty when champion primary role differs from slot role", () => {
  // Aatrox in MID (primary TOP) should eat a 10% penalty
  const slots: DraftSlotInput[] = [
    pick("blue", "TOP", "K'Sante"),
    pick("blue", "JNG", "Vi"),
    pick("blue", "MID", "Aatrox", "TOP"), // off-role
    pick("blue", "ADC", "Jinx"),
    pick("blue", "SUP", "Nautilus"),
    pick("red", "TOP", "Aatrox"),
    pick("red", "JNG", "Vi"),
    pick("red", "MID", "Aatrox", "TOP"), // also off-role, same penalty
    pick("red", "ADC", "Jinx"),
    pick("red", "SUP", "Nautilus"),
  ];
  const r = computeDraftStrength(slots, BLUE, RED, BLUE);
  assert.ok(r);
  // Only difference is K'Sante (A=0.85) vs Aatrox (A=0.85 but same tier), so A==B
  assert.equal(r!.teamA.toFixed(2), r!.teamB.toFixed(2));
  // Verify penalty is actually being applied: manual calc
  // 4 full A picks + 1 A-tier off-role = 4*0.85 + 0.85*0.9 = 3.4 + 0.765 = 4.165 / 5 = 0.833
  assert.equal(r!.teamA.toFixed(3), "0.833");
});

test("unknown champions default to B tier and are surfaced in unknownChampions", () => {
  const slots: DraftSlotInput[] = [
    pick("blue", "TOP", "Aatrox"),
    pick("blue", "JNG", "Vi"),
    pick("blue", "MID", "SomeNewChampion"),
    pick("blue", "ADC", "Jinx"),
    pick("blue", "SUP", "Nautilus"),
    pick("red", "TOP", "K'Sante"),
    pick("red", "JNG", "Vi"),
    pick("red", "MID", "Azir"),
    pick("red", "ADC", "Jinx"),
    pick("red", "SUP", "Nautilus"),
  ];
  const r = computeDraftStrength(slots, BLUE, RED, BLUE);
  assert.ok(r);
  assert.ok(r!.unknownChampions.includes("SomeNewChampion"));
  // Blue: A+A+B+A+A = 0.85*4 + 0.70 = 4.10 / 5 = 0.82
  assert.equal(r!.teamA.toFixed(2), "0.82");
});

test("ignores bans and counts only picks", () => {
  const slots: DraftSlotInput[] = [
    { side: "blue", slot_type: "ban", role: null, champion_display_name: "Azir", champion_primary_role: "MID" },
    pick("blue", "TOP", "Aatrox"),
    pick("blue", "JNG", "Vi"),
    pick("blue", "MID", "Ahri"),
    pick("blue", "ADC", "Jinx"),
    pick("blue", "SUP", "Nautilus"),
    pick("red", "TOP", "K'Sante"),
    pick("red", "JNG", "Vi"),
    pick("red", "MID", "Ahri"),
    pick("red", "ADC", "Jinx"),
    pick("red", "SUP", "Nautilus"),
  ];
  const r = computeDraftStrength(slots, BLUE, RED, BLUE);
  assert.ok(r);
  assert.equal(r!.aPickCount, 5); // ban not counted
});
