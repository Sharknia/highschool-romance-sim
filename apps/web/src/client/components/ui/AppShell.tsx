import type { ReactNode } from "react";

interface AppShellProps {
  actions?: ReactNode;
  children: ReactNode;
  codexStatus?: string;
  projectTitle?: string;
  storageSummary?: string;
  title?: string;
  validationStatus?: string;
}

export function AppShell({
  actions,
  children,
  codexStatus = "Codex ChatGPT OAuth: 확인 중",
  projectTitle = "프로젝트 없음",
  storageSummary = "저장 위치 미연결",
  title = "VN Maker",
  validationStatus = "검증 미실행"
}: AppShellProps) {
  return (
    <section className="app-shell">
      <header className="topbar">
        <div className="topbar-main">
          <div className="brand-row" aria-label={title}>
            <span className="brand-mark">VN</span>
            <span>{title}</span>
          </div>
          <dl className="topbar-meta" aria-label="전역 상태">
            <div>
              <dt>프로젝트</dt>
              <dd>{projectTitle || "프로젝트 없음"}</dd>
            </div>
            <div>
              <dt>저장 위치</dt>
              <dd>{storageSummary || "저장 위치 미연결"}</dd>
            </div>
            <div>
              <dt>검증</dt>
              <dd>{validationStatus || "검증 미실행"}</dd>
            </div>
            <div>
              <dt>Codex ChatGPT OAuth</dt>
              <dd>{codexStatus}</dd>
            </div>
          </dl>
        </div>
        {actions ? <div className="topbar-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
