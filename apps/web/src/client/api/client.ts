import type { ApiResult, CodexLoginResponse, CodexSessionResult } from "./types";

export function isAuthFailure(result: ApiResult): boolean {
  return result.httpStatus === 401 || Boolean(result.error?.includes("OAuth 로그인이 필요"));
}

export async function postJson<T extends ApiResult = ApiResult>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json() as T;

  if (!response.ok && result.ok !== false) {
    return {
      ...result,
      ok: false,
      httpStatus: response.status,
      error: `요청이 실패했습니다. (${response.status})`
    } as T;
  }

  if (!response.ok) {
    return {
      ...result,
      httpStatus: response.status
    };
  }

  return result;
}

export async function readCodexSession(): Promise<CodexSessionResult> {
  try {
    const response = await fetch("/api/codex/session");
    const result = await response.json() as CodexSessionResult;

    if (!response.ok || result.ok === false) {
      return {
        ok: false,
        connected: false,
        mode: null,
        error: result.error || "Codex OAuth 상태를 확인할 수 없습니다."
      };
    }

    return {
      ...result,
      connected: Boolean(result.connected),
      mode: typeof result.mode === "string" ? result.mode : null
    };
  } catch (error) {
    return {
      ok: false,
      connected: false,
      mode: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function startBrowserLogin(authWindow: Window | null): Promise<CodexLoginResponse> {
  const result = await postJson<CodexLoginResponse>("/api/codex/login", { flow: "browser" });

  if (result.ok === false) {
    authWindow?.close();
    throw new Error(result.error || "로그인 요청에 실패했습니다.");
  }

  if (!result.login?.authUrl) {
    authWindow?.close();
    throw new Error("브라우저 로그인 URL을 받지 못했습니다.");
  }

  if (authWindow && !authWindow.closed) {
    authWindow.opener = null;
    authWindow.location.assign(result.login.authUrl);
  } else if (!window.open(result.login.authUrl, "_blank", "noopener,noreferrer")) {
    throw new Error("로그인 창이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
  }

  return result;
}

export async function logoutCodex(): Promise<ApiResult> {
  return postJson<ApiResult>("/api/codex/logout", {});
}
