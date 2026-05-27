import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

function readText(path) {
  return readFileSync(join(root, path), "utf8");
}

const settingsStatusPath = "apps/web/src/client/pages/settingsStatus.ts";
assert.ok(existsSync(join(root, settingsStatusPath)), "SettingsStartPage 표시 상태 helper는 settingsStatus.ts로 분리해야 합니다.");

const tempRoot = await mkdtemp(join(tmpdir(), "vn-maker-settings-codex-"));
const bundledStatusPath = join(tempRoot, "settings-status.mjs");

try {
  await esbuild({
    entryPoints: [settingsStatusPath],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: bundledStatusPath
  });

  const { createSettingsStatusViewModel } = await import(pathToFileURL(bundledStatusPath).href);

  const checking = createSettingsStatusViewModel({
    authStatus: "checking",
    session: null,
    lastCheckedAt: null
  });
  assert.equal(checking.statusTone, "waiting");
  assert.equal(checking.statusText, "Codex 연결 상태를 확인하는 중입니다.");
  assert.equal(checking.connectionText, "확인 중");
  assert.equal(checking.imageGenerationText, "확인 중");
  assert.equal(checking.fallbackPolicyText, "상태 확인 후 결정");
  assert.equal(checking.primaryActionLabel, "상태 갱신");

  const connected = createSettingsStatusViewModel({
    authStatus: "authenticated",
    session: {
      ok: true,
      connected: true,
      mode: "chatgpt-oauth",
      account: { email: "maker@example.com", planType: "plus" },
      capabilities: { imageGeneration: true, namespaceTools: true, webSearch: false }
    },
    lastCheckedAt: "2026-05-26T10:00:00.000Z"
  });
  assert.equal(connected.statusTone, "success");
  assert.equal(connected.statusText, "Codex 연결과 이미지 생성 상태가 준비되었습니다.");
  assert.equal(connected.connectionText, "Codex 연결됨");
  assert.equal(connected.imageGenerationText, "이미지 생성 가능");
  assert.equal(connected.fallbackPolicyText, "실제 Codex 생성");
  assert.equal(connected.accountText, "maker@example.com");
  assert.equal(connected.planText, "plus");
  assert.equal(connected.modeText, "chatgpt-oauth");
  assert.equal(connected.canLogout, true);

  const unavailable = createSettingsStatusViewModel({
    authStatus: "authenticated",
    session: {
      ok: true,
      connected: true,
      mode: "chatgpt-oauth",
      account: null,
      capabilities: { imageGeneration: false }
    },
    lastCheckedAt: "2026-05-26T10:00:00.000Z"
  });
  assert.equal(unavailable.statusTone, "warning");
  assert.equal(unavailable.connectionText, "Codex 연결됨");
  assert.equal(unavailable.imageGenerationText, "이미지 생성 불가");
  assert.equal(unavailable.fallbackPolicyText, "패키징 목 이미지 사용");
  assert.match(unavailable.statusText, /이미지 생성 기능을 사용할 수 없습니다/);

  const disconnected = createSettingsStatusViewModel({
    authStatus: "anonymous",
    session: {
      ok: false,
      connected: false,
      mode: null,
      code: "OAUTH_REQUIRED",
      error: "Codex ChatGPT OAuth 로그인이 필요합니다.",
      userSummary: "Codex 연결이 필요합니다.",
      nextAction: "브라우저 로그인 또는 device flow 로그인을 시작하세요."
    },
    lastCheckedAt: "2026-05-26T10:00:00.000Z"
  });
  assert.equal(disconnected.statusTone, "warning");
  assert.equal(disconnected.connectionText, "Codex 연결 필요");
  assert.equal(disconnected.imageGenerationText, "이미지 생성 불가");
  assert.equal(disconnected.fallbackPolicyText, "패키징 목 이미지 사용");
  assert.equal(disconnected.recentFailureText, "Codex 연결이 필요합니다.");
  assert.equal(disconnected.nextActionText, "브라우저 로그인 또는 device flow 로그인을 시작하세요.");
  assert.equal(disconnected.canLogout, false);

  const failed = createSettingsStatusViewModel({
    authStatus: "anonymous",
    session: {
      ok: false,
      connected: false,
      mode: null,
      code: "NON_JSON_RESPONSE",
      error: "서버 응답을 JSON으로 읽을 수 없습니다.",
      userSummary: "서버 응답을 해석하지 못했습니다.",
      technicalDetail: "<html>fail</html>",
      nextAction: "API 서버 상태를 확인한 뒤 다시 시도하세요."
    },
    lastCheckedAt: "2026-05-26T10:00:00.000Z"
  });
  assert.equal(failed.statusTone, "error");
  assert.equal(failed.connectionText, "상태 확인 실패");
  assert.equal(failed.recentFailureText, "서버 응답을 해석하지 못했습니다.");
  assert.equal(failed.technicalDetailText, "<html>fail</html>");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

const settingsSource = readText("apps/web/src/client/pages/SettingsStartPage.tsx");
[
  "useAuth",
  "startBrowserLogin",
  "postJson<CodexLoginResponse>",
  "/api/codex/login",
  "flow: \"device\"",
  "refreshSession",
  "logout",
  "DiagnosticDrawer",
  "상태 갱신",
  "브라우저 로그인",
  "device flow 로그인",
  "로그아웃",
  "생성 기본값",
  "패키징 목 이미지",
  "저장소",
  "최근 실패",
  "raw 진단"
].forEach((requiredText) => {
  const pattern = new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.match(settingsSource, pattern, `SettingsStartPage는 '${requiredText}' 흐름을 포함해야 합니다.`);
});

[
  "API key",
  "API 키",
  "provider 선택",
  "히로인 편집",
  "씬 편집",
  "패치 편집"
].forEach((forbiddenText) => {
  const pattern = new RegExp(forbiddenText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  assert.doesNotMatch(settingsSource, pattern, `SettingsStartPage는 '${forbiddenText}'를 설정 화면 기본 흐름에 두면 안 됩니다.`);
});
