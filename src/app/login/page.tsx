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
      <div className="card-hero">
        <h1 className="section-title">
          Sign in to <span className="text-accent">LCK Edge</span>
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Private research tool. Enter the email you were invited with and
          we&apos;ll send you a one-time sign-in link.
        </p>
        {error && (
          <div className="mt-4 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
            {decodeURIComponent(error)}
          </div>
        )}
        <div className="mt-5">
          <LoginForm redirectTo={dest} />
        </div>
      </div>
    </div>
  );
}
