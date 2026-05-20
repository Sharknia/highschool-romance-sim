import { LogIn, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { startBrowserLogin } from "../api/client";
import { describeSession, useAuth } from "../auth/AuthProvider";
import { Button, LoadingScreen, StatusBanner } from "../components/ui";

type LoginStage = "idle" | "opening" | "waiting" | "success" | "error";

function getSafeNextPath(search: string): string {
  const next = new URLSearchParams(search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  try {
    const parsed = new URL(next, window.location.origin);
    if (parsed.origin !== window.location.origin || parsed.pathname === "/login") {
      return "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

function getStatusTone(stage: LoginStage): "neutral" | "waiting" | "success" | "error" {
  if (stage === "opening" || stage === "waiting") {
    return "waiting";
  }
  if (stage === "success") {
    return "success";
  }
  if (stage === "error") {
    return "error";
  }
  return "neutral";
}

export function LoginPage() {
  const { refreshSession, session, status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const nextPath = useMemo(() => getSafeNextPath(location.search), [location.search]);
  const [stage, setStage] = useState<LoginStage>("idle");
  const [message, setMessage] = useState("브라우저 로그인으로 시작하세요.");
  const pollIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollIdRef.current !== null) {
        window.clearInterval(pollIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      navigate(nextPath, { replace: true });
    }
  }, [navigate, nextPath, status]);

  if (status === "checking") {
    return <LoadingScreen label="인증 상태 확인 중" />;
  }

  if (status === "authenticated") {
    return <Navigate to={nextPath} replace />;
  }

  async function pollUntilConnected(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 90;

    const poll = async (): Promise<boolean> => {
      attempts += 1;
      const nextSession = await refreshSession();
      if (nextSession.connected) {
        if (pollIdRef.current !== null) {
          window.clearInterval(pollIdRef.current);
          pollIdRef.current = null;
        }
        setStage("success");
        setMessage("로그인이 완료되었습니다. 제작툴로 이동합니다.");
        window.setTimeout(() => navigate(nextPath, { replace: true }), 350);
        return true;
      }

      if (attempts >= maxAttempts) {
        if (pollIdRef.current !== null) {
          window.clearInterval(pollIdRef.current);
          pollIdRef.current = null;
        }
        setStage("idle");
        setMessage("로그인이 아직 확인되지 않았습니다. 인증 완료 후 상태 갱신을 눌러주세요.");
      }
      return false;
    };

    const connected = await poll();
    if (!connected && pollIdRef.current === null && attempts < maxAttempts) {
      pollIdRef.current = window.setInterval(() => {
        void poll();
      }, 2000);
    }
  }

  async function handleLogin(): Promise<void> {
    if (pollIdRef.current !== null) {
      window.clearInterval(pollIdRef.current);
      pollIdRef.current = null;
    }

    const authWindow = window.open("about:blank", "_blank");
    if (!authWindow) {
      setStage("error");
      setMessage("로그인 창이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
      return;
    }

    try {
      setStage("opening");
      setMessage("로그인 창을 준비하고 있습니다.");
      await startBrowserLogin(authWindow);
      setStage("waiting");
      setMessage("열린 브라우저 창에서 로그인을 완료하면 자동으로 이동합니다.");
      await pollUntilConnected();
    } catch (error) {
      authWindow.close();
      setStage("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleRefresh(): Promise<void> {
    const nextSession = await refreshSession();
    if (nextSession.connected) {
      setStage("success");
      setMessage("로그인이 완료되었습니다. 제작툴로 이동합니다.");
      window.setTimeout(() => navigate(nextPath, { replace: true }), 250);
      return;
    }

    setStage(nextSession.error ? "error" : "idle");
    setMessage(nextSession.error || "아직 로그인이 확인되지 않았습니다.");
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="loginTitle">
        <div className="login-brand">
          <span className="brand-mark">VN</span>
          <span>VN Maker</span>
        </div>

        <div className="login-copy">
          <p className="eyebrow">제작툴 접근</p>
          <h1 id="loginTitle">브라우저에서 로그인하고 바로 이어서 작업하기</h1>
          <p>ChatGPT 인증을 완료하면 이 화면이 연결 상태를 확인하고 제작툴로 이동합니다.</p>
        </div>

        <div className="login-actions">
          <Button
            className="login-primary"
            disabled={stage === "opening" || stage === "waiting"}
            icon={<LogIn size={18} />}
            onClick={() => void handleLogin()}
            variant="primary"
          >
            브라우저로 로그인
          </Button>
          <Button
            icon={<RefreshCw size={17} />}
            onClick={() => void handleRefresh()}
            variant="secondary"
          >
            상태 갱신
          </Button>
        </div>

        <StatusBanner tone={getStatusTone(stage)}>{message}</StatusBanner>

        <div className="login-session">
          <ShieldCheck size={17} aria-hidden="true" />
          <span>{describeSession(session)}</span>
        </div>
      </section>
    </main>
  );
}
