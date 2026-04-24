import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Paths that should be reachable without a session.
const PUBLIC_PREFIXES = [
  "/login",
  "/auth/callback",
  "/auth/signout",
  "/_next",
  "/favicon",
  "/api/health",
];

function isPublic(pathname: string): boolean {
  for (const p of PUBLIC_PREFIXES) {
    if (pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p)) return true;
  }
  // Static file extensions (images, fonts, etc)
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|map)$/i.test(pathname)) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // This refreshes the auth token if needed and keeps cookies in sync.
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return res;
  }

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Preserve where they were going so we can bounce back post-login.
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

// Run on everything except Next internals and static assets.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
