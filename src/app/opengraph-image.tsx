// The preview card shown when the site link is shared on WhatsApp, LinkedIn or X.
import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/Logo";

export const alt = "Dawakraft — Clear product circulars. One organised catalogue.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#F6F4EE", color: "#14201D" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <LogoMark size={88} />
          <div style={{ display: "flex", fontSize: 56, fontWeight: 800, letterSpacing: -2 }}>
            Dawa<span style={{ color: "#0E5E4E" }}>kraft</span>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 70, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.5, maxWidth: 980 }}>
          Clear product circulars. One organised catalogue.
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 28, color: "#5B6863" }}>
          <span style={{ background: "#E9A23B", color: "#3A2600", padding: "6px 16px", borderRadius: 999 }}>Made for the pharma trade</span>
          <span style={{ background: "#DCEBE4", color: "#0E5E4E", padding: "6px 16px", borderRadius: 999 }}>AI-assisted. Human-reviewed.</span>
        </div>
      </div>
    ),
    size,
  );
}
