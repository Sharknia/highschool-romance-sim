import type { ApiResult, CodexLoginResponse, CodexSessionResult } from "./types";

export function isAuthFailure(result: ApiResult): boolean {
  return result.httpStatus === 401 || Boolean(result.error?.includes("OAuth 로그인이 필요"));
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function apiRequestFailure<T extends ApiResult = ApiResult>(error: unknown): T {
  const aborted = error instanceof Error && error.name === "AbortError";
  const technicalDetail = errorDetail(error);

  return {
    ok: false,
    code: aborted ? "REQUEST_ABORTED" : "NETWORK_ERROR",
    error: aborted ? "요청이 취소되었습니다." : technicalDetail,
    message: aborted ? "요청이 취소되었습니다." : "네트워크 오류로 API 요청에 실패했습니다.",
    userSummary: aborted ? "요청이 취소되었습니다." : "네트워크 연결을 확인해 주세요.",
    technicalDetail,
    nextAction: aborted ? "필요하면 다시 실행하세요." : "네트워크 상태를 확인한 뒤 다시 시도하세요.",
    retryable: !aborted
  } as T;
}

async function responseToApiResult<T extends ApiResult = ApiResult>(response: Response): Promise<T> {
  const httpStatus = response.status;
  const text = await response.text();
  if (!text.trim()) {
    return {
      ok: false,
      code: "EMPTY_RESPONSE",
      message: "서버 응답이 비어 있습니다.",
      error: `서버 응답이 비어 있습니다. API 서버가 실행 중인지 확인해주세요. (${httpStatus})`,
      userSummary: "서버 응답이 비어 있습니다.",
      technicalDetail: `HTTP ${httpStatus} returned an empty response body.`,
      nextAction: "요청을 다시 시도하세요.",
      retryable: true,
      httpStatus
    } as T;
  }

  let result: T;
  try {
    result = JSON.parse(text) as T;
  } catch {
    return {
      ok: false,
      code: "NON_JSON_RESPONSE",
      message: "서버 응답을 해석하지 못했습니다.",
      error: `서버 응답을 JSON으로 읽을 수 없습니다. (${httpStatus}) ${text.slice(0, 180)}`,
      userSummary: "서버 응답을 해석하지 못했습니다.",
      technicalDetail: text.slice(0, 180),
      nextAction: "API 서버 상태를 확인한 뒤 다시 시도하세요.",
      retryable: httpStatus >= 500,
      httpStatus
    } as T;
  }

  if (!response.ok) {
    const retryable = typeof result.retryable === "boolean" ? result.retryable : httpStatus >= 500;
    const message = result.message || "요청이 실패했습니다.";
    const error = result.error || result.message || `요청이 실패했습니다. (${httpStatus})`;

    return {
      ...result,
      ok: false,
      code: result.code || "HTTP_ERROR",
      message,
      error,
      userSummary: result.userSummary || (retryable ? "잠시 후 다시 시도해 주세요." : "요청 내용을 확인해 주세요."),
      technicalDetail: result.technicalDetail || result.error || result.message || `HTTP ${httpStatus}`,
      nextAction: result.nextAction || (retryable ? "다시 시도" : "입력값을 확인한 뒤 다시 시도하세요."),
      retryable,
      httpStatus
    } as T;
  }

  return result;
}

export async function postJson<T extends ApiResult = ApiResult>(path: string, body: unknown): Promise<T> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return await responseToApiResult<T>(response);
  } catch (error) {
    return apiRequestFailure<T>(error);
  }
}

export async function readCodexSession(): Promise<CodexSessionResult> {
  try {
    const response = await fetch("/api/codex/session");
    const result = await responseToApiResult<CodexSessionResult>(response);

    if (!response.ok || result.ok === false) {
      return {
        ...result,
        ok: false,
        connected: false,
        mode: null,
        error: result.error || "Codex 연결 상태를 확인할 수 없습니다."
      };
    }

    return {
      ...result,
      connected: Boolean(result.connected),
      mode: typeof result.mode === "string" ? result.mode : null
    };
  } catch (error) {
    return {
      ...apiRequestFailure<CodexSessionResult>(error),
      ok: false,
      connected: false,
      mode: null
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
