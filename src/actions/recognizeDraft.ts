"use server";

import { createServerClient } from "@/lib/supabase/server";
import { matchChampionName, type MatchConfidence } from "@/lib/championNameNormalizer";
import type { Champion, RoleCode } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

const PROMPT = `You are analyzing a League of Legends draft screenshot.

Identify every champion drafted. Respond with ONLY valid JSON, no markdown, no commentary:

{
  "blue_side": {
    "picks": [
      { "role": "TOP" | "JNG" | "MID" | "ADC" | "SUP", "champion": "string or null" }
    ],
    "bans": [ "string or null", ... ]
  },
  "red_side": { "picks": [...], "bans": [...] }
}

Rules:
- Use English champion names as they appear in the League client, with proper apostrophes and spaces. Examples: "K'Sante", "Kai'Sa", "Renata Glasc", "Jarvan IV", "Dr. Mundo", "Bel'Veth", "Vel'Koz", "Cho'Gath", "Kha'Zix".
- If a slot is not visible or you cannot identify it confidently, use null. Do not guess.
- Return up to 5 picks per side in role order (TOP, JNG, MID, ADC, SUP) - if you are unsure of the role, still order by lane top to bottom.
- Return up to 5 bans per side.
- If the image is not actually a draft screenshot, return {"blue_side": {"picks": [], "bans": []}, "red_side": {"picks": [], "bans": []}} with no error.`;

export type RecognizedSlot = {
  slot_index: number;
  role: RoleCode | null;
  originalName: string | null;
  championId: string | null;
  championDisplayName: string | null;
  confidence: MatchConfidence;
};

export type RecognizedSide = {
  picks: RecognizedSlot[];
  bans: RecognizedSlot[];
};

export type RecognizeDraftResult =
  | { ok: true; blue: RecognizedSide; red: RecognizedSide; rawModelText: string }
  | { ok: false; error: string };

interface RawSide {
  picks?: Array<{ role?: RoleCode | null; champion?: string | null }>;
  bans?: Array<string | null>;
}

interface RawResponse {
  blue_side?: RawSide;
  red_side?: RawSide;
}

/**
 * Accept a base64-encoded image from the client, ask Claude to identify the
 * champions drafted, normalize the output against our champions table, and
 * return structured results for the DraftForm to auto-fill.
 */
export async function recognizeDraftAction(input: {
  imageBase64: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
}): Promise<RecognizeDraftResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  if (me.role !== "admin") return { ok: false, error: "Admin role required to run draft recognition" };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "ANTHROPIC_API_KEY not set. Add it to .env.local and restart the dev server.",
    };
  }

  // Fetch champion list once so we can normalize names inline.
  const sb = createServerClient();
  const { data: championRows, error: champErr } = await sb
    .from("champions")
    .select("id, display_name, primary_role");
  if (champErr || !championRows) {
    return { ok: false, error: champErr?.message ?? "Failed to load champions" };
  }
  const champions = championRows as Champion[];

  let rawText: string;
  try {
    rawText = await callClaudeVision(apiKey, input.imageBase64, input.mediaType);
  } catch (e: any) {
    return { ok: false, error: `Vision API call failed: ${e?.message ?? String(e)}` };
  }

  let parsed: RawResponse;
  try {
    parsed = extractJson(rawText);
  } catch (e: any) {
    return {
      ok: false,
      error: `Could not parse model response as JSON. Raw response: ${rawText.slice(0, 200)}`,
    };
  }

  return {
    ok: true,
    blue: normalizeSide(parsed.blue_side, champions),
    red: normalizeSide(parsed.red_side, champions),
    rawModelText: rawText,
  };
}

async function callClaudeVision(
  apiKey: string,
  base64: string,
  mediaType: string
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const block = Array.isArray(data?.content) ? data.content.find((c: any) => c.type === "text") : null;
  if (!block?.text) throw new Error("Model returned no text content");
  return block.text as string;
}

/** Claude sometimes wraps JSON in triple-backtick fences despite the prompt; strip defensively. */
function extractJson(text: string): RawResponse {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  return JSON.parse(t) as RawResponse;
}

function normalizeSide(
  side: RawSide | undefined,
  champions: Champion[]
): RecognizedSide {
  const picks = normalizeSlots(side?.picks ?? [], "pick", champions);
  const bansRaw = (side?.bans ?? []).map((b) => ({ champion: b ?? null }));
  const bans = normalizeSlots(bansRaw, "ban", champions);
  return { picks, bans };
}

const ROLE_ORDER: RoleCode[] = ["TOP", "JNG", "MID", "ADC", "SUP"];

function normalizeSlots(
  raw: Array<{ role?: RoleCode | null; champion?: string | null }>,
  kind: "pick" | "ban",
  champions: Champion[]
): RecognizedSlot[] {
  const out: RecognizedSlot[] = [];
  for (let i = 0; i < Math.min(raw.length, 5); i++) {
    const r = raw[i];
    const match = matchChampionName(r?.champion ?? null, champions);
    const role: RoleCode | null =
      kind === "pick"
        ? (r?.role && ROLE_ORDER.includes(r.role) ? r.role : (ROLE_ORDER[i] ?? null))
        : null;
    out.push({
      slot_index: i,
      role,
      originalName: r?.champion ?? null,
      championId: match.championId,
      championDisplayName: match.championDisplayName,
      confidence: match.confidence,
    });
  }
  return out;
}
