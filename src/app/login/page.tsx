import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { redirect: dest, error } = await searchParams;

  const user = await getCurrentUser();
  if (user) {
    redirect(dest && dest.startsWith("/") ? dest : "/");
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="rounded-lg border border-border bg-panel p-6">
        <h1 className="text-lg font-semibold text-text">Sign in to LCK Edge</h1>
        <p className="mt-1 text-xs text-muted">
          Private research tool. Enter the email you were invited with and we&apos;ll send you a
          one-time sign-in link.
        </p>
        {error && (
          <div className="mt-3 rounded border border-bad/40 bg-bad/10 p-2 text-xs text-bad">
            {decodeURIComponent(error)}
          </div>
        )}
        <div className="mt-4">
          <LoginForm redirectTo={dest} />
        </div>
      </div>
    </div>
  );
}
