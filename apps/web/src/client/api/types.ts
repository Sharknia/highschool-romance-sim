export type ApiFailureCode =
  | "EMPTY_RESPONSE"
  | "NON_JSON_RESPONSE"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "REQUEST_ABORTED";

export interface ApiResult {
  ok?: boolean;
  error?: string;
  message?: string;
  code?: ApiFailureCode | string;
  requestId?: string;
  issues?: Array<{ severity?: string; path?: string; message?: string }>;
  retryable?: boolean;
  httpStatus?: number;
  userSummary?: string;
  technicalDetail?: string;
  nextAction?: string;
  [key: string]: unknown;
}

export interface HeroineActionFailure extends ApiResult {
  ok: false;
  code:
    | "HEROINE_INPUT_INVALID"
    | "HEROINE_ID_RESERVED"
    | "HEROINE_NOT_FOUND"
    | "HEROINE_ID_CONFLICT"
    | "HEROINE_REVISION_CONFLICT"
    | "OAUTH_REQUIRED"
    | "IMAGE_GENERATION_UNAVAILABLE"
    | "SERVER_ERROR";
  message: string;
  error: string;
  retryable: boolean;
}

export interface CodexSessionResult extends ApiResult {
  connected: boolean;
  mode: string | null;
  requiresOpenaiAuth?: boolean;
  capabilities?: {
    imageGeneration?: boolean;
    namespaceTools?: boolean;
    webSearch?: boolean;
  } | null;
  account?: {
    email?: string;
    planType?: string | null;
  } | null;
}

export interface CodexLoginStart {
  authUrl?: string;
  loginId?: string;
  type?: string;
  userCode?: string;
  verificationUri?: string;
  verificationUrl?: string;
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
    id?: string;
    uri?: string;
  };
}

export interface ImageGenerationResult extends ApiResult, ImagePreviewResult {
  projectDirectory?: string;
  job?: {
    id?: string;
    outputAssetId?: string;
    status?: string;
  };
}
