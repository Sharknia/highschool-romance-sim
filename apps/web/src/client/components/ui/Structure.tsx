import type { ReactNode } from "react";

type Tone = "neutral" | "waiting" | "success" | "warning" | "danger" | "error";

interface StatusChipProps {
  children: ReactNode;
  tone?: Tone;
}

export function StatusChip({ children, tone = "neutral" }: StatusChipProps) {
  return <span className={`status-chip status-chip-${tone}`}>{children}</span>;
}

interface StatusRegionProps {
  children: ReactNode;
  label?: string;
}

export function StatusRegion({ children, label = "화면 상태" }: StatusRegionProps) {
  return <div aria-label={label} className="status-region">{children}</div>;
}

interface PageHeaderProps {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  primaryAction?: ReactNode;
  title: ReactNode;
  titleId?: string;
}

export function PageHeader({ actions, description, eyebrow, meta, primaryAction, title, titleId }: PageHeaderProps) {
  return (
    <header className="page-hero page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 id={titleId}>{title}</h1>
        {description ? <p>{description}</p> : null}
        {meta ? <div className="entity-header-meta">{meta}</div> : null}
      </div>
      {primaryAction || actions ? (
        <div className="page-primary-action">
          {primaryAction}
          {actions}
        </div>
      ) : null}
    </header>
  );
}

interface EntitySummaryHeaderProps {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  media?: ReactNode;
  meta?: ReactNode;
  primaryAction?: ReactNode;
  status?: ReactNode;
  title: ReactNode;
  titleId?: string;
}

export function EntitySummaryHeader({
  actions,
  description,
  eyebrow,
  media,
  meta,
  primaryAction,
  status,
  title,
  titleId
}: EntitySummaryHeaderProps) {
  return (
    <header className="entity-summary-header">
      {media ? <div className="entity-summary-media">{media}</div> : null}
      <div className="entity-summary-main">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <div className="entity-summary-title-row">
          <h2 id={titleId}>{title}</h2>
          {status}
        </div>
        {description ? <p>{description}</p> : null}
        {meta ? <div className="entity-header-meta">{meta}</div> : null}
      </div>
      {primaryAction || actions ? (
        <div className="entity-summary-actions">
          {primaryAction}
          {actions}
        </div>
      ) : null}
    </header>
  );
}

interface PanelLikeProps {
  actions?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
  tone?: Tone;
}

export function ActionPanel({ actions, children, description, title, tone = "neutral" }: PanelLikeProps) {
  return (
    <section className={`action-panel action-panel-${tone}`}>
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
      {actions ? <div className="panel-actions">{actions}</div> : null}
    </section>
  );
}

export function ReadinessPanel({ actions, children, description, title, tone = "neutral" }: PanelLikeProps) {
  return (
    <section className={`readiness-panel readiness-panel-${tone}`}>
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
      {actions ? <div className="button-row">{actions}</div> : null}
    </section>
  );
}

export function AssetStatePanel({ actions, children, description, title, tone = "neutral" }: PanelLikeProps) {
  return (
    <section className={`asset-state-panel asset-state-panel-${tone}`}>
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
      {actions ? <div className="button-row">{actions}</div> : null}
    </section>
  );
}

interface FieldGroupProps {
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}

export function FieldGroup({ children, description, title }: FieldGroupProps) {
  return (
    <fieldset className="field-group">
      <legend>{title}</legend>
      {description ? <p>{description}</p> : null}
      {children}
    </fieldset>
  );
}

interface StickyActionBarProps {
  children: ReactNode;
  className?: string;
  summary?: ReactNode;
  title?: ReactNode;
}

export function StickyActionBar({ children, className = "", summary, title }: StickyActionBarProps) {
  return (
    <div className={`sticky-action-bar ${className}`.trim()}>
      {title || summary ? (
        <div className="sticky-action-summary">
          {title ? <strong>{title}</strong> : null}
          {summary ? <span>{summary}</span> : null}
        </div>
      ) : null}
      <div className="panel-actions">{children}</div>
    </div>
  );
}

interface TabStatusListProps {
  items: Array<{ id: string; label: ReactNode; status: ReactNode; tone?: Tone }>;
}

export function TabStatusList({ items }: TabStatusListProps) {
  return (
    <ul className="tab-status-list">
      {items.map((item) => (
        <li key={item.id}>
          <span>{item.label}</span>
          <StatusChip tone={item.tone}>{item.status}</StatusChip>
        </li>
      ))}
    </ul>
  );
}

interface EmptyStateProps {
  action?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
}

export function EmptyState({ action, description, icon, title }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon ? <span className="empty-state-icon" aria-hidden="true">{icon}</span> : null}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="button-row">{action}</div> : null}
    </div>
  );
}

interface DiagnosticDrawerProps {
  children: ReactNode;
  summary?: ReactNode;
}

export function DiagnosticDrawer({ children, summary = "진단 정보" }: DiagnosticDrawerProps) {
  return (
    <details className="diagnostic-drawer">
      <summary>{summary}</summary>
      <div className="diagnostic-drawer-body">{children}</div>
    </details>
  );
}
