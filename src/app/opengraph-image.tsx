// The preview card shown when the site link is shared on WhatsApp, LinkedIn or X.
import { ImageResponse } from "next/og";

export const alt = "Dawakraft: medicine box photo to compliant product circular";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#F6F4EE", color: "#14201D" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="88" height="88" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="15" fill="#0E5E4E" />
            <path d="M32 13 50 23 32 33 14 23Z" fill="#E9A23B" />
            <path d="M14 23 32 33v20L14 43Z" fill="#FFFFFF" />
            <path d="M50 23 32 33v20l18-10Z" fill="#FFFFFF" fillOpacity="0.72" />
          </svg>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 800, letterSpacing: -2 }}>
            Dawa<span style={{ color: "#0E5E4E" }}>kraft</span>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 70, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.5, maxWidth: 980 }}>
          Medicine box to WhatsApp-ready circular in two minutes.
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 28, color: "#5B6863" }}>
          <span style={{ background: "#E9A23B", color: "#3A2600", padding: "6px 16px", borderRadius: 999 }}>AI that shows its evidence</span>
          <span style={{ background: "#DCEBE4", color: "#0E5E4E", padding: "6px 16px", borderRadius: 999 }}>Compliance checked</span>
        </div>
      </div>
    ),
    size,
  );
}
