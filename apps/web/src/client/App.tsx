import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { HeroineCreatePage } from "./pages/heroines/HeroineCreatePage";
import { HeroineDetailPage } from "./pages/heroines/HeroineDetailPage";
import { HeroineEditPage } from "./pages/heroines/HeroineEditPage";
import { HeroineListPage } from "./pages/heroines/HeroineListPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProjectStartPage } from "./pages/ProjectStartPage";
import { ProjectNewPage } from "./pages/projects/ProjectNewPage";
import { SettingsStartPage } from "./pages/SettingsStartPage";

function RootRedirect() {
  return <Navigate to="/heroines" replace />;
}

function ProjectOverviewRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  return <Navigate to={`/projects/${projectId}/overview`} replace />;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<WorkspaceLayout />}>
            <Route path="/projects" element={<ProjectStartPage />} />
            <Route path="/projects/new" element={<ProjectNewPage />} />
            <Route path="/projects/:projectId" element={<ProjectOverviewRedirect />} />
            <Route path="/projects/:projectId/overview" element={<ProjectStartPage />} />
            <Route path="/projects/:projectId/:tab" element={<ProjectStartPage />} />
            <Route path="/heroines" element={<HeroineListPage />} />
            <Route path="/heroines/new" element={<HeroineCreatePage />} />
            <Route path="/heroines/:heroineId" element={<HeroineDetailPage />} />
            <Route path="/heroines/:heroineId/edit" element={<HeroineEditPage />} />
            <Route path="/settings" element={<SettingsStartPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
