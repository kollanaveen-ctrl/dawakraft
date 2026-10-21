// App icons for the home screen, drawn from the Dawakraft capsule mark.
import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 512;
  const pill = Math.round(size * 0.5);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#0B7A63", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: pill,
            height: Math.round(pill * 0.45),
            borderRadius: pill,
            background: "linear-gradient(90deg, #F2B134 50%, #FFFFFF 50%)",
            transform: "rotate(-35deg)",
          }}
        />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
