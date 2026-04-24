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
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 space-y-1.5 min-w-[220px]">
          <span className="field-label">Email</span>
          <input
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            disabled={pending}
          />
        </label>
        <label className="space-y-1.5">
          <span className="field-label">Role</span>
          <select
            className="select !w-auto"
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
          className="btn-primary"
        >
          {pending ? "Inviting\u2026" : "Invite"}
        </button>
      </div>
      {error && (
        <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-xs text-good">{success}</div>
      )}
    </form>
  );
}
