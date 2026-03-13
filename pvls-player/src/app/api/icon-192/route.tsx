import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "42px",
        }}
      >
        <div
          style={{
            fontSize: 108,
            fontWeight: 800,
            color: "#6366f1",
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          P
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
