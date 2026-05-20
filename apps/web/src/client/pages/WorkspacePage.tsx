import { CheckCircle2, Code2, Database, ImagePlus, LogOut, RefreshCw, Save, Sparkles } from "lucide-react";
import { useState } from "react";
import type { ApiResult, ImagePreviewResult } from "../api/types";
import { describeSession, useAuth } from "../auth/AuthProvider";
import { AppShell, Button, Panel, StatusBanner } from "../components/ui";

const starterProject = {
  id: "web-starter",
  title: "웹 제작툴 샘플",
  premise: "Codex와 함께 미연시를 제작하는 첫 프로젝트"
};

function formatResult(result: unknown): string {
  return JSON.stringify(result, (key, value) => {
    if ((key === "b64Json" || key === "dataUrl" || key === "result") && typeof value === "string" && value.length > 160) {
      return `${value.slice(0, 160)}... (${value.length} chars)`;
    }
    return value;
  }, 2);
}

function truncateArtifactHtml(result: ApiResult): ApiResult {
  const artifact = result.artifact;
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    return result;
  }

  const artifactRecord = artifact as { html?: string };
  if (!artifactRecord.html || artifactRecord.html.length <= 1200) {
    return result;
  }

  return {
    ...result,
    artifact: {
      ...artifactRecord,
      html: `${artifactRecord.html.slice(0, 1200)}\n...`
    }
  };
}

function isHttpFailure(result: unknown): result is ApiResult {
  return Boolean(
    result
      && typeof result === "object"
      && "httpStatus" in result
      && typeof (result as ApiResult).httpStatus === "number"
      && ((result as ApiResult).httpStatus || 0) >= 400
  );
}

function projectPayloadFromEditor(projectJson: string): { project?: unknown; starter?: unknown } {
  const parsed = JSON.parse(projectJson) as Record<string, unknown>;
  return parsed.version === "vn-maker/v1"
    ? { project: parsed }
    : { starter: parsed.starter || parsed };
}

