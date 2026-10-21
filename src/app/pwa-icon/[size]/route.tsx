// App icons for the home screen: the Dawakraft carton mark.
import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 512;
  const mark = Math.round(size * 0.78); // inner area stays inside the maskable safe zone
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#0E5E4E", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={mark} height={mark} viewBox="8 8 48 48">
          <path d="M32 13 50 23 32 33 14 23Z" fill="#E9A23B" />
          <path d="M14 23 32 33v20L14 43Z" fill="#FFFFFF" />
          <path d="M50 23 32 33v20l18-10Z" fill="#FFFFFF" fillOpacity="0.72" />
          <path d="M21 31.5 27 35" stroke="#0E5E4E" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
