import type { ReactNode } from "react";

interface AppShellProps {
  actions?: ReactNode;
  children: ReactNode;
  title?: string;
}

export function AppShell({ actions, children, title = "VN Maker" }: AppShellProps) {
  return (
    <section className="app-shell">
      <header className="topbar">
        <div className="brand-row" aria-label={title}>
          <span className="brand-mark">VN</span>
          <span>{title}</span>
        </div>
        {actions ? <div className="topbar-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
