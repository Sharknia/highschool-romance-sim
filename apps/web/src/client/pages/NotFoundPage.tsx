import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="not-found">
      <p className="eyebrow">경로 확인</p>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>입력한 주소에 해당하는 제작 화면이 없습니다. 작업하던 영역으로 돌아가세요.</p>
      <div className="button-row">
        <Link to="/projects">프로젝트 관리로 이동</Link>
        <Link to="/heroines">히로인 관리로 이동</Link>
        <Link to="/settings">설정으로 이동</Link>
      </div>
    </section>
  );
}
