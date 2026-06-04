import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_EMAILS = ["lungdrsumit@gmail.com"];
const ACCESS_COOKIE  = "clinic_access";

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Private access gate ─────────────────────────────────────────────────
  // All routes in the matcher must have a valid access cookie.
  const sitePassword = process.env.PRIVATE_SITE_PASSWORD;
  if (sitePassword) {
    const expectedCookie = await sha256hex(sitePassword);
    const cookie = request.cookies.get(ACCESS_COOKIE);
    if (cookie?.value !== expectedCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/access";
      return NextResponse.redirect(url);
    }
  }

  // ── 2. Supabase session / auth (only for /login + /workspace/**) ───────────
  if (!pathname.startsWith("/workspace") && pathname !== "/login") {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the session server-side — do not replace with getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated users trying to access workspace → send to login.
  if (!user && pathname.startsWith("/workspace")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated user whose email is not on the allowlist → access denied page.
  if (user && !ALLOWED_EMAILS.includes(user.email ?? "")) {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  // Authenticated allowed user hitting /login → send to workspace.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/workspace";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Protect the landing page, login, workspace, and dashboard.
  // /access and /api/** are intentionally excluded so the gate page
  // and its verify endpoint are always reachable.
  matcher: ["/", "/login", "/workspace/:path*", "/dashboard/:path*"],
};