export function WorkspacePage() {
  const { logout, postAuthedJson, refreshSession, session } = useAuth();
  const [projectJson, setProjectJson] = useState(() => JSON.stringify({ starter: starterProject }, null, 2));
  const [projectDirectory, setProjectDirectory] = useState("");
  const [prompt, setPrompt] = useState("하루 루트의 첫 장면을 달달하게 확장하고,\n교실 배경과 하루 포트레이트 생성 작업을 만들어줘.");
  const [result, setResult] = useState("{}");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState("작업 대기 중");

  async function runAction(label: string, action: () => Promise<unknown>): Promise<void> {
    setWorkspaceStatus(`${label} 실행 중`);
    try {
      const actionResult = await action();
      if (isHttpFailure(actionResult)) {
        throw new Error(actionResult.error || `${label} 요청이 실패했습니다.`);
      }
      if (actionResult && typeof actionResult === "object") {
        const record = actionResult as ApiResult;
        if (typeof record.projectDirectory === "string") {
          setProjectDirectory(record.projectDirectory);
        }
        if (record.project) {
          setProjectJson(JSON.stringify(record.project, null, 2));
        }
      }
      setResult(formatResult(actionResult));
      setWorkspaceStatus(`${label} 완료`);
    } catch (error) {
      setResult(formatResult({ ok: false, error: error instanceof Error ? error.message : String(error) }));
      setWorkspaceStatus(`${label} 실패`);
    }
  }

  async function createStarterProject(): Promise<void> {
    await runAction("샘플 프로젝트 생성", async () => {
      return postAuthedJson<ApiResult>("/api/project/starter", { projectDirectory: projectDirectory || undefined, starter: starterProject });
    });
  }

  async function openProject(): Promise<void> {
    await runAction("프로젝트 열기", async () => postAuthedJson<ApiResult>("/api/project/open", {
      projectDirectory: projectDirectory || undefined
    }));
  }

  async function validateProject(): Promise<void> {
    await runAction("프로젝트 검증", async () => {
      return postAuthedJson<ApiResult>("/api/project/validate", {
        projectDirectory: projectDirectory || undefined,
        ...projectPayloadFromEditor(projectJson)
      });
    });
  }

  async function buildProject(): Promise<void> {
    await runAction("프로젝트 빌드", async () => {
      return truncateArtifactHtml(await postAuthedJson<ApiResult>("/api/project/build", {
        projectDirectory: projectDirectory || undefined,
        ...projectPayloadFromEditor(projectJson)
      }));
    });
  }

  async function saveFirstScene(): Promise<void> {
    await runAction("현재 첫 씬 저장", async () => {
      const payload = projectPayloadFromEditor(projectJson);
      const project = payload.project as { scenes?: unknown[] } | undefined;
      const scene = project?.scenes?.[0];
      if (!scene) {
        throw new Error("저장할 첫 씬이 없습니다.");
      }
      return postAuthedJson<ApiResult>("/api/project/scenes", { projectDirectory: projectDirectory || undefined, ...payload, scene });
    });
  }

  async function createImageJob(): Promise<void> {
    setPreviewSrc(null);
    await runAction("이미지 작업 생성", async () => postAuthedJson<ApiResult>("/api/generation/jobs", {
      projectDirectory: projectDirectory || undefined,
      ...projectPayloadFromEditor(projectJson),
      kind: "cg",
      targetId: "scene-opening",
      prompt,
      style: "soft visual novel, clean anime, production-ready"
    }));
  }

  async function generateImage(): Promise<void> {
    setPreviewSrc(null);
    await runAction("이미지 생성", async () => {
      const response = await postAuthedJson<ApiResult & ImagePreviewResult>("/api/generation/images", {
        projectDirectory: projectDirectory || undefined,
        ...projectPayloadFromEditor(projectJson),
        kind: "cg",
        targetId: "scene-opening",
        prompt,
        style: "soft visual novel, clean anime, production-ready"
      });
      setPreviewSrc(response.image?.dataUrl || response.image?.uri || response.asset?.uri || null);
      await refreshSession();
      return response;
    });
  }

  async function handleLogout(): Promise<void> {
    await logout();
  }

  return (
    <AppShell
      actions={(
        <>
          <span className="topbar-status">{describeSession(session)}</span>
          <Button icon={<RefreshCw size={16} />} onClick={() => void refreshSession()} variant="ghost">상태 갱신</Button>
          <Button icon={<LogOut size={16} />} onClick={() => void handleLogout()} variant="secondary">로그아웃</Button>
        </>
      )}
    >
      <main className="workspace-layout">
        <aside className="side-column">
          <Panel eyebrow="Prompt" title="자연어 제작 지시">
            <input
              aria-label="프로젝트 디렉터리"
              className="project-path-input"
              onChange={(event) => setProjectDirectory(event.target.value)}
              placeholder="프로젝트 디렉터리 자동 생성"
              value={projectDirectory}
            />
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} wrap="soft" />
            <div className="button-row">
              <Button icon={<Sparkles size={17} />} onClick={() => void createStarterProject()} variant="primary">샘플 프로젝트 생성</Button>
              <Button icon={<Database size={17} />} onClick={() => void openProject()}>프로젝트 열기</Button>
              <Button icon={<ImagePlus size={17} />} onClick={() => void createImageJob()}>이미지 작업 생성</Button>
              <Button icon={<ImagePlus size={17} />} onClick={() => void generateImage()}>실제 이미지 생성</Button>
            </div>
          </Panel>
        </aside>

        <section className="main-column">
          <Panel
            actions={(
              <>
                <Button icon={<CheckCircle2 size={17} />} onClick={() => void validateProject()} variant="primary">검증</Button>
                <Button icon={<Save size={17} />} onClick={() => void saveFirstScene()}>씬 저장</Button>
                <Button icon={<Code2 size={17} />} onClick={() => void buildProject()}>HTML 빌드</Button>
              </>
            )}
            eyebrow="Project"
            title="프로젝트 JSON"
          >
            <textarea className="project-editor" value={projectJson} onChange={(event) => setProjectJson(event.target.value)} wrap="soft" />
          </Panel>

          <Panel eyebrow="Result" title="결과">
            <StatusBanner tone="neutral">{workspaceStatus}</StatusBanner>
            {previewSrc ? (
              <div className="preview-area">
                <img alt="생성 이미지 미리보기" src={previewSrc} />
              </div>
            ) : null}
            <pre>{result}</pre>
          </Panel>
        </section>
      </main>
    </AppShell>
  );
}
