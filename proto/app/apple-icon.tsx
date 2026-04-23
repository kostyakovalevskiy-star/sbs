import { ImageResponse } from "next/og";

// iOS touch icon (homescreen shortcut)
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 120,
          fontWeight: 800,
          background: "#21A038",
          color: "#ffffff",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          letterSpacing: "-0.05em",
          borderRadius: 40,
        }}
      >
        S
      </div>
    ),
    { ...size }
  );
}
