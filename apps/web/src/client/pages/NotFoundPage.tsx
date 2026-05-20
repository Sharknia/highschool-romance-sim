import { Link } from "react-router-dom";
import { AppShell } from "../components/ui";

export function NotFoundPage() {
  return (
    <AppShell>
      <main className="not-found">
        <p className="eyebrow">Protected</p>
        <h1>페이지를 찾을 수 없습니다</h1>
        <Link to="/">제작툴로 돌아가기</Link>
      </main>
    </AppShell>
  );
}
