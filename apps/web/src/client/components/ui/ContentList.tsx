import type { ReactNode } from "react";

export interface ContentListItem {
  id: string;
  actions?: ReactNode;
  ariaLabel?: string;
  className?: string;
  description?: ReactNode;
  leading?: ReactNode;
  meta?: ReactNode;
  onSelect?: () => void;
  state?: ReactNode;
  title: ReactNode;
  tone?: "default" | "danger";
}

interface ContentListProps {
  ariaLabel: string;
  items: ContentListItem[];
}

export function ContentList({ ariaLabel, items }: ContentListProps) {
  return (
    <div aria-label={ariaLabel} className="content-list" role="list">
      {items.map((item) => {
        const selectable = Boolean(item.onSelect);
        const className = [
          "content-list-item",
          item.actions ? "with-actions" : "",
          item.tone === "danger" ? "danger" : "",
          item.className || ""
        ].filter(Boolean).join(" ");
        const selectClassName = [
          "content-list-select",
          item.leading ? "with-leading" : "",
          selectable ? "selectable" : ""
        ].filter(Boolean).join(" ");
        const itemContent = (
          <>
            {item.leading ? <span className="content-list-leading">{item.leading}</span> : null}
            <span className="content-list-main">
              <strong>{item.title}</strong>
              {item.description ? <span>{item.description}</span> : null}
              {item.meta ? <small>{item.meta}</small> : null}
            </span>
            {item.state ? <span className="content-list-state">{item.state}</span> : null}
          </>
        );

        return (
          <article
            className={className}
            key={item.id}
            role="listitem"
          >
            {selectable ? (
              <button
                aria-label={item.ariaLabel}
                type="button"
                className={selectClassName}
                onClick={item.onSelect}
              >
                {itemContent}
              </button>
            ) : (
              <div aria-label={item.ariaLabel} className={selectClassName}>
                {itemContent}
              </div>
            )}
            {item.actions ? (
              <div className="content-list-actions">{item.actions}</div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
