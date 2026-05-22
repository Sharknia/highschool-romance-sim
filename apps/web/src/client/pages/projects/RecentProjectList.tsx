import { AlertTriangle, Clock3, FolderOpen, MoreVertical, RotateCw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, ContentList } from "../../components/ui";
import type { RecentProject } from "./projectPageTypes";

interface RecentProjectListProps {
  busy: boolean;
  loadedAt?: string;
  missingCount: number;
  recentProjects: RecentProject[];
  onOpen: (entry: RecentProject) => void;
  onPrepareReconnect: (entry: RecentProject) => void;
  onRefresh: () => void;
  onRemove: (entry: RecentProject) => void;
  totalCount: number;
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
  loadedAt,
  missingCount,
  recentProjects,
  onOpen,
  onPrepareReconnect,
  onRefresh,
  onRemove,
  totalCount
}: RecentProjectListProps) {
  const [query, setQuery] = useState("");
  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return recentProjects;
    }
    return recentProjects.filter((entry) => [
      entry.title,
      entry.projectDirectory,
      entry.projectId
    ].some((value) => value.toLowerCase().includes(normalized)));
  }, [query, recentProjects]);

  function openFromCard(entry: RecentProject): void {
    if (entry.missing) {
      onPrepareReconnect(entry);
      return;
    }
    onOpen(entry);
  }

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
      <div className="recent-project-toolbar">
        <label className="search-row">
          <Search size={16} />
          <input aria-label="최근 프로젝트 필터" onChange={(event) => setQuery(event.target.value)} placeholder="제목, 경로, projectId로 필터" value={query} />
        </label>
        <div className="recent-project-counts">
          <span>총 {totalCount}개</span>
          <span>필터 결과 {filteredProjects.length}개</span>
          {missingCount > 0 ? <span className="state-chip state-warning">재연결이 필요한 프로젝트 {missingCount}개</span> : null}
          {loadedAt ? <span>갱신 {formatDate(loadedAt)}</span> : null}
        </div>
      </div>
      {recentProjects.length === 0 ? (
        <p className="page-muted">최근 프로젝트에서 찾을 수 없습니다. 프로젝트 디렉터리를 다시 열어 주세요.</p>
      ) : filteredProjects.length === 0 ? (
        <p className="page-muted">필터 결과가 없습니다. 다른 제목이나 경로로 검색해 주세요.</p>
      ) : (
        <ContentList
          ariaLabel="최근 프로젝트 목록"
          items={filteredProjects.map((entry) => ({
            id: entry.projectId,
            className: entry.missing ? "missing" : "",
            title: entry.title,
            description: entry.projectDirectory,
            meta: (
              <>
                <Clock3 size={14} /> 마지막 열림 {formatDate(entry.lastOpenedAt)} · 마지막 검증 {formatDate(entry.lastValidatedAt)} · {validationLabel(entry.validationState)} · {entry.projectId}
              </>
            ),
            state: entry.missing ? (
              <span className="state-chip state-warning"><AlertTriangle size={14} /> missing</span>
            ) : (
              <span className="state-chip">ready</span>
            ),
            onSelect: () => openFromCard(entry),
            actions: (
              <>
                <Button disabled={busy || entry.missing} icon={<FolderOpen size={16} />} onClick={() => onOpen(entry)}>
                  열기
                </Button>
                <Button disabled={busy} icon={<RotateCw size={16} />} onClick={() => onPrepareReconnect(entry)} variant={entry.missing ? "primary" : "secondary"}>
                  재연결
                </Button>
                <details className="recent-project-menu">
                  <summary aria-label={`${entry.title} 추가 작업`}>
                    <MoreVertical size={17} />
                  </summary>
                  <Button disabled={busy} icon={<Trash2 size={16} />} onClick={() => onRemove(entry)} variant="ghost">
                    목록에서만 제거
                  </Button>
                </details>
              </>
            )
          }))}
        />
      )}
    </section>
  );
}
