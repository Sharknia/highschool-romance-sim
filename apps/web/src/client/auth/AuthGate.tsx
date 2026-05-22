import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { LoadingScreen } from "../components/ui";
import { isAlphaSandboxEnabled } from "../runtimeConfig";

function encodeNextPath(pathname: string, search: string, hash: string): string {
  return encodeURIComponent(`${pathname}${search}${hash}`);
}

export function AuthGate() {
  const { status } = useAuth();
  const location = useLocation();
  const alphaSandboxEnabled = isAlphaSandboxEnabled();

  if (status === "checking" && !alphaSandboxEnabled) {
    return <LoadingScreen label="인증 상태 확인 중" />;
  }

  if (status !== "authenticated" && !alphaSandboxEnabled) {
    return <Navigate to={`/login?next=${encodeNextPath(location.pathname, location.search, location.hash)}`} replace />;
  }

  return <Outlet />;
}
