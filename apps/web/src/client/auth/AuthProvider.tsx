import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isAuthFailure, logoutCodex, postJson, readCodexSession } from "../api/client";
import type { ApiResult, CodexSessionResult } from "../api/types";

type AuthStatus = "checking" | "authenticated" | "anonymous";
export type PostAuthedJson = <T extends ApiResult = ApiResult>(path: string, body: unknown) => Promise<T>;

interface AuthContextValue {
  status: AuthStatus;
  session: CodexSessionResult | null;
  refreshSession: () => Promise<CodexSessionResult>;
  postAuthedJson: PostAuthedJson;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const sessionRefreshIntervalMs = 15000;

function getStatus(session: CodexSessionResult): AuthStatus {
  return session.connected ? "authenticated" : "anonymous";
}

function createAnonymousSession(error?: string): CodexSessionResult {
  return {
    ok: false,
    connected: false,
    mode: null,
    account: null,
    error
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CodexSessionResult | null>(null);
  const [status, setStatus] = useState<AuthStatus>("checking");

  const applySession = useCallback((nextSession: CodexSessionResult) => {
    setSession(nextSession);
    setStatus(getStatus(nextSession));
  }, []);

  const markAnonymous = useCallback((error?: string) => {
    applySession(createAnonymousSession(error));
  }, [applySession]);

  const refreshSession = useCallback(async () => {
    const nextSession = await readCodexSession();
    applySession(nextSession);
    return nextSession;
  }, [applySession]);

  const postAuthedJson = useCallback(async <T extends ApiResult = ApiResult>(path: string, body: unknown): Promise<T> => {
    const result = await postJson<T>(path, body);
    if (isAuthFailure(result)) {
      markAnonymous(result.error || "Codex 연결이 필요합니다.");
    }
    return result;
  }, [markAnonymous]);

  const logout = useCallback(async () => {
    try {
      await logoutCodex();
    } finally {
      markAnonymous();
    }
  }, [markAnonymous]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshSession();
    }, sessionRefreshIntervalMs);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshSession();
      }
    };

    window.addEventListener("focus", refreshSession);
    window.addEventListener("pageshow", refreshSession);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshSession);
      window.removeEventListener("pageshow", refreshSession);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    refreshSession,
    postAuthedJson,
    logout
  }), [logout, postAuthedJson, refreshSession, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("AuthProvider 안에서 useAuth를 호출해야 합니다.");
  }
  return context;
}

export function describeSession(session: CodexSessionResult | null): string {
  if (!session) {
    return "Codex 연결: 확인 중";
  }

  if (session.mode === "alpha-sandbox") {
    return "Alpha Sandbox: fixture generation 활성";
  }

  if (session.connected) {
    const email = session.account?.email ? ` · ${session.account.email}` : "";
    const plan = session.account?.planType ? `/${session.account.planType}` : "";
    return `Codex 연결: ${session.mode || "연결됨"}${plan}${email}`;
  }

  return session.error ? "Codex 연결: 확인 실패" : "Codex 연결 필요";
}
