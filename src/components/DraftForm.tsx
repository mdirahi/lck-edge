"use client";

import { useState, useTransition } from "react";
import { saveDraftAction, type SaveDraftSlotInput } from "@/actions/saveDraft";
import { DraftUpload, type RecognizedSide } from "./DraftUpload";
import type { Champion, RoleCode } from "@/lib/types";

interface InitialSlot {
  side: "blue" | "red";
  slot_type: "pick" | "ban";
  slot_index: number;
  role: RoleCode | null;
  champion_id: string | null;
}

interface Props {
  matchId: string;
  teamAId: string;
  teamATag: string;
  teamBId: string;
  teamBTag: string;
  champions: Champion[];
  initialBlueTeamId?: string;
  initialSlots?: InitialSlot[];
  initialNotes?: string;
}

const ROLES: RoleCode[] = ["TOP", "JNG", "MID", "ADC", "SUP"];

type SlotState = Record<string, { champion_id: string | null; role: RoleCode | null }>;

function slotKey(side: "blue" | "red", slotType: "pick" | "ban", slotIndex: number) {
  return `${side}:${slotType}:${slotIndex}`;
}

function buildInitialState(initialSlots?: InitialSlot[]): SlotState {
  const base: SlotState = {};
  for (const side of ["blue", "red"] as const) {
    for (let i = 0; i < 5; i++) {
      base[slotKey(side, "pick", i)] = { champion_id: null, role: ROLES[i] };
      base[slotKey(side, "ban", i)] = { champion_id: null, role: null };
    }
  }
  for (const s of initialSlots ?? []) {
    const k = slotKey(s.side, s.slot_type, s.slot_index);
    base[k] = { champion_id: s.champion_id, role: s.role };
  }
  return base;
}

export function DraftForm({
  matchId, teamAId, teamATag, teamBId, teamBTag, champions,
  initialBlueTeamId, initialSlots, initialNotes,
}: Props) {
  const [blueTeamId, setBlueTeamId] = useState(initialBlueTeamId ?? teamAId);
  const redTeamId = blueTeamId === teamAId ? teamBId : teamAId;
  const blueTag = blueTeamId === teamAId ? teamATag : teamBTag;
  const redTag = blueTeamId === teamAId ? teamBTag : teamATag;

  const [slots, setSlots] = useState<SlotState>(() => buildInitialState(initialSlots));
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function updateSlot(key: string, championId: string) {
    setSlots((prev) => ({
      ...prev,
      [key]: { ...prev[key], champion_id: championId || null },
    }));
    setSuccess(null);
  }

  /** Apply recognized picks/bans into the form state. Missing slots are left
   *  alone so partial recognitions don't wipe manually-entered data. */
  function applyRecognition(result: { blue: RecognizedSide; red: RecognizedSide }) {
    setSuccess(null);
    setError(null);
    setSlots((prev) => {
      const next = { ...prev };
      for (const side of ["blue", "red"] as const) {
        const r = result[side];
        for (const p of r.picks) {
          if (p.championId) {
            const k = slotKey(side, "pick", p.slot_index);
            next[k] = { champion_id: p.championId, role: p.role ?? ROLES[p.slot_index] };
          }
        }
        for (const b of r.bans) {
          if (b.championId) {
            const k = slotKey(side, "ban", b.slot_index);
            next[k] = { champion_id: b.championId, role: null };
          }
        }
      }
      return next;
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const slotArray: SaveDraftSlotInput[] = Object.entries(slots).map(([key, val]) => {
      const [side, slotType, idx] = key.split(":");
      return {
        side: side as "blue" | "red",
        slot_type: slotType as "pick" | "ban",
        slot_index: Number(idx),
        role: val.role,
        champion_id: val.champion_id,
      };
    });

    start(async () => {
      const res = await saveDraftAction({
        matchId,
        blueTeamId,
        redTeamId,
        slots: slotArray,
        notes: notes || undefined,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setSuccess("Draft saved.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-border bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Enter draft</h3>
        <label className="text-xs text-muted">
          Blue side:{" "}
          <select
            className="ml-1 rounded border border-border bg-bg/60 px-2 py-1 text-sm text-text"
            value={blueTeamId}
            onChange={(e) => setBlueTeamId(e.target.value)}
          >
            <option value={teamAId}>{teamATag}</option>
            <option value={teamBId}>{teamBTag}</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        <DraftUpload onApply={applyRecognition} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <SideColumn
          side="blue"
          tag={blueTag}
          champions={champions}
          slots={slots}
          onChange={updateSlot}
        />
        <SideColumn
          side="red"
          tag={redTag}
          champions={champions}
          slots={slots}
          onChange={updateSlot}
        />
      </div>

      <label className="mt-4 block text-xs text-muted">
        Notes (optional)
        <input
          className="mt-1 w-full rounded border border-border bg-bg/60 px-2 py-1.5 text-sm text-text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Kiin swap top, Chovy flex pick on mid"
        />
      </label>

      {error && (
        <div className="mt-3 rounded border border-bad/40 bg-bad/10 p-2 text-xs text-bad">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 rounded border border-good/40 bg-good/10 p-2 text-xs text-good">
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded bg-accent px-4 py-2 text-sm font-medium text-bg hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Saving\u2026" : "Save draft"}
      </button>
    </form>
  );
}

function SideColumn({
  side, tag, champions, slots, onChange,
}: {
  side: "blue" | "red";
  tag: string;
  champions: Champion[];
  slots: SlotState;
  onChange: (key: string, championId: string) => void;
}) {
  const accent = side === "blue" ? "text-accent" : "text-bad";
  const ring = side === "blue" ? "border-accent/40" : "border-bad/40";
  return (
    <div className={`rounded border ${ring} bg-bg/30 p-3`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>
        {side} side {"\u2014"} {tag}
      </div>

      <div className="mt-2 space-y-1.5">
        {ROLES.map((role, i) => {
          const key = slotKey(side, "pick", i);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="inline-block w-12 text-xs text-muted">{role}</span>
              <ChampionSelect
                value={slots[key]?.champion_id ?? ""}
                champions={champions}
                hintRole={role}
                onChange={(id) => onChange(key, id)}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-wide text-muted">Bans</div>
        <div className="mt-1 space-y-1">
          {[0, 1, 2, 3, 4].map((i) => {
            const key = slotKey(side, "ban", i);
            return (
              <ChampionSelect
                key={key}
                value={slots[key]?.champion_id ?? ""}
                champions={champions}
                onChange={(id) => onChange(key, id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ChampionSelect({
  value, champions, hintRole, onChange,
}: {
  value: string;
  champions: Champion[];
  hintRole?: RoleCode;
  onChange: (id: string) => void;
}) {
  // Put champions whose primary role matches the hint at the top, then the rest alphabetically.
  const sorted = [...champions].sort((a, b) => {
    const aMatch = hintRole && a.primary_role === hintRole ? 0 : 1;
    const bMatch = hintRole && b.primary_role === hintRole ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return a.display_name.localeCompare(b.display_name);
  });
  return (
    <select
      className="w-full rounded border border-border bg-bg/60 px-2 py-1 text-sm text-text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{"\u2013 none \u2013"}</option>
      {sorted.map((c) => (
        <option key={c.id} value={c.id}>
          {c.display_name}
          {c.primary_role ? ` (${c.primary_role})` : ""}
        </option>
      ))}
    </select>
  );
}
