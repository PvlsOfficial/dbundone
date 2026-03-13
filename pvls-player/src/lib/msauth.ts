// Microsoft OAuth PKCE flow for personal OneDrive access
// Token exchange happens directly in the browser (required for SPA client type)

export const GRAPH_SCOPES = "Files.Read Files.ReadWrite offline_access User.Read";

const VERIFIER_KEY = "pvls_pkce_verifier";
const TOKEN_KEY = "pvls_ms_tokens";
const TOKEN_ENDPOINT = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

export interface MSTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function randomBase64url(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function sha256Base64url(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ── Auth URL ──────────────────────────────────────────────────────────────────

export async function buildAuthUrl(clientId: string, redirectUri: string): Promise<string> {
  const verifier = randomBase64url(64);
  const challenge = await sha256Base64url(verifier);
  localStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: GRAPH_SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    response_mode: "query",
  });

  return `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params}`;
}

// ── Token exchange — directly from browser (SPA type requires this) ───────────

export async function exchangeCode(
  clientId: string,
  code: string,
  redirectUri: string
): Promise<MSTokens> {
  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error("PKCE verifier missing — please sign in again.");

  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    scope: GRAPH_SCOPES,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description ?? err.error ?? "Token exchange failed");
  }

  const data = await res.json();
  const tokens = toTokens(data);
  saveTokens(tokens);
  localStorage.removeItem(VERIFIER_KEY);
  return tokens;
}

export async function refreshTokens(clientId: string, refreshToken: string): Promise<MSTokens> {
  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: GRAPH_SCOPES,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description ?? err.error ?? "Token refresh failed");
  }

  const data = await res.json();
  const tokens = toTokens(data);
  saveTokens(tokens);
  return tokens;
}

function toTokens(data: Record<string, unknown>): MSTokens {
  return {
    access_token: data.access_token as string,
    refresh_token: data.refresh_token as string,
    expires_at: Date.now() + ((data.expires_in as number) - 60) * 1000,
  };
}

// ── Token storage ─────────────────────────────────────────────────────────────

export function saveTokens(tokens: MSTokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function loadTokens(): MSTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(VERIFIER_KEY);
}

export function isExpired(tokens: MSTokens): boolean {
  return Date.now() >= tokens.expires_at;
}
