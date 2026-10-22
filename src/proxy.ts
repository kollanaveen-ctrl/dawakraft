// Runs before every page: sends signed-out visitors from the app screens to /login.
// It only checks that a session cookie is present (no database call here); every API route
// still verifies the session properly. In demo mode there is no sign-in, so every page opens directly.
import { NextResponse, type NextRequest } from "next/server";
import { realMode } from "@/lib/config";
import { SESSION_COOKIE } from "@/lib/auth/session-token";

/** App screens that need sign-in. The landing page, /login and search-engine files stay public. */
const APP_PATHS = ["/catalog", "/new", "/product", "/import", "/export", "/company"];
const APP_HOME = "/catalog";

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

const isAppPath = (path: string) => APP_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!realMode) return path === "/login" ? redirectTo(request, APP_HOME) : NextResponse.next();
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  // The front door asks for the passcode too: signed-out visitors never see the landing page.
  if (!hasSession && (path === "/" || isAppPath(path))) return redirectTo(request, "/login");
  if (hasSession && path === "/login") return redirectTo(request, APP_HOME);
  return NextResponse.next();
}

export const config = {
  // Skip all Next.js internals (including the live-reload connection), the API routes, the PWA manifest, icons and the service worker.
  matcher: ["/((?!_next/|api/|favicon.ico|manifest.webmanifest|sw.js|pwa-icon|icon|apple-icon).*)"],
};
