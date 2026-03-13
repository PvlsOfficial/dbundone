"use client";

import { useState, useEffect, useCallback } from "react";
import {
  buildAuthUrl, exchangeCode, refreshTokens,
  loadTokens, clearTokens, isExpired,
  type MSTokens,
} from "@/lib/msauth";

export interface AuthState {
  tokens: MSTokens | null;
  loading: boolean;
  error: string | null;
}

const REDIRECT_PATH = "/";
const CLIENT_ID_KEY = "pvls_ms_client_id";

export function useAuth(envClientId: string) {
  // Prefer env var, fall back to what user saved in localStorage
  const clientId =
    envClientId ||
    (typeof window !== "undefined" ? (localStorage.getItem(CLIENT_ID_KEY) ?? "") : "");

  const [auth, setAuth] = useState<AuthState>({ tokens: null, loading: true, error: null });

  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}${REDIRECT_PATH}`
      : "";

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error");

      if (error) {
        setAuth({ tokens: null, loading: false, error: params.get("error_description") ?? error });
        window.history.replaceState({}, "", REDIRECT_PATH);
        return;
      }

      if (code && clientId) {
        try {
          const tokens = await exchangeCode(clientId, code, `${window.location.origin}${REDIRECT_PATH}`);
          setAuth({ tokens, loading: false, error: null });
        } catch (err) {
          setAuth({ tokens: null, loading: false, error: String(err) });
        }
        window.history.replaceState({}, "", REDIRECT_PATH);
        return;
      }

      const stored = loadTokens();
      if (!stored) {
        setAuth({ tokens: null, loading: false, error: null });
        return;
      }

      if (isExpired(stored) && clientId) {
        try {
          const fresh = await refreshTokens(clientId, stored.refresh_token);
          setAuth({ tokens: fresh, loading: false, error: null });
        } catch {
          clearTokens();
          setAuth({ tokens: null, loading: false, error: null });
        }
      } else {
        setAuth({ tokens: stored, loading: false, error: null });
      }
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount — clientId from localStorage is stable

  const login = useCallback(async (overrideClientId?: string) => {
    const id = overrideClientId ?? clientId;
    if (!id) return;
    const url = await buildAuthUrl(id, redirectUri);
    window.location.href = url;
  }, [clientId, redirectUri]);

  const logout = useCallback(() => {
    clearTokens();
    setAuth({ tokens: null, loading: false, error: null });
  }, []);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!auth.tokens) return null;
    if (!isExpired(auth.tokens)) return auth.tokens.access_token;

    if (!clientId) return null;
    try {
      const fresh = await refreshTokens(clientId, auth.tokens.refresh_token);
      setAuth((s) => ({ ...s, tokens: fresh }));
      return fresh.access_token;
    } catch {
      clearTokens();
      setAuth({ tokens: null, loading: false, error: null });
      return null;
    }
  }, [auth.tokens, clientId]);

  return { auth, login, logout, getValidToken };
}
