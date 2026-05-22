import { FolderKanban, Heart, LogOut, RefreshCw, Settings } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { describeSession, useAuth } from "../auth/AuthProvider";
import { AppShell, Button } from "./ui";

export const workspaceNavigationLabels = ["프로젝트 관리", "히로인 관리", "설정"];
export const workspaceNavigationPaths = ["/projects", "/heroines", "/settings"];

interface WorkspaceShellState {
  projectTitle: string;
  storageSummary: string;
  validationStatus: string;
}

interface WorkspaceShellContextValue {
  shellState: WorkspaceShellState;
  setShellState: (state: Partial<WorkspaceShellState>) => void;
}

const defaultShellState: WorkspaceShellState = {
  projectTitle: "프로젝트 없음",
  storageSummary: "저장 위치 미연결",
  validationStatus: "검증 미실행"
};

const WorkspaceShellContext = createContext<WorkspaceShellContextValue | null>(null);

const workspaceNavigation = [
  { label: workspaceNavigationLabels[0], path: workspaceNavigationPaths[0], icon: <FolderKanban size={18} /> },
  { label: workspaceNavigationLabels[1], path: workspaceNavigationPaths[1], icon: <Heart size={18} /> },
  { label: workspaceNavigationLabels[2], path: workspaceNavigationPaths[2], icon: <Settings size={18} /> }
];

function summarizeDirectory(projectDirectory?: string): string {
  if (!projectDirectory) {
    return defaultShellState.storageSummary;
  }
  const parts = projectDirectory.split(/[\\/]/).filter(Boolean);
  return parts.length > 2 ? `.../${parts.slice(-2).join("/")}` : projectDirectory;
}

export function WorkspaceLayout() {
  const { logout, refreshSession, session } = useAuth();
  const [shellState, setShellStateValue] = useState<WorkspaceShellState>(defaultShellState);
  const setShellState = useCallback((state: Partial<WorkspaceShellState>) => {
    setShellStateValue((current) => {
      const next = { ...current, ...state };
      return current.projectTitle === next.projectTitle
        && current.storageSummary === next.storageSummary
        && current.validationStatus === next.validationStatus
        ? current
        : next;
    });
  }, []);
  const contextValue = useMemo<WorkspaceShellContextValue>(() => ({
    shellState,
    setShellState
  }), [setShellState, shellState]);

  return (
    <WorkspaceShellContext.Provider value={contextValue}>
      <AppShell
        codexStatus={describeSession(session)}
        projectTitle={shellState.projectTitle}
        storageSummary={shellState.storageSummary}
        validationStatus={shellState.validationStatus}
        actions={(
          <>
            <Button icon={<RefreshCw size={16} />} onClick={() => void refreshSession()} variant="ghost">상태 갱신</Button>
            <Button icon={<LogOut size={16} />} onClick={() => void logout()} variant="secondary">로그아웃</Button>
          </>
        )}
      >
        <div className="workspace-layout">
          <nav className="workspace-nav" aria-label="앱 네비게이션">
            {workspaceNavigation.map((item) => (
              <NavLink className={({ isActive }) => isActive ? "workspace-nav-item active" : "workspace-nav-item"} key={item.path} to={item.path}>
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <main className="workspace-page">
            <Outlet />
          </main>
        </div>
      </AppShell>
    </WorkspaceShellContext.Provider>
  );
}

export function useWorkspaceShell() {
  const context = useContext(WorkspaceShellContext);
  if (!context) {
    throw new Error("WorkspaceLayout 안에서 useWorkspaceShell을 호출해야 합니다.");
  }
  return {
    ...context,
    summarizeDirectory
  };
}
