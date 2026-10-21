// Runs before every page: keeps the login session fresh and sends signed-out visitors to /login.
// In demo mode (no real Supabase keys yet) there is no sign-in, so every page opens directly.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseSettings } from "@/lib/config";

const PUBLIC_PATHS = ["/login", "/auth/"];
// The marketing home page and search-engine files are public; app screens need sign-in.
const PUBLIC_EXACT = new Set(["/", "/robots.txt", "/sitemap.xml", "/opengraph-image", "/icon.svg"]);
const APP_HOME = "/catalog";

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const settings = supabaseSettings();
  if (!settings) return path === "/login" ? redirectTo(request, APP_HOME) : NextResponse.next();
  if (PUBLIC_EXACT.has(path)) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(settings.url, settings.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!signedIn && !isPublic && !path.startsWith("/api/")) return redirectTo(request, "/login");
  if (signedIn && path === "/login") return redirectTo(request, APP_HOME);
  return response;
}

export const config = {
  // Skip all Next.js internals (including the live-reload connection), the PWA manifest, icons and the service worker.
  matcher: ["/((?!_next/|favicon.ico|manifest.webmanifest|sw.js|pwa-icon|icon|apple-icon).*)"],
};
