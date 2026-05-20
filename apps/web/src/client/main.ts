import "./styles.css";

interface ApiResult {
  ok?: boolean;
  [key: string]: unknown;
}

const app = document.querySelector<HTMLMainElement>("#app");

if (!app) {
  throw new Error("앱 루트를 찾을 수 없습니다.");
}

const starterProject = {
  id: "web-starter",
  title: "웹 제작툴 샘플",
  premise: "Codex와 함께 미연시를 제작하는 첫 프로젝트"
};

app.innerHTML = `
  <section class="shell">
    <header class="topbar">
      <h1>VN Maker</h1>
      <span id="authStatus" class="status">Codex auth: 확인 전</span>
    </header>
    <div class="workspace">
      <aside class="panel">
        <section class="card">
          <h2>자연어 제작 지시</h2>
          <textarea id="promptInput">하루 루트의 첫 장면을 달달하게 확장하고, 교실 배경과 하루 포트레이트 생성 작업을 만들어줘.</textarea>
          <div class="button-row">
            <button id="createStarterButton" class="primary" type="button">샘플 프로젝트 생성</button>
            <button id="createJobButton" type="button">이미지 작업 생성</button>
          </div>
        </section>
      </aside>
      <section class="content">
        <section class="card">
          <h2>프로젝트 JSON</h2>
          <textarea id="projectEditor"></textarea>
          <div class="button-row">
            <button id="validateButton" class="primary" type="button">검증</button>
            <button id="buildButton" type="button">HTML 빌드</button>
          </div>
        </section>
        <section class="card">
          <h2>결과</h2>
          <pre id="resultOutput">{}</pre>
        </section>
      </section>
    </div>
  </section>
`;

const projectEditor = document.querySelector<HTMLTextAreaElement>("#projectEditor")!;
const resultOutput = document.querySelector<HTMLPreElement>("#resultOutput")!;
const authStatus = document.querySelector<HTMLSpanElement>("#authStatus")!;
const promptInput = document.querySelector<HTMLTextAreaElement>("#promptInput")!;

function showResult(result: unknown): void {
  resultOutput.textContent = JSON.stringify(result, null, 2);
}

async function postJson(path: string, body: unknown): Promise<ApiResult> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response.json() as Promise<ApiResult>;
}

async function refreshAuthStatus(): Promise<void> {
  const response = await fetch("/api/codex/session");
  const result = await response.json() as { connected: boolean; mode: string };
  authStatus.textContent = result.connected
    ? `Codex auth: ${result.mode}`
    : "Codex auth: 서버 어댑터 필요";
}

document.querySelector("#createStarterButton")?.addEventListener("click", async () => {
  const result = await postJson("/api/project/starter", { starter: starterProject });
  projectEditor.value = JSON.stringify(result.project, null, 2);
  showResult(result);
});

document.querySelector("#validateButton")?.addEventListener("click", async () => {
  const project = JSON.parse(projectEditor.value);
  showResult(await postJson("/api/project/validate", { project }));
});

document.querySelector("#buildButton")?.addEventListener("click", async () => {
  const project = JSON.parse(projectEditor.value);
  const result = await postJson("/api/project/build", { project });
  if (typeof result.artifact === "object" && result.artifact) {
    const artifact = result.artifact as { html?: string };
    if (artifact.html && artifact.html.length > 1200) {
      artifact.html = `${artifact.html.slice(0, 1200)}\n...`;
    }
  }
  showResult(result);
});

document.querySelector("#createJobButton")?.addEventListener("click", async () => {
  showResult(await postJson("/api/generation/jobs", {
    kind: "cg",
    targetId: "scene-opening",
    prompt: promptInput.value,
    style: "soft visual novel, clean anime, production-ready"
  }));
});

projectEditor.value = JSON.stringify({ starter: starterProject }, null, 2);
void refreshAuthStatus();
