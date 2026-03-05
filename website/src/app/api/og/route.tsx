import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "Music Production Management";
  const description =
    searchParams.get("description") ||
    "Auto-discover and organize your FL Studio and Ableton projects.";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#090909",
          padding: "60px 80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top bar accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1)",
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(99, 102, 241, 0.15)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: 700,
              color: "#6366f1",
            }}
          >
            D
          </div>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#e5e5e5",
              letterSpacing: "-0.02em",
            }}
          >
            DBundone
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: "52px",
            fontWeight: 600,
            color: "#f5f5f5",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            marginBottom: "16px",
            maxWidth: "800px",
          }}
        >
          {title}
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: "22px",
            color: "#737373",
            lineHeight: 1.4,
            maxWidth: "700px",
          }}
        >
          {description}
        </div>

        {/* Bottom tag */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            left: "80px",
            fontSize: "14px",
            color: "#525252",
          }}
        >
          dbundone.com &middot; FL Studio & Ableton Live
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
