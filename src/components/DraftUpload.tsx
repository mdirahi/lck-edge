"use client";

import { useState, useTransition } from "react";
import { recognizeDraftAction, type RecognizedSide, type RecognizedSlot } from "@/actions/recognizeDraft";

interface Props {
  /** Called when recognition completes successfully. Parent (DraftForm)
   *  applies the results into its form state. */
  onApply: (result: { blue: RecognizedSide; red: RecognizedSide }) => void;
}

type SupportedMedia = "image/png" | "image/jpeg" | "image/webp" | "image/gif";
const ACCEPTED_TYPES: SupportedMedia[] = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function DraftUpload({ onApply }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setNotice(null);
    const f = e.target.files?.[0];
    if (!f) { setFile(null); setPreviewUrl(null); return; }
    if (!ACCEPTED_TYPES.includes(f.type as SupportedMedia)) {
      setError(`Unsupported file type: ${f.type || "unknown"}. Use PNG, JPG, WEBP or GIF.`);
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Image is larger than 5 MB. Crop or compress it first.");
      return;
    }
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function onRecognize() {
    if (!file) return;
    setError(null);
    setNotice(null);
    start(async () => {
      try {
        const base64 = await fileToBase64(file);
        const res = await recognizeDraftAction({
          imageBase64: base64,
          mediaType: file.type as SupportedMedia,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onApply({ blue: res.blue, red: res.red });
        setNotice(summarizeResult(res.blue, res.red));
      } catch (e: any) {
        setError(e?.message ?? "Recognition failed");
      }
    });
  }

  return (
    <div className="rounded-xl border border-[color:var(--border-soft)] bg-bg-elev/40 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="section-eyebrow">Recognize draft from screenshot</h4>
        <span className="text-[11px] text-muted">powered by Claude vision</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={onFileChange}
          className="text-xs text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-bg-elev/70 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text file:transition-colors hover:file:border-accent/60 hover:file:bg-[color:var(--panel-lift)]"
        />
        <button
          type="button"
          onClick={onRecognize}
          disabled={!file || pending}
          className="btn-primary btn-sm"
        >
          {pending ? "Recognizing…" : "Recognize"}
        </button>
      </div>

      {previewUrl && (
        <div className="mt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Draft screenshot preview"
            className="max-h-48 rounded-lg border border-[color:var(--border-soft)]"
          />
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-4 rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-xs text-good">
          {notice}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Upload a draft screenshot (champion select, broadcast overlay, or client) and I&rsquo;ll pre-fill the
        form below. Always review before saving — the model misses sometimes.
      </p>
    </div>
  );
}

function summarizeResult(blue: RecognizedSide, red: RecognizedSide): string {
  const blueHits = blue.picks.filter((p) => p.championId).length + blue.bans.filter((b) => b.championId).length;
  const redHits = red.picks.filter((p) => p.championId).length + red.bans.filter((b) => b.championId).length;
  const total = blueHits + redHits;
  const unknowns = [...blue.picks, ...blue.bans, ...red.picks, ...red.bans].filter(
    (s) => s.originalName && !s.championId
  );
  let msg = `Applied ${total} slot${total === 1 ? "" : "s"} (blue ${blueHits}, red ${redHits}).`;
  if (unknowns.length > 0) {
    const names = Array.from(new Set(unknowns.map((u) => u.originalName).filter(Boolean))).join(", ");
    msg += ` Could not match: ${names}.`;
  }
  msg += " Review and save.";
  return msg;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // Chunked btoa to avoid stack overflow on large images.
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

// Re-export for caller type convenience
export type { RecognizedSide, RecognizedSlot };
