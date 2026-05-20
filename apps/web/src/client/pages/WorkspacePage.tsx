import { CheckCircle2, Code2, ImagePlus, LogOut, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { postJson } from "../api/client";
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

export function WorkspacePage() {
  const { logout, refreshSession, session } = useAuth();
  const [projectJson, setProjectJson] = useState(() => JSON.stringify({ starter: starterProject }, null, 2));
  const [prompt, setPrompt] = useState("하루 루트의 첫 장면을 달달하게 확장하고, 교실 배경과 하루 포트레이트 생성 작업을 만들어줘.");
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
      setResult(formatResult(actionResult));
      setWorkspaceStatus(`${label} 완료`);
    } catch (error) {
      setResult(formatResult({ ok: false, error: error instanceof Error ? error.message : String(error) }));
      setWorkspaceStatus(`${label} 실패`);
    }
  }

  async function createStarterProject(): Promise<void> {
    await runAction("샘플 프로젝트 생성", async () => {
      const response = await postJson<ApiResult>("/api/project/starter", { starter: starterProject });
      setProjectJson(JSON.stringify(response.project, null, 2));
      return response;
    });
  }

  async function validateProject(): Promise<void> {
    await runAction("프로젝트 검증", async () => {
      const project = JSON.parse(projectJson);
      return postJson<ApiResult>("/api/project/validate", { project });
    });
  }

  async function buildProject(): Promise<void> {
    await runAction("프로젝트 빌드", async () => {
      const project = JSON.parse(projectJson);
      return truncateArtifactHtml(await postJson<ApiResult>("/api/project/build", { project }));
    });
  }

  async function createImageJob(): Promise<void> {
    setPreviewSrc(null);
    await runAction("이미지 작업 생성", async () => postJson<ApiResult>("/api/generation/jobs", {
      kind: "cg",
      targetId: "scene-opening",
      prompt,
      style: "soft visual novel, clean anime, production-ready"
    }));
  }

  async function generateImage(): Promise<void> {
    setPreviewSrc(null);
    await runAction("이미지 생성", async () => {
      const response = await postJson<ApiResult & ImagePreviewResult>("/api/generation/images", {
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
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            <div className="button-row">
              <Button icon={<Sparkles size={17} />} onClick={() => void createStarterProject()} variant="primary">샘플 프로젝트 생성</Button>
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
                <Button icon={<Code2 size={17} />} onClick={() => void buildProject()}>HTML 빌드</Button>
              </>
            )}
            eyebrow="Project"
            title="프로젝트 JSON"
          >
            <textarea className="project-editor" value={projectJson} onChange={(event) => setProjectJson(event.target.value)} />
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
