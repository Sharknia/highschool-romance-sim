import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

export interface TabListItem {
  id: string;
  label: ReactNode;
  to: string;
  badge?: ReactNode;
  status?: ReactNode;
  disabled?: boolean;
}

interface TabListProps {
  ariaLabel: string;
  items: TabListItem[];
  onBeforeNavigate?: (item: TabListItem) => boolean;
}

export function TabList({ ariaLabel, items, onBeforeNavigate }: TabListProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const tabRefs = useRef(new Map<string, HTMLAnchorElement>());

  function isActiveTab(item: TabListItem): boolean {
    return location.pathname === item.to || location.pathname.endsWith(`/${item.id}`);
  }

  function navigateTo(item: TabListItem): boolean {
    if (item.disabled) {
      return false;
    }
    if (isActiveTab(item)) {
      return false;
    }
    if (onBeforeNavigate?.(item) === false) {
      return false;
    }
    navigate(item.to);
    return true;
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    const enabledItems = items.filter((item) => !item.disabled);
    if (enabledItems.length <= 1) {
      return;
    }
    const activeIndex = enabledItems.findIndex((item) => isActiveTab(item));
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const currentIndex = activeIndex >= 0 ? activeIndex : 0;
    const next = enabledItems[(currentIndex + delta + enabledItems.length) % enabledItems.length];
    if (!next || isActiveTab(next)) {
      return;
    }
    event.preventDefault();
    if (navigateTo(next)) {
      window.setTimeout(() => tabRefs.current.get(next.id)?.focus(), 0);
    }
  }

  function setTabRef(id: string, element: HTMLAnchorElement | null): void {
    if (!element) {
      tabRefs.current.delete(id);
      return;
    }
    tabRefs.current.set(id, element);
  }

  return (
    <nav aria-label={ariaLabel}>
      <div className="tab-list" onKeyDown={handleKey} role="tablist">
        {items.map((item) => {
          const isActive = isActiveTab(item);
          return (
            <NavLink
              aria-disabled={item.disabled || undefined}
              aria-selected={isActiveTab(item)}
              className={isActive ? "tab-list-item active" : "tab-list-item"}
              key={item.id}
              onClick={(event) => {
                if (item.disabled) {
                  event.preventDefault();
                  return;
                }
                if (isActiveTab(item)) {
                  return;
                }
                if (onBeforeNavigate?.(item) === false) {
                  event.preventDefault();
                }
              }}
              ref={(element) => setTabRef(item.id, element)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              to={item.to}
            >
              <span>{item.label}</span>
              {item.badge ? <small>{item.badge}</small> : null}
              {item.status ? <small>{item.status}</small> : null}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
