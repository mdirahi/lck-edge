import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

async function signOut(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.nextUrl.origin));
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
  await sb.auth.signOut();
  return res;
}

export async function GET(req: NextRequest) { return signOut(req); }
export async function POST(req: NextRequest) { return signOut(req); }
