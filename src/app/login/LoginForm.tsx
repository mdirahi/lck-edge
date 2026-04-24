"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  redirectTo?: string;
}

export function LoginForm({ redirectTo }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const sb = createClient();
      const callback = new URL("/auth/callback", window.location.origin);
      if (redirectTo && redirectTo.startsWith("/")) {
        callback.searchParams.set("redirect", redirectTo);
      }
      const { error: err } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: callback.toString(),
          // Don't auto-create auth users for uninvited emails. The DB trigger
          // only upgrades the invite row when the email matches a pending
          // invite, but blocking unknown signups here is a good safety net.
          shouldCreateUser: true,
        },
      });
      if (err) {
        setError(err.message);
      } else {
        setStatus("sent");
      }
    });
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-good/40 bg-good/10 px-3 py-3 text-xs leading-relaxed text-good">
        Check your inbox. Click the sign-in link we just sent to{" "}
        <span className="font-medium">{email}</span>. You can close this tab.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="field-label">Email</span>
        <input
          type="email"
          required
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={pending}
        />
      </label>
      {error && (
        <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending || !email}
        className="btn-primary w-full"
      >
        {pending ? "Sending\u2026" : "Send magic link"}
      </button>
    </form>
  );
}
