import { NavLink } from "react-router-dom";
import { detailTabs, type ProjectData, type ProjectTabId } from "./projectPageTypes";

interface ProjectDetailViewProps {
  activeTab: ProjectTabId;
  currentProject: ProjectData | null;
  projectId?: string;
  shellProjectTitle: string;
}

export function ProjectDetailView({ activeTab, currentProject, projectId, shellProjectTitle }: ProjectDetailViewProps) {
  return (
    <section className="page-panel project-detail-panel" aria-labelledby="projectDetailTitle">
      <div className="section-header">
        <div>
          <p className="eyebrow">Project Detail</p>
          <h2 id="projectDetailTitle">{currentProject?.title || shellProjectTitle}</h2>
        </div>
        <span className="state-chip">{activeTab}</span>
      </div>
      {currentProject ? (
        <dl className="summary-list detail-summary">
          <div><dt>ID</dt><dd>{currentProject.id}</dd></div>
          <div><dt>개요</dt><dd>{currentProject.premise || "개요 없음"}</dd></div>
          <div><dt>히로인</dt><dd>{currentProject.characters?.length ?? 0}명</dd></div>
          <div><dt>루트/씬</dt><dd>{currentProject.routes?.length ?? 0}개 / {currentProject.scenes?.length ?? 0}개</dd></div>
        </dl>
      ) : (
        <p className="page-muted">상세 URL의 프로젝트를 복원하는 중입니다.</p>
      )}
      <nav className="project-tab-list" aria-label="프로젝트 상세 탭">
        {detailTabs.map((item) => (
          <NavLink className={({ isActive }) => isActive ? "project-tab active" : "project-tab"} key={item.id} to={`/projects/${currentProject?.id || projectId}/${item.id}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="detail-tab-body">
        {activeTab === "overview" ? "프로젝트 개요와 다음 행동을 확인합니다." : null}
        {activeTab === "heroine" ? "히로인 스냅샷 탭입니다. 후속 이슈에서 편집 흐름을 연결합니다." : null}
        {activeTab === "event" ? "제작/이벤트 탭입니다. 후속 이슈에서 자연어 이벤트 패치를 연결합니다." : null}
        {activeTab === "assets" ? "에셋/생성 탭입니다. 후속 이슈에서 CG 작업을 연결합니다." : null}
        {activeTab === "preview" ? "프리뷰 탭입니다. 후속 이슈에서 플레이 검증을 연결합니다." : null}
        {activeTab === "export" ? "내보내기 탭입니다. 후속 이슈에서 export와 smoke 결과를 연결합니다." : null}
      </div>
    </section>
  );
}
