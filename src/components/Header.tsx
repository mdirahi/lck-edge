import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { HeaderNavLink } from "./HeaderNavLink";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-30 border-b border-border-soft bg-[rgba(10,12,17,0.75)] backdrop-blur-xl">
      {/* Gradient hairline that sits under the border - subtle premium accent */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3.5 text-sm">
        <Link
          href="/"
          className="group inline-flex items-center gap-2.5 font-display text-text transition-colors"
        >
          <Logomark />
          <span className="font-semibold tracking-tight">
            LCK <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">Edge</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 sm:flex">
          <HeaderNavLink href="/" exact>Matches</HeaderNavLink>
          <HeaderNavLink href="/draft">Draft upload</HeaderNavLink>
          {user?.role === "admin" && (
            <>
              <HeaderNavLink href="/admin/users">Admin</HeaderNavLink>
              <HeaderNavLink href="/admin/audit">Audit</HeaderNavLink>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden badge-accent md:inline-flex">
            <span className="dot-accent dot-pulse" />
            LCK 2026 Season
          </span>
          {user ? (
            <div className="flex items-center gap-2.5 text-xs">
              <span className="hidden text-muted lg:inline">
                {user.email}{" "}
                <span className={user.role === "admin" ? "text-accent" : "text-muted"}>
                  ({user.role})
                </span>
              </span>
              <a href="/auth/signout" className="btn-ghost btn-sm">
                Sign out
              </a>
            </div>
          ) : (
            <Link href="/login" className="btn-ghost btn-sm">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

function Logomark() {
  return (
    <span
      aria-hidden
      className="relative inline-flex h-7 w-7 items-center justify-center rounded-lg border border-accent/30 bg-gradient-to-br from-accent/25 via-accent/5 to-accent-2/20 shadow-[0_0_18px_-6px_rgba(106,169,255,0.6)]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M13 3L4 14h6l-1 7 9-11h-6l1-7z"
          fill="currentColor"
          className="text-accent"
        />
      </svg>
    </span>
  );
}
