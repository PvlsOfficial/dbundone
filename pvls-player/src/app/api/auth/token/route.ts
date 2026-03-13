import { NextRequest, NextResponse } from "next/server";

const TOKEN_ENDPOINT = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const GRAPH_SCOPES = "Files.Read Files.ReadWrite offline_access User.Read";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientId, grant_type } = body;

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const params = new URLSearchParams();
  params.set("client_id", clientId);
  params.set("scope", GRAPH_SCOPES);

  if (grant_type === "authorization_code") {
    const { code, redirectUri, verifier } = body;
    if (!code || !redirectUri || !verifier) {
      return NextResponse.json({ error: "code, redirectUri, verifier required" }, { status: 400 });
    }
    params.set("grant_type", "authorization_code");
    params.set("code", code);
    params.set("redirect_uri", redirectUri);
    params.set("code_verifier", verifier);
  } else if (grant_type === "refresh_token") {
    const { refreshToken } = body;
    if (!refreshToken) {
      return NextResponse.json({ error: "refreshToken required" }, { status: 400 });
    }
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", refreshToken);
  } else {
    return NextResponse.json({ error: "Invalid grant_type" }, { status: 400 });
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("[MSAuth] Token error:", data);
    return NextResponse.json(
      { error: data.error_description ?? data.error ?? "Token request failed" },
      { status: res.status }
    );
  }

  return NextResponse.json(data);
}
