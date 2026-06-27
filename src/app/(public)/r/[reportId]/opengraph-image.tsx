import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Phantom Reach Report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#f8fafc",
          padding: "68px 80px",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600, color: "#94a3b8", letterSpacing: 2 }}>
          PHANTOM REACH
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.08 }}>
            Local Business Intelligence
          </div>
          <div style={{ fontSize: 28, color: "#cbd5e1", maxWidth: 820, lineHeight: 1.35 }}>
            Audit reports and market scout analysis for local businesses.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 16, color: "#64748b" }}>
          Local workspace
        </div>
      </div>
    ),
    { ...size },
  );
}
