import { NextRequest, NextResponse } from "next/server";

/*
 * Dev-only access gate.
 *
 * Routes behind the key:
 *   /forecast — raw probabilistic engine (model internals, calibration, Greeks)
 *   /dev      — debug panel (health, runs, webhooks, seed data, email test)
 *   /docs     — redirects to FastAPI Swagger (backend API docs)
 *
 * End users without the key see /dashboard only.
 * The key is set server-side (no NEXT_PUBLIC_ prefix) so it never reaches the client.
 *
 * Unlock two ways:
 *   1. Secret URL:  /unlock?key=<DEV_ACCESS_KEY>  → sets cookie, redirects to /dev
 *   2. Keyboard:    Ctrl+Alt+D (any page) → prompts for key → /unlock endpoint
 *
 * Cookie: SHA-256 of the secret, httpOnly, 12-hour expiry.
 */

const COOKIE_NAME = "cf_dev_access";
const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

const GATED_PATHS = [
  "/forecast",
  "/dev",
  "/docs",
];

function isGated(pathname: string): boolean {
  return GATED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "#")
  );
}

async function tokenFor(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`cash-flow-dev::${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function proxy(req: NextRequest) {
  const secret = process.env.DEV_ACCESS_KEY;
  const { pathname, searchParams } = req.nextUrl;

  const toDashboard = () => {
    const dest = req.nextUrl.clone();
    dest.pathname = "/dashboard";
    dest.search = "";
    return NextResponse.redirect(dest);
  };

  // --- Unlock endpoint -------------------------------------------------------
  if (pathname === "/unlock") {
    if (!secret) return toDashboard();
    const key = searchParams.get("key") ?? "";
    if (key && key === secret) {
      // After unlocking, land on /dev (the debug panel) rather than /forecast
      const dest = req.nextUrl.clone();
      dest.pathname = "/dev";
      dest.search = "";
      const res = NextResponse.redirect(dest);
      res.cookies.set(COOKIE_NAME, await tokenFor(secret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      });
      return res;
    }
    return toDashboard();
  }

  // --- Gated routes ---------------------------------------------------------
  if (isGated(pathname)) {
    if (!secret) return toDashboard();
    const cookie = req.cookies.get(COOKIE_NAME)?.value;
    if (cookie && cookie === (await tokenFor(secret))) {
      return NextResponse.next();
    }
    return toDashboard();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/forecast",
    "/forecast/:path*",
    "/dev",
    "/dev/:path*",
    "/docs",
    "/unlock",
  ],
};
