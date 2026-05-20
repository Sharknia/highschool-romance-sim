import {
  buildProjectHtml,
  createImageGenerationJob,
  createStarterProject,
  validateProject,
  type CreateImageGenerationJobInput,
  type VnMakerProject
} from "@vn-maker/engine-core";

export interface ApiRequest {
  method: string;
  path: string;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getProject(body: unknown): VnMakerProject {
  const record = asRecord(body);
  if (!record.project) {
    throw new Error("project 입력이 필요합니다.");
  }
  return record.project as VnMakerProject;
}

function createGenerationJobInput(body: unknown): CreateImageGenerationJobInput {
  const record = asRecord(body);
  const kind = String(record.kind || "cg") as CreateImageGenerationJobInput["kind"];
  const targetId = String(record.targetId || "scene-opening");

  return {
    id: String(record.id || `job-${kind}-${targetId}-${Date.now()}`),
    kind,
    targetId,
    prompt: String(record.prompt || ""),
    style: String(record.style || "visual novel production asset"),
    outputAssetId: typeof record.outputAssetId === "string" ? record.outputAssetId : undefined
  };
}

export async function handleApiRequest(request: ApiRequest): Promise<ApiResponse> {
  try {
    if (request.method === "GET" && request.path === "/api/codex/session") {
      return {
        status: 200,
        body: {
          ok: true,
          connected: Boolean(process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY),
          mode: "server-api-key",
          note: "실제 Codex auth는 서버 어댑터에서 토큰 교환/세션 저장을 담당한다."
        }
      };
    }

    if (request.method !== "POST") {
      return { status: 405, body: { ok: false, error: "지원하지 않는 메서드입니다." } };
    }

    if (request.path === "/api/project/starter") {
      const body = asRecord(request.body);
      return { status: 200, body: { ok: true, project: createStarterProject(body.starter as object | undefined) } };
    }

    if (request.path === "/api/project/validate") {
      const issues = validateProject(getProject(request.body));
      return { status: 200, body: { ok: issues.every((issue) => issue.severity !== "error"), issues } };
    }

    if (request.path === "/api/project/build") {
      return { status: 200, body: { ok: true, artifact: buildProjectHtml(getProject(request.body)) } };
    }

    if (request.path === "/api/generation/jobs") {
      return { status: 200, body: { ok: true, job: createImageGenerationJob(createGenerationJobInput(request.body)) } };
    }

    return { status: 404, body: { ok: false, error: "알 수 없는 API 경로입니다." } };
  } catch (error) {
    return {
      status: 400,
      body: {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}
