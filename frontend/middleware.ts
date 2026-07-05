import { NextRequest, NextResponse } from "next/server";

/*
 * Dev-only access gate.
 *
 * The technical forecaster ("/forecast") is not meant for end users. This
 * middleware runs on the server (Edge) so the secret never reaches the client
 * bundle. End users who hit "/forecast" without a valid dev cookie are quietly
 * redirected to the executive dashboard.
 *
 * Unlock (two ways, both land here):
 *   1. Secret URL:        /unlock?key=<DEV_ACCESS_KEY>
 *   2. Keyboard shortcut: Ctrl+Alt+D on any page prompts for the key, which
 *                         then navigates to the same /unlock endpoint.
 *
 * The cookie stores a SHA-256 token derived from the secret (never the raw
 * secret), is httpOnly (invisible to page JS), and expires after 12 hours.
 */

const COOKIE_NAME = "cf_dev_access";
const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

async function tokenFor(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`cash-flow-dev::${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  const secret = process.env.DEV_ACCESS_KEY;
  const { pathname, searchParams } = req.nextUrl;

  const toDashboard = () => {
    const dest = req.nextUrl.clone();
    dest.pathname = "/dashboard";
    dest.search = "";
    return NextResponse.redirect(dest);
  };

  // --- Unlock endpoint -----------------------------------------------------
  if (pathname === "/unlock") {
    // Not configured → behave as if the endpoint doesn't exist.
    if (!secret) return toDashboard();

    const key = searchParams.get("key") ?? "";
    if (key && key === secret) {
      const dest = req.nextUrl.clone();
      dest.pathname = "/forecast";
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
    // Wrong/empty key → no error leak, just bounce.
    return toDashboard();
  }

  // --- Gated technical view ------------------------------------------------
  if (pathname === "/forecast" || pathname.startsWith("/forecast/")) {
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
  matcher: ["/forecast", "/forecast/:path*", "/unlock"],
};
