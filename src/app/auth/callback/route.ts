import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createServerClient as createAdminClient } from "@/lib/supabase/server";

// Handle the magic link redirect. Supabase sends `code` back; we exchange it
// for a session cookie, then verify the user is in app_users. If they aren't,
// we sign them out and bounce to /login with an error.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const dest = url.searchParams.get("redirect");
  const safeDest = dest && dest.startsWith("/") ? dest : "/";

  if (!code) {
    return bounce(url, "Missing auth code.");
  }

  const res = NextResponse.redirect(new URL(safeDest, url.origin));
  const sb = createServerClient(
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

  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    return bounce(url, `Sign-in failed: ${error.message}`);
  }

  const { data: u } = await sb.auth.getUser();
  if (!u.user) {
    return bounce(url, "Sign-in failed: no user.");
  }

  // Gate: must have an app_users row.
  const admin = createAdminClient();
  const { data: appUser } = await admin
    .from("app_users")
    .select("id, role")
    .eq("id", u.user.id)
    .maybeSingle();

  if (!appUser) {
    await sb.auth.signOut();
    return bounce(
      url,
      "Your email isn't on the invite list. Ask the owner to add you."
    );
  }

  return res;
}

function bounce(url: URL, errorMsg: string): NextResponse {
  const login = new URL("/login", url.origin);
  login.searchParams.set("error", errorMsg);
  return NextResponse.redirect(login);
}
