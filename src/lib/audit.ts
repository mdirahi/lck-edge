import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { AppUser } from "./auth";

export interface LogActionInput {
  actor: AppUser | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ok?: boolean;
  errorMsg?: string;
}

/**
 * Fire-and-forget audit log write. Never throws; if logging fails we just
 * console.error it so the primary action doesn't cascade-fail.
 */
export async function logAction(input: LogActionInput): Promise<void> {
  try {
    const sb = createServerClient();
    await sb.from("audit_log").insert({
      actor_id: input.actor?.id ?? null,
      actor_email: input.actor?.email ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      metadata: input.metadata ?? {},
      ok: input.ok ?? true,
      error_msg: input.errorMsg ?? null,
    });
  } catch (e) {
    console.error("[audit]", input.action, e);
  }
}
