import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  studioShell?: boolean;
  title?: string;
}

export function AppShell({
  children,
  studioShell = false,
  title = "VN Maker"
}: AppShellProps) {
  return (
    <section className={`app-shell ${studioShell ? "studio-shell" : ""}`}>
      {studioShell ? null : (
        <header className="topbar">
          <div className="topbar-main">
            <div className="brand-row" aria-label={title}>
              <span className="brand-mark">VN</span>
              <span>{title}</span>
            </div>
          </div>
        </header>
      )}
      {children}
    </section>
  );
}
