import { ImageResponse } from "next/og";

/** iOS home-screen icon (PNG is required; SVG is ignored by iOS). Placeholder artwork. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#ffffff",
        fontSize: 120,
        fontWeight: 700,
      }}
    >
      +
    </div>,
    size,
  );
}
