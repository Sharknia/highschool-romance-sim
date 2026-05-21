import type { ReactNode } from "react";

interface PanelProps {
  actions?: ReactNode;
  children: ReactNode;
  eyebrow?: string;
  title: string;
}

export function Panel({ actions, children, eyebrow, title }: PanelProps) {
  return (
    <section className="panel-block">
      <header className="panel-header">
        <div>
          {eyebrow ? <p className="panel-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
