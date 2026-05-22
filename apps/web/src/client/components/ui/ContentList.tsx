import type { KeyboardEvent, ReactNode } from "react";

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

function handleSelectKey(event: KeyboardEvent<HTMLElement>, onSelect?: () => void): void {
  if (!onSelect || (event.key !== "Enter" && event.key !== " ")) {
    return;
  }
  event.preventDefault();
  onSelect();
}

export function ContentList({ ariaLabel, items }: ContentListProps) {
  return (
    <div aria-label={ariaLabel} className="content-list">
      {items.map((item) => {
        const selectable = Boolean(item.onSelect);
        const className = [
          "content-list-item",
          item.leading ? "with-leading" : "",
          item.tone === "danger" ? "danger" : "",
          item.className || ""
        ].filter(Boolean).join(" ");

        return (
          <article
            aria-label={item.ariaLabel}
            className={className}
            key={item.id}
            onClick={item.onSelect}
            onKeyDown={(event) => handleSelectKey(event, item.onSelect)}
            role={selectable ? "button" : "listitem"}
            tabIndex={selectable ? 0 : undefined}
          >
            {item.leading ? <div className="content-list-leading">{item.leading}</div> : null}
            <div className="content-list-main">
              <strong>{item.title}</strong>
              {item.description ? <span>{item.description}</span> : null}
              {item.meta ? <small>{item.meta}</small> : null}
            </div>
            {item.state ? <div className="content-list-state">{item.state}</div> : null}
            {item.actions ? (
              <div
                className="content-list-actions"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {item.actions}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
