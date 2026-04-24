"use client";

import { useState, useTransition } from "react";
import { inviteUserAction } from "@/actions/inviteUser";

export function InviteUserForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    start(async () => {
      const res = await inviteUserAction({ email, role });
      if (!res.ok) setError(res.error);
      else {
        setSuccess(`Invited ${email} as ${role}. They can now request a magic link.`);
        setEmail("");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-muted">
        Email
        <input
          type="email"
          required
          className="mt-1 block w-64 rounded border border-border bg-bg/60 px-2 py-1.5 text-sm text-text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="friend@example.com"
          disabled={pending}
        />
      </label>
      <label className="text-xs text-muted">
        Role
        <select
          className="mt-1 block rounded border border-border bg-bg/60 px-2 py-1.5 text-sm text-text"
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "viewer")}
          disabled={pending}
        >
          <option value="viewer">viewer (read-only)</option>
          <option value="admin">admin (edit everything)</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending || !email}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-bg hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Inviting\u2026" : "Invite"}
      </button>
      {error && (
        <div className="basis-full rounded border border-bad/40 bg-bad/10 p-2 text-xs text-bad">{error}</div>
      )}
      {success && (
        <div className="basis-full rounded border border-good/40 bg-good/10 p-2 text-xs text-good">{success}</div>
      )}
    </form>
  );
}
