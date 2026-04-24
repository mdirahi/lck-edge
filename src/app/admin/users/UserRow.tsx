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
    <div className="flex items-center gap-3 py-2.5 text-sm">
      <div className="flex-1 min-w-0">
        <div className="truncate text-text">{user.email}</div>
        <div className="text-[11px] text-muted">
          {mode === "active" ? "active" : "pending first login"}
        </div>
      </div>
      <span className={user.role === "admin" ? "badge-accent" : "badge-muted"}>
        {user.role}
      </span>
      {!isMe ? (
        <button
          onClick={onRemove}
          disabled={pending}
          className="btn-ghost btn-sm !border-bad/40 !text-bad hover:!border-bad/70 hover:!bg-bad/10"
        >
          {pending ? "Removing\u2026" : "Remove"}
        </button>
      ) : (
        <span className="text-[11px] italic text-muted">(you)</span>
      )}
      {error && <span className="text-[11px] text-bad">{error}</span>}
    </div>
  );
}
