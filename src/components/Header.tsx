import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-border bg-panel/60 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
        <Link href="/" className="font-semibold text-text hover:text-accent">
          LCK Edge
        </Link>
        <span className="text-muted">|</span>
        <Link href="/" className="text-muted hover:text-text">Matches</Link>
        <Link href="/draft" className="text-muted hover:text-text">Draft upload</Link>
        {user?.role === "admin" && (
          <>
            <Link href="/admin/users" className="text-muted hover:text-text">Admin</Link>
            <Link href="/admin/audit" className="text-muted hover:text-text">Audit</Link>
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          <div className="rounded-full border border-border px-3 py-0.5 text-xs text-muted">
            LCK 2026 Spring
          </div>
          {user ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted">
                {user.email}{" "}
                <span className={user.role === "admin" ? "text-accent" : "text-muted"}>
                  ({user.role})
                </span>
              </span>
              <a
                href="/auth/signout"
                className="rounded border border-border px-2 py-0.5 text-muted hover:text-text"
              >
                Sign out
              </a>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded border border-border px-2 py-0.5 text-xs text-muted hover:text-text"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
