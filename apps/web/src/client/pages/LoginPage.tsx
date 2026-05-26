import { Navigate, useLocation } from "react-router-dom";

function getSafeNextPath(search: string): string {
  const next = new URLSearchParams(search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/settings";
  }

  try {
    const parsed = new URL(next, window.location.origin);
    if (parsed.origin !== window.location.origin || parsed.pathname.replace(/\/$/, "") === "/login") {
      return "/settings";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/settings";
  }
}

export function LoginPage() {
  const location = useLocation();
  return <Navigate to={getSafeNextPath(location.search)} replace />;
}
