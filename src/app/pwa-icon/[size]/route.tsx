// App icons for the home screen: the Dawakraft folded-page mark.
import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/Logo";

const SIZES = new Set([180, 192, 512]);

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 512;
  const mark = Math.round(size * 0.78); // inner area stays inside the maskable safe zone
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#0E5E4E", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LogoMark size={mark} />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=3600, must-revalidate" } },
  );
}
