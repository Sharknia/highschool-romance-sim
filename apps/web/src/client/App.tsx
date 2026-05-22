import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthGate } from "./auth/AuthGate";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoadingScreen } from "./components/ui";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { isAlphaSandboxEnabled } from "./runtimeConfig";
import { HeroineStartPage } from "./pages/HeroineStartPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProjectStartPage } from "./pages/ProjectStartPage";
import { SettingsStartPage } from "./pages/SettingsStartPage";

function RootRedirect() {
  const { status } = useAuth();
  const alphaSandboxEnabled = isAlphaSandboxEnabled();

  if (status === "checking" && !alphaSandboxEnabled) {
    return <LoadingScreen label="인증 상태 확인 중" />;
  }

  return status === "authenticated" || alphaSandboxEnabled
    ? <Navigate to="/projects" replace />
    : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGate />}>
            <Route element={<WorkspaceLayout />}>
              <Route path="/projects" element={<ProjectStartPage />} />
              <Route path="/heroines" element={<HeroineStartPage />} />
              <Route path="/settings" element={<SettingsStartPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
