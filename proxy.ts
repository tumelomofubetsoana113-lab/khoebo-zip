// A first, quick check (added 19 Nov 2026): anyone opening a trader or
// officer page without a session cookie goes to the log-in page, which sends
// them back afterwards. It only looks for the cookie. Each page, and the chat
// API, checks the session and the role against the database
// (components/auth/RequireRole.tsx and app/api/chat/route.ts).

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/trader/:path*", "/officer/:path*"],
};
