import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="not-found">
      <p className="eyebrow">Protected</p>
      <h1>페이지를 찾을 수 없습니다</h1>
      <Link to="/projects">프로젝트 관리로 돌아가기</Link>
    </section>
  );
}
