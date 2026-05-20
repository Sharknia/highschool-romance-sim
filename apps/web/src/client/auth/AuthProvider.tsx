import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { logoutCodex, readCodexSession } from "../api/client";
import type { CodexSessionResult } from "../api/types";

type AuthStatus = "checking" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  session: CodexSessionResult | null;
  refreshSession: () => Promise<CodexSessionResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getStatus(session: CodexSessionResult): AuthStatus {
  return session.connected ? "authenticated" : "anonymous";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CodexSessionResult | null>(null);
  const [status, setStatus] = useState<AuthStatus>("checking");

  const refreshSession = useCallback(async () => {
    const nextSession = await readCodexSession();
    setSession(nextSession);
    setStatus(getStatus(nextSession));
    return nextSession;
  }, []);

  const logout = useCallback(async () => {
    await logoutCodex();
    const nextSession = await refreshSession();
    setSession(nextSession);
    setStatus("anonymous");
  }, [refreshSession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    refreshSession,
    logout
  }), [logout, refreshSession, session, status]);

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
    return "Codex OAuth: 확인 중";
  }

  if (session.connected) {
    const email = session.account?.email ? ` · ${session.account.email}` : "";
    const plan = session.account?.planType ? `/${session.account.planType}` : "";
    return `Codex OAuth: ${session.mode || "연결됨"}${plan}${email}`;
  }

  return session.error ? "Codex OAuth: 확인 실패" : "Codex OAuth: 로그인 필요";
}
