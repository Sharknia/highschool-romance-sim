import { useEffect, useMemo, useState } from "react";
import { LogOut, RefreshCw, ShieldCheck, SlidersHorizontal, Terminal, UploadCloud } from "lucide-react";
import { postJson, startBrowserLogin } from "../api/client";
import type { CodexLoginResponse } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button, DiagnosticDrawer, PageHeader, StatusBanner, StatusChip } from "../components/ui";
import { createSettingsStatusViewModel, type SettingsStatusTone } from "./settingsStatus";

type ActionState = "idle" | "running";

function bannerTone(tone: SettingsStatusTone): "neutral" | "waiting" | "success" | "warning" | "error" {
  return tone;
}

function chipTone(tone: SettingsStatusTone): "neutral" | "waiting" | "success" | "warning" | "error" {
  return tone;
}

function deviceLoginMessage(result: CodexLoginResponse): string {
  const login = result.login || {};
  const verificationUrl = login.verificationUrl || login.verificationUri || login.authUrl;
  const userCode = login.userCode ? ` · 코드 ${login.userCode}` : "";
  return verificationUrl
    ? `device flow 로그인 시작: ${verificationUrl}${userCode}`
    : "device flow 로그인 요청을 시작했습니다. Codex 인증 안내를 확인하세요.";
}

export function SettingsStartPage() {
  const { logout, refreshSession, session, status } = useAuth();
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (session) {
      setLastCheckedAt(new Date().toISOString());
    }
  }, [session]);

  const statusView = useMemo(() => createSettingsStatusViewModel({
    authStatus: status,
    session,
    lastCheckedAt
  }), [lastCheckedAt, session, status]);

  async function runAction(label: string, operation: () => Promise<string>) {
    setActionState("running");
    setActionError("");
    setActionMessage(`${label} 실행 중`);
    try {
      const message = await operation();
      setActionMessage(message);
    } catch (error) {
      setActionMessage("");
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setActionState("idle");
    }
  }

  function refreshCodexStatus() {
    void runAction("상태 갱신", async () => {
      await refreshSession();
      setLastCheckedAt(new Date().toISOString());
      return "Codex 연결 상태를 갱신했습니다.";
    });
  }

  function startBrowserCodexLogin() {
    const authWindow = window.open("", "_blank", "noopener,noreferrer");
    void runAction("브라우저 로그인", async () => {
      await startBrowserLogin(authWindow);
      return "브라우저 로그인 창을 열었습니다. 인증 후 상태 갱신을 눌러 연결 상태를 확인하세요.";
    });
  }

  function startDeviceFlowLogin() {
    void runAction("device flow 로그인", async () => {
      const result = await postJson<CodexLoginResponse>("/api/codex/login", { flow: "device" });
      if (result.ok === false) {
        throw new Error(result.error || result.message || "device flow 로그인 요청에 실패했습니다.");
      }
      return deviceLoginMessage(result);
    });
  }

  function logoutCodexConnection() {
    void runAction("로그아웃", async () => {
      await logout();
      setLastCheckedAt(new Date().toISOString());
      return "Codex 연결을 해제했습니다.";
    });
  }

  const busy = actionState === "running";
  const recentFailure = actionError || statusView.recentFailureText;

  return (
    <section className="app-page" aria-labelledby="settingsTitle">
      <PageHeader
        eyebrow="Settings"
        titleId="settingsTitle"
        title="설정"
        description="전역 API 연결 상태와 Alpha 제작 환경을 확인합니다."
        primaryAction={(
          <>
            <Button icon={<RefreshCw size={16} />} onClick={refreshCodexStatus} disabled={busy} variant="primary">
              {statusView.primaryActionLabel}
            </Button>
            <span>Codex 연결 문제는 이 화면에서 복구하고, 제작 데이터 편집은 각 작업 화면에서 처리합니다.</span>
          </>
        )}
      />

      <StatusBanner tone={bannerTone(statusView.statusTone)}>
        <span className="page-status">{actionError || actionMessage || statusView.statusText}</span>
      </StatusBanner>

      <section className="page-panel-grid">
        <article className="page-panel">
          <div className="page-panel-icon"><ShieldCheck size={18} /></div>
          <h2>Codex 연결</h2>
          <dl className="settings-list">
            <div><dt>연결</dt><dd><StatusChip tone={chipTone(statusView.statusTone)}>{statusView.connectionText}</StatusChip></dd></div>
            <div><dt>계정</dt><dd>{statusView.accountText}</dd></div>
            <div><dt>mode</dt><dd>{statusView.modeText}</dd></div>
            <div><dt>요금제</dt><dd>{statusView.planText}</dd></div>
            <div><dt>갱신</dt><dd>{statusView.lastCheckedText}</dd></div>
          </dl>
          <div className="button-row compact">
            <Button icon={<UploadCloud size={16} />} onClick={startBrowserCodexLogin} disabled={busy} variant="primary">
              브라우저 로그인
            </Button>
            <Button icon={<Terminal size={16} />} onClick={startDeviceFlowLogin} disabled={busy}>
              device flow 로그인
            </Button>
            <Button icon={<LogOut size={16} />} onClick={logoutCodexConnection} disabled={busy || !statusView.canLogout} variant="quiet">
              로그아웃
            </Button>
          </div>
          {recentFailure ? (
            <p className="page-muted">최근 실패: {recentFailure}</p>
          ) : null}
          {statusView.nextActionText ? (
            <p className="page-muted">다음 action: {statusView.nextActionText}</p>
          ) : null}
        </article>

        <article className="page-panel">
          <div className="page-panel-icon"><SlidersHorizontal size={18} /></div>
          <h2>생성 기본값</h2>
          <dl className="settings-list">
            <div><dt>이미지</dt><dd>{statusView.imageGenerationText}</dd></div>
            <div><dt>fallback</dt><dd>{statusView.fallbackPolicyText}</dd></div>
            <div><dt>대상</dt><dd>portrait, background, cg, expression</dd></div>
            <div><dt>결과</dt><dd>생성 결과는 프로젝트 에셋과 작업 결과에 연결합니다.</dd></div>
          </dl>
          <p className="page-muted">
            Codex 미연결 또는 이미지 생성 불가 상태에서는 실제 생성 성공으로 보고하지 않고 패키징 목 이미지 사용 상태로 표시합니다.
          </p>
        </article>

        <article className="page-panel">
          <div className="page-panel-icon"><UploadCloud size={18} /></div>
          <h2>저장소</h2>
          <dl className="settings-list">
            <div><dt>프로젝트</dt><dd>프로젝트 화면에서 선택한 로컬 VN Maker 저장 위치를 사용합니다.</dd></div>
            <div><dt>기본값</dt><dd>서버 VN_MAKER_PROJECT_DIR 또는 workspace/Default.vnmaker</dd></div>
            <div><dt>에셋</dt><dd>생성/목 이미지 결과는 프로젝트 assets/generated 경계에 연결합니다.</dd></div>
          </dl>
        </article>
      </section>

      <DiagnosticDrawer summary="raw 진단">
        <dl className="summary-list detail-summary">
          <div><dt>기술 상세</dt><dd>{statusView.technicalDetailText || "기술 상세 없음"}</dd></div>
          <div><dt>최근 action</dt><dd>{actionMessage || actionError || "action 없음"}</dd></div>
        </dl>
        <pre>{JSON.stringify(session, null, 2)}</pre>
      </DiagnosticDrawer>
    </section>
  );
}
