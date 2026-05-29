import type { CodexSessionResult } from "../api/types";

export type SettingsAuthStatus = "checking" | "authenticated" | "anonymous";
export type SettingsStatusTone = "neutral" | "waiting" | "success" | "warning" | "error";

export interface SettingsStatusInput {
  authStatus: SettingsAuthStatus;
  session: CodexSessionResult | null;
  lastCheckedAt: string | null;
}

export interface SettingsStatusViewModel {
  statusTone: SettingsStatusTone;
  statusText: string;
  connectionText: string;
  imageGenerationText: string;
  fallbackPolicyText: string;
  accountText: string;
  planText: string;
  modeText: string;
  lastCheckedText: string;
  recentFailureText: string;
  technicalDetailText: string;
  nextActionText: string;
  primaryActionLabel: string;
  canLogout: boolean;
}

function formatLastChecked(value: string | null): string {
  if (!value) {
    return "아직 확인 전";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ko-KR", {
    dateStyle: "medium",
    timeStyle: "medium"
  });
}

function isConnectionRequired(session: CodexSessionResult | null): boolean {
  return session?.code === "OAUTH_REQUIRED" || Boolean(session?.error?.includes("OAuth 로그인이 필요"));
}

function isImageGenerationAvailable(session: CodexSessionResult | null): boolean {
  return Boolean(session?.connected && session.capabilities?.imageGeneration);
}

function sessionFailureText(session: CodexSessionResult | null): string {
  return String(session?.userSummary || session?.error || session?.message || "");
}

export function createSettingsStatusViewModel({
  authStatus,
  session,
  lastCheckedAt
}: SettingsStatusInput): SettingsStatusViewModel {
  if (authStatus === "checking" && !session) {
    return {
      statusTone: "waiting",
      statusText: "Codex 연결 상태를 확인하는 중입니다.",
      connectionText: "확인 중",
      imageGenerationText: "확인 중",
      fallbackPolicyText: "상태 확인 후 결정",
      accountText: "확인 중",
      planText: "확인 중",
      modeText: "확인 중",
      lastCheckedText: formatLastChecked(lastCheckedAt),
      recentFailureText: "",
      technicalDetailText: "",
      nextActionText: "잠시 후 상태가 자동 갱신됩니다.",
      primaryActionLabel: "상태 갱신",
      canLogout: false
    };
  }

  const connected = Boolean(session?.connected);
  const imageGenerationAvailable = isImageGenerationAvailable(session);
  const failedToRead = Boolean(session?.ok === false && !isConnectionRequired(session));
  const fallbackPolicyText = imageGenerationAvailable ? "실제 Codex 생성" : "패키징 목 이미지 사용";
  const recentFailureText = sessionFailureText(session);

  if (connected && imageGenerationAvailable) {
    return {
      statusTone: "success",
      statusText: "Codex 연결과 이미지 생성 상태가 준비되었습니다.",
      connectionText: "Codex 연결됨",
      imageGenerationText: "이미지 생성 가능",
      fallbackPolicyText,
      accountText: session?.account?.email || "계정 이메일 정보 없음",
      planText: session?.account?.planType || "요금제 정보 없음",
      modeText: session?.mode || "연결 mode 정보 없음",
      lastCheckedText: formatLastChecked(lastCheckedAt),
      recentFailureText: "",
      technicalDetailText: String(session?.technicalDetail || ""),
      nextActionText: "이미지 생성은 Codex 연결을 통해 프로젝트 에셋으로 저장됩니다.",
      primaryActionLabel: "상태 갱신",
      canLogout: true
    };
  }

  if (connected) {
    return {
      statusTone: "warning",
      statusText: "Codex는 연결됐지만 이미지 생성 기능을 사용할 수 없습니다.",
      connectionText: "Codex 연결됨",
      imageGenerationText: "이미지 생성 불가",
      fallbackPolicyText,
      accountText: session?.account?.email || "계정 이메일 정보 없음",
      planText: session?.account?.planType || "요금제 정보 없음",
      modeText: session?.mode || "연결 mode 정보 없음",
      lastCheckedText: formatLastChecked(lastCheckedAt),
      recentFailureText,
      technicalDetailText: String(session?.technicalDetail || ""),
      nextActionText: session?.nextAction ? String(session.nextAction) : "설정에서 Codex 연결 상태를 다시 확인하세요.",
      primaryActionLabel: "상태 갱신",
      canLogout: true
    };
  }

  return {
    statusTone: failedToRead ? "error" : "warning",
    statusText: failedToRead ? "Codex 상태를 확인하지 못했습니다." : "Codex 연결이 필요합니다.",
    connectionText: failedToRead ? "상태 확인 실패" : "Codex 연결 필요",
    imageGenerationText: "이미지 생성 불가",
    fallbackPolicyText,
    accountText: "연결 계정 없음",
    planText: "요금제 정보 없음",
    modeText: session?.mode || "연결 전",
    lastCheckedText: formatLastChecked(lastCheckedAt),
    recentFailureText,
    technicalDetailText: String(session?.technicalDetail || ""),
    nextActionText: session?.nextAction ? String(session.nextAction).replace(/ 또는 device flow 로그인/g, "") : "브라우저 로그인을 시작하세요.",
    primaryActionLabel: "상태 갱신",
    canLogout: false
  };
}
