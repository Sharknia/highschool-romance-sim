import { AlertTriangle, Clock3, Eye, RotateCw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, ContentList, type ContentListState } from "../../components/ui";
import type { RecentProject } from "./projectPageTypes";

type RecentProjectListState = "loading" | "empty" | "ready" | "error" | "deleting";

interface ProjectListProps {
  busy: boolean;
  errorText?: string;
  listState: RecentProjectListState;
  loadedAt?: string;
  missingCount: number;
  projects: RecentProject[];
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

export function ProjectList({
  busy,
  errorText,
  listState,
  loadedAt,
  missingCount,
  projects,
  onOpen,
  onPrepareDelete,
  onPrepareReconnect,
  onRefresh,
  totalCount
}: ProjectListProps) {
  const [query, setQuery] = useState("");
  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return projects;
    }
    return projects.filter((entry) => [
      entry.title,
      entry.projectDirectory,
      entry.projectId
    ].some((value) => value.toLowerCase().includes(normalized)));
  }, [query, projects]);

  function openFromCard(entry: RecentProject): void {
    if (entry.missing) {
      onPrepareReconnect(entry);
      return;
    }
    onOpen(entry);
  }

  const effectiveListState: RecentProjectListState = listState === "ready" && projects.length === 0 ? "empty" : listState;

  const listStateConfig: ContentListState | undefined = (() => {
    if (effectiveListState === "loading") {
      return {
        kind: "loading",
        title: "로딩",
        description: "프로젝트 목록을 불러오는 중입니다."
      };
    }
    if (effectiveListState === "empty") {
      return {
        kind: "empty",
        title: "빈 목록",
        description: "아직 프로젝트가 없습니다.",
        action: (
          <Button disabled={busy} icon={<RotateCw size={16} />} onClick={onRefresh} variant="secondary">
            다시 시도
          </Button>
        )
      };
    }
    if (effectiveListState === "error") {
      return {
        kind: "error",
        title: "오류",
        description: errorText || "프로젝트 목록을 불러오지 못했습니다.",
        action: (
          <Button disabled={busy} icon={<RotateCw size={16} />} onClick={onRefresh} variant="secondary">
            다시 시도
          </Button>
        )
      };
    }
    if (effectiveListState === "deleting" && projects.length === 0) {
      return {
        kind: "busy",
        title: "삭제",
        description: "프로젝트 목록 항목을 삭제하는 중입니다."
      };
    }
    if (effectiveListState === "ready" && filteredProjects.length === 0) {
      return {
        kind: "empty",
        title: "필터 결과 없음",
        description: "필터 결과가 없습니다. 다른 제목이나 경로로 검색해 주세요."
      };
    }
    return undefined;
  })();

  return (
    <section className="page-panel recent-project-panel" aria-labelledby="projectsListTitle">
      <div className="section-header">
        <div>
          <p className="eyebrow">Projects</p>
          <h2 id="projectsListTitle">프로젝트 목록</h2>
        </div>
        <Button disabled={busy} icon={<RotateCw size={16} />} onClick={onRefresh}>
          새로고침
        </Button>
      </div>
      <div className="recent-project-toolbar">
        <label className="search-row">
          <Search size={16} />
          <input aria-label="프로젝트 필터" onChange={(event) => setQuery(event.target.value)} placeholder="제목, 경로, projectId로 필터" value={query} />
        </label>
        <div className="recent-project-counts">
          <span>총 {totalCount}개</span>
          <span>필터 결과 {filteredProjects.length}개</span>
          {missingCount > 0 ? <span className="state-chip state-warning">재연결이 필요한 프로젝트 {missingCount}개</span> : null}
          {loadedAt ? <span>갱신 {formatRecentProjectDate(loadedAt)}</span> : null}
        </div>
      </div>
      {/* 키보드 포커스: ContentList의 focus-visible outline이 목록 카드 선택 affordance를 유지합니다. */}
      <ContentList
        ariaLabel="프로젝트 목록"
        busy={busy || effectiveListState === "deleting"}
        state={listStateConfig}
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
              {entry.missing ? (
                <Button disabled={busy} icon={<RotateCw size={16} />} onClick={() => onPrepareReconnect(entry)} variant="primary">
                  재연결
                </Button>
              ) : null}
              <button
                aria-label={`${entry.title} 삭제`}
                className="icon-button icon-button-danger"
                disabled={busy}
                onClick={(event) => onPrepareDelete(entry, event.currentTarget)}
                type="button"
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </>
          )
        }))}
      />
    </section>
  );
}
