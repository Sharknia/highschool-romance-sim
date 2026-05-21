import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { LoadingScreen } from "../components/ui";

function encodeNextPath(pathname: string, search: string, hash: string): string {
  return encodeURIComponent(`${pathname}${search}${hash}`);
}

export function AuthGate() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "checking") {
    return <LoadingScreen label="인증 상태 확인 중" />;
  }

  if (status !== "authenticated") {
    return <Navigate to={`/login?next=${encodeNextPath(location.pathname, location.search, location.hash)}`} replace />;
  }

  return <Outlet />;
}
