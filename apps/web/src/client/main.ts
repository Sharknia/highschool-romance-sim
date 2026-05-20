import "./styles.css";

interface ApiResult {
  ok?: boolean;
  [key: string]: unknown;
}

const app = document.querySelector<HTMLElement>("#app");

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
      <div class="auth-box">
        <button id="browserLoginButton" type="button">Codex 로그인</button>
        <button id="deviceLoginButton" type="button">디바이스 코드</button>
        <button id="refreshAuthButton" type="button">상태 갱신</button>
        <button id="logoutButton" type="button">로그아웃</button>
        <span id="authStatus" class="status">Codex OAuth: 확인 전</span>
      </div>
    </header>
    <div class="workspace">
      <aside class="panel">
        <section class="card">
          <h2>자연어 제작 지시</h2>
          <textarea id="promptInput">하루 루트의 첫 장면을 달달하게 확장하고, 교실 배경과 하루 포트레이트 생성 작업을 만들어줘.</textarea>
          <div class="button-row">
            <button id="createStarterButton" class="primary" type="button">샘플 프로젝트 생성</button>
            <button id="createJobButton" type="button">이미지 작업 생성</button>
            <button id="generateImageButton" type="button">실제 이미지 생성</button>
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
          <div id="previewArea" class="preview-area"></div>
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
const previewArea = document.querySelector<HTMLDivElement>("#previewArea")!;

function showResult(result: unknown): void {
  resultOutput.textContent = JSON.stringify(result, (key, value) => {
    if ((key === "b64Json" || key === "dataUrl" || key === "result") && typeof value === "string" && value.length > 160) {
      return `${value.slice(0, 160)}... (${value.length} chars)`;
    }
    return value;
  }, 2);
}

function showImagePreview(src?: string): void {
  previewArea.innerHTML = "";
  if (!src) {
    return;
  }

  const image = document.createElement("img");
  image.alt = "생성 이미지 미리보기";
  image.src = src;
  previewArea.append(image);
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
  const result = await response.json() as { connected: boolean; mode: string | null; account?: { email?: string; planType?: string | null } };
  const plan = result.account?.planType ? `/${result.account.planType}` : "";
  authStatus.textContent = result.connected
    ? `Codex OAuth: ${result.mode}${plan}`
    : "Codex OAuth: 로그인 필요";
}

async function startCodexLogin(flow: "browser" | "device"): Promise<void> {
  const result = await postJson("/api/codex/login", { flow });
  const login = result.login as { authUrl?: string; verificationUrl?: string; userCode?: string } | undefined;

  if (login?.authUrl) {
    window.open(login.authUrl, "_blank", "noopener,noreferrer");
  }

  showResult(result);
  await refreshAuthStatus();
}

document.querySelector("#browserLoginButton")?.addEventListener("click", async () => {
  await startCodexLogin("browser");
});

document.querySelector("#deviceLoginButton")?.addEventListener("click", async () => {
  await startCodexLogin("device");
});

document.querySelector("#refreshAuthButton")?.addEventListener("click", async () => {
  await refreshAuthStatus();
});

document.querySelector("#logoutButton")?.addEventListener("click", async () => {
  const result = await postJson("/api/codex/logout", {});
  showResult(result);
  await refreshAuthStatus();
});

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
  showImagePreview();
  showResult(await postJson("/api/generation/jobs", {
    kind: "cg",
    targetId: "scene-opening",
    prompt: promptInput.value,
    style: "soft visual novel, clean anime, production-ready"
  }));
});

document.querySelector("#generateImageButton")?.addEventListener("click", async () => {
  showImagePreview();
  const result = await postJson("/api/generation/images", {
    kind: "cg",
    targetId: "scene-opening",
    prompt: promptInput.value,
    style: "soft visual novel, clean anime, production-ready"
  });

  const image = result.image as { dataUrl?: string; uri?: string } | undefined;
  const asset = result.asset as { uri?: string } | undefined;
  showImagePreview(image?.dataUrl || image?.uri || asset?.uri);
  showResult(result);
  await refreshAuthStatus();
});

projectEditor.value = JSON.stringify({ starter: starterProject }, null, 2);
void refreshAuthStatus();
