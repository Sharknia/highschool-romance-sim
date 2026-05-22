import { FolderKanban, Heart, Settings } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { AppShell } from "./ui";

export const workspaceNavigation = [
  { label: "히로인 관리", path: "/heroines", icon: Heart },
  { label: "프로젝트 관리", path: "/projects", icon: FolderKanban },
  { label: "설정", path: "/settings", icon: Settings }
];

interface WorkspaceShellState {
  projectDirectory: string;
  projectTitle: string;
  validationStatus: string;
}

interface WorkspaceShellContextValue {
  shellState: WorkspaceShellState;
  setShellState: (state: Partial<WorkspaceShellState>) => void;
}

const defaultShellState: WorkspaceShellState = {
  projectDirectory: "",
  projectTitle: "프로젝트 없음",
  validationStatus: "검증 미실행"
};

const WorkspaceShellContext = createContext<WorkspaceShellContextValue | null>(null);

function summarizeDirectory(projectDirectory?: string): string {
  if (!projectDirectory) {
    return "저장 위치 미연결";
  }
  const parts = projectDirectory.split(/[\\/]/).filter(Boolean);
  return parts.length > 2 ? `.../${parts.slice(-2).join("/")}` : projectDirectory;
}

export function WorkspaceLayout() {
  const [shellState, setShellStateValue] = useState<WorkspaceShellState>(defaultShellState);
  const setShellState = useCallback((state: Partial<WorkspaceShellState>) => {
    setShellStateValue((current) => {
      const next = { ...current, ...state };
      return current.projectDirectory === next.projectDirectory
        && current.projectTitle === next.projectTitle
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
      <AppShell>
        <div className="workspace-layout">
          <nav className="workspace-nav" aria-label="앱 네비게이션">
            {workspaceNavigation.map((item) => (
              <NavLink className={({ isActive }) => isActive ? "workspace-nav-item active" : "workspace-nav-item"} key={item.path} to={item.path}>
                <span aria-hidden="true"><item.icon size={18} /></span>
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
