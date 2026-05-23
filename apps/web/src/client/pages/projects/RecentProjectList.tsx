import { AlertTriangle, Clock3, Eye, MoreVertical, RotateCw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, ContentList } from "../../components/ui";
import type { RecentProject } from "./projectPageTypes";

type RecentProjectListState = "loading" | "empty" | "ready" | "error" | "deleting";

interface RecentProjectListProps {
  busy: boolean;
  errorText?: string;
  listState: RecentProjectListState;
  loadedAt?: string;
  missingCount: number;
  recentProjects: RecentProject[];
  onOpen: (entry: RecentProject) => void;
  onPrepareDelete: (entry: RecentProject, trigger: HTMLElement) => void;
  onPrepareReconnect: (entry: RecentProject) => void;
  onRefresh: () => void;
  totalCount: number;
}

export function formatRecentProjectDate(value?: string): string {
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

function projectCurrentState(entry: RecentProject): string {
  return entry.missing ? "재연결 필요" : "열기 가능";
}

function projectStatusSummary(entry: RecentProject): string {
  return entry.missing ? "프로젝트 폴더를 찾을 수 없습니다." : validationLabel(entry.validationState);
}

function renderProjectField(label: string, value: string) {
  return (
    <span className="recent-project-field">
      <b>{label}</b> {value}
    </span>
  );
}

export function RecentProjectList({
  busy,
  errorText,
  listState,
  loadedAt,
  missingCount,
  recentProjects,
  onOpen,
  onPrepareDelete,
  onPrepareReconnect,
  onRefresh,
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

  const effectiveListState: RecentProjectListState = listState === "ready" && recentProjects.length === 0 ? "empty" : listState;

  function renderStateSurface() {
    if (effectiveListState === "loading") {
      return (
        <div className="page-empty-state" role="status">
          <strong>로딩</strong>
          <p>프로젝트 목록을 불러오는 중입니다.</p>
        </div>
      );
    }
    if (effectiveListState === "empty") {
      return (
        <div className="page-empty-state">
          <strong>빈 목록</strong>
          <p>아직 최근 프로젝트가 없습니다.</p>
          <Button disabled={busy} icon={<RotateCw size={16} />} onClick={onRefresh}>
            다시 시도
          </Button>
        </div>
      );
    }
    if (effectiveListState === "error") {
      return (
        <div className="page-empty-state" role="alert">
          <strong>오류</strong>
          <p>{errorText || "프로젝트 목록을 불러오지 못했습니다."}</p>
          <Button disabled={busy} icon={<RotateCw size={16} />} onClick={onRefresh}>
            다시 시도
          </Button>
        </div>
      );
    }
    if (effectiveListState === "deleting") {
      return (
        <div className="page-empty-state" role="status">
          <strong>삭제</strong>
          <p>최근 프로젝트 항목을 삭제하는 중입니다.</p>
        </div>
      );
    }
    return null;
  }

  const stateSurface = renderStateSurface();

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
          {loadedAt ? <span>갱신 {formatRecentProjectDate(loadedAt)}</span> : null}
        </div>
      </div>
      {stateSurface ? stateSurface : filteredProjects.length === 0 ? (
        <p className="page-muted">필터 결과가 없습니다. 다른 제목이나 경로로 검색해 주세요.</p>
      ) : (
        /* 키보드 포커스: ContentList의 focus-visible outline이 목록 카드 선택 affordance를 유지합니다. */
        <ContentList
          ariaLabel="최근 프로젝트 목록"
          items={filteredProjects.map((entry) => ({
            id: entry.projectId,
            className: entry.missing ? "missing" : "",
            title: entry.title,
            description: (
              <>
                {renderProjectField("저장 위치", entry.projectDirectory)}
                {renderProjectField("현재 상태", projectCurrentState(entry))}
                {renderProjectField("상태 요약", projectStatusSummary(entry))}
                {renderProjectField("최근 수정", formatRecentProjectDate(entry.lastValidatedAt))}
                {renderProjectField("마지막 작업 시각", formatRecentProjectDate(entry.lastOpenedAt))}
              </>
            ),
            meta: (
              <>
                <Clock3 size={14} /> 마지막 작업 시각 {formatRecentProjectDate(entry.lastOpenedAt)} · 최근 수정 {formatRecentProjectDate(entry.lastValidatedAt)} · {entry.projectId}
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
                <Button aria-label={`${entry.title} 상세보기 버튼`} disabled={busy} icon={<Eye size={16} />} onClick={() => openFromCard(entry)} variant="primary">
                  상세보기
                </Button>
                <Button disabled={busy} icon={<RotateCw size={16} />} onClick={() => onPrepareReconnect(entry)} variant={entry.missing ? "primary" : "secondary"}>
                  재연결
                </Button>
                <details className="recent-project-menu">
                  <summary aria-label={`${entry.title} 삭제 메뉴`}>
                    <MoreVertical size={17} />
                  </summary>
                  <div className="recent-project-menu-actions">
                    <Button className="icon-button-danger" disabled={busy} icon={<Trash2 size={16} />} onClick={(event) => onPrepareDelete(entry, event.currentTarget)} variant="ghost">
                      삭제
                    </Button>
                  </div>
                </details>
              </>
            )
          }))}
        />
      )}
    </section>
  );
}
