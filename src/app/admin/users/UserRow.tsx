"use client";

import { useTransition, useState } from "react";
import { removeUserAction } from "@/actions/inviteUser";

interface Props {
  mode: "active" | "pending";
  user: { id: string | null; email: string; role: "admin" | "viewer" };
  meId: string;
}

export function UserRow({ mode, user, meId }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isMe = mode === "active" && user.id === meId;

  function onRemove() {
    if (isMe) return;
    if (!confirm(`Remove ${user.email}?`)) return;
    setError(null);
    start(async () => {
      const res = mode === "active" && user.id
        ? await removeUserAction({ userId: user.id })
        : await removeUserAction({ email: user.email });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      <div className="flex-1">
        <div className="text-text">{user.email}</div>
        <div className="text-xs text-muted">
          {mode === "active" ? "active" : "pending first login"}
        </div>
      </div>
      <span className={`rounded border px-2 py-0.5 text-xs ${
        user.role === "admin"
          ? "border-accent/40 text-accent"
          : "border-border text-muted"
      }`}>
        {user.role}
      </span>
      {!isMe ? (
        <button
          onClick={onRemove}
          disabled={pending}
          className="rounded border border-bad/40 px-2 py-0.5 text-xs text-bad hover:bg-bad/10 disabled:opacity-50"
        >
          {pending ? "Removing\u2026" : "Remove"}
        </button>
      ) : (
        <span className="text-xs text-muted">(you)</span>
      )}
      {error && <span className="text-xs text-bad">{error}</span>}
    </div>
  );
}
