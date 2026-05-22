import { AlertTriangle, Clock3, FolderOpen, RotateCw, Trash2 } from "lucide-react";
import { Button } from "../../components/ui";
import type { RecentProject } from "./projectPageTypes";

interface RecentProjectListProps {
  busy: boolean;
  recentProjects: RecentProject[];
  onOpen: (entry: RecentProject) => void;
  onPrepareReconnect: (entry: RecentProject) => void;
  onRefresh: () => void;
  onRemove: (entry: RecentProject) => void;
}

function formatDate(value?: string): string {
  if (!value) {
    return "기록 없음";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function validationLabel(value?: RecentProject["validationState"]): string {
  if (value === "valid") {
    return "검증 통과";
  }
  if (value === "invalid") {
    return "검증 필요";
  }
  if (value === "stale") {
    return "다시 검증 필요";
  }
  return "검증 대기";
}

export function RecentProjectList({
  busy,
  recentProjects,
  onOpen,
  onPrepareReconnect,
  onRefresh,
  onRemove
}: RecentProjectListProps) {
  return (
    <section className="page-panel recent-project-panel" aria-labelledby="recentProjectsTitle">
      <div className="section-header">
        <div>
          <p className="eyebrow">Recent</p>
          <h2 id="recentProjectsTitle">최근 프로젝트</h2>
        </div>
        <Button disabled={busy} icon={<RotateCw size={16} />} onClick={onRefresh}>
          새로고침
        </Button>
      </div>
      {recentProjects.length === 0 ? (
        <p className="page-muted">최근 프로젝트에서 찾을 수 없습니다. 프로젝트 디렉터리를 다시 열어 주세요.</p>
      ) : (
        <div className="recent-project-list">
          {recentProjects.map((entry) => (
            <article className={`recent-project-row${entry.missing ? " missing" : ""}`} key={entry.projectId}>
              <div className="recent-project-main">
                <strong>{entry.title}</strong>
                <span>{entry.projectDirectory}</span>
                <small><Clock3 size={14} /> 마지막 열림 {formatDate(entry.lastOpenedAt)} · {validationLabel(entry.validationState)}</small>
              </div>
              <div className="recent-project-state">
                {entry.missing ? (
                  <span className="state-chip state-warning"><AlertTriangle size={14} /> missing</span>
                ) : (
                  <span className="state-chip">ready</span>
                )}
              </div>
              <div className="recent-project-actions">
                <Button disabled={busy || entry.missing} icon={<FolderOpen size={16} />} onClick={() => onOpen(entry)}>
                  열기
                </Button>
                <Button disabled={busy} icon={<RotateCw size={16} />} onClick={() => onPrepareReconnect(entry)}>
                  재연결
                </Button>
                <Button disabled={busy} icon={<Trash2 size={16} />} onClick={() => onRemove(entry)} variant="ghost">
                  목록에서만 제거
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
