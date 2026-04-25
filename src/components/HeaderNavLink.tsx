"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}

export function HeaderNavLink({ href, exact, children }: Props) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} className={`nav-link${isActive ? " nav-link-active" : ""}`}>
      {children}
    </Link>
  );
}
