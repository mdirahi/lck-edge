import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border-soft)] bg-[color:rgba(10,12,17,0.7)] backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3 text-sm">
        <Link
          href="/"
          className="font-semibold tracking-tight text-text transition-colors hover:text-accent"
        >
          LCK <span className="text-accent">Edge</span>
        </Link>

        <div className="hidden items-center gap-4 sm:flex">
          <NavLink href="/">Matches</NavLink>
          <NavLink href="/draft">Draft upload</NavLink>
          {user?.role === "admin" && (
            <>
              <NavLink href="/admin/users">Admin</NavLink>
              <NavLink href="/admin/audit">Audit</NavLink>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="badge-accent">LCK 2026 Spring</span>
          {user ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="hidden text-muted sm:inline">
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

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-muted transition-colors hover:text-text"
    >
      {children}
    </Link>
  );
}
