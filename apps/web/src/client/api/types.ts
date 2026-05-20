export interface ApiResult {
  ok?: boolean;
  error?: string;
  httpStatus?: number;
  [key: string]: unknown;
}

export interface CodexSessionResult extends ApiResult {
  connected: boolean;
  mode: string | null;
  account?: {
    email?: string;
    planType?: string | null;
  } | null;
}

export interface CodexLoginStart {
  authUrl?: string;
  loginId?: string;
  type?: string;
}

export interface CodexLoginResponse extends ApiResult {
  login?: CodexLoginStart;
}

export interface ImagePreviewResult {
  image?: {
    dataUrl?: string;
    uri?: string;
  };
  asset?: {
    uri?: string;
  };
}
