import { useEffect, useRef, type MutableRefObject } from "react";

export function useUnsavedHeroineNavigationGuard(
  active: boolean,
  allowNavigationRef: MutableRefObject<boolean>,
  message: string
): void {
  const messageRef = useRef(message);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    function beforeunload(event: BeforeUnloadEvent): void {
      if (!active || allowNavigationRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }

    function shouldGuardHref(href: string | null): boolean {
      if (!href || href.startsWith("#")) {
        return false;
      }
      const nextUrl = new URL(href, window.location.href);
      return nextUrl.href !== window.location.href;
    }

    function onDocumentClick(event: MouseEvent): void {
      if (
        !active
        || allowNavigationRef.current
        || event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.altKey
        || event.ctrlKey
        || event.shiftKey
      ) {
        return;
      }
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!target || !shouldGuardHref(target.getAttribute("href"))) {
        return;
      }
      if (window.confirm(messageRef.current)) {
        allowNavigationRef.current = true;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("beforeunload", beforeunload);
    document.addEventListener("click", onDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeunload);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [active, allowNavigationRef]);
}
