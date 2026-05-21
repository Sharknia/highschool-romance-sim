import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const core = await import("../packages/engine-core/dist/index.js");
const useCasesModule = await import("../packages/use-cases/dist/index.js");
const webHandlers = await import("../apps/web/dist/server/handlers.js");

const tempRoot = await mkdtemp(join(tmpdir(), "vn-maker-beta-"));
const projectDirectory = join(tempRoot, "Beta.vnmaker");
const transientFailures = new Set(["job-haru-festival-expression-shy"]);

const useCases = useCasesModule.createVnMakerUseCases({
  eventText: {
    async generateEventExpansionPlan({ request }) {
      return core.createDeterministicEventExpansionPlan(request);
    }
  },
  image: {
    async generateImageAsset(input) {
      if (transientFailures.delete(input.jobId)) {
        throw new Error(`transient failure for ${input.jobId}`);
      }

      return {
        job: {
          id: input.jobId || `job-${input.kind}-${input.targetId}`,
          kind: input.kind,
          targetId: input.targetId,
          prompt: input.prompt,
          style: input.style,
          provider: "image-generation-adapter",
          status: "completed",
          outputAssetId: input.outputAssetId
        },
        asset: {
          id: input.outputAssetId || `asset-${input.kind}-${input.targetId}`,
          kind: input.kind,
          label: `generated ${input.kind} ${input.targetId}`,
          uri: `${input.publicPathPrefix}/${input.outputAssetId || `asset-${input.kind}`}.png`,
          source: "generated",
          generationJobId: input.jobId
        },
        image: {
          mimeType: "image/png",
          b64Json: Buffer.from(`fake ${input.jobId}`).toString("base64"),
          dataUrl: `data:image/png;base64,${Buffer.from(`fake ${input.jobId}`).toString("base64")}`,
          uri: `${input.publicPathPrefix}/${input.outputAssetId || `asset-${input.kind}`}.png`
        },
        raw: { jobId: input.jobId, provider: "fake-image" }
      };
    }
  }
});

const haru = core.createHeroineProfile({
  id: "haru",
  name: "하루",
  description: "도서관에서 자주 만나는 조용한 같은 반 학생.",
  personality: "차분하지만 당황하면 솔직한 반응이 먼저 나온다.",
  speechStyle: "짧고 조심스럽게 말한다.",
  appearance: "단정한 교복과 분홍색 머리핀.",
  tags: ["library", "quiet"]
});
assert.deepEqual(haru.tags, ["library", "quiet"]);

await useCases.saveHeroine({ projectDirectory, heroine: haru });
await useCases.saveHeroine({
  projectDirectory,
  heroine: core.createHeroineProfile({
    id: "mira",
    name: "미라",
    description: "방송부에서 게임 홍보를 돕는 친구.",
    personality: "명랑하고 추진력이 있다.",
    speechStyle: "활기찬 말투.",
    appearance: "짧은 갈색 머리와 밝은 표정.",
    tags: ["broadcast"]
  })
});

const searched = await useCases.listHeroines({
  projectDirectory,
  query: "도서관",
  tag: "library",
  sort: "name-asc"
});
assert.equal(searched.heroines.length, 1);
assert.equal(searched.heroines[0].id, "haru");

const cloned = await useCases.cloneHeroine({
  projectDirectory,
  sourceHeroineId: "haru",
  newId: "haru-festival",
  name: "하루 축제 변형",
  tags: ["festival", "quiet"]
});
assert.equal(cloned.heroine.id, "haru-festival");
assert.deepEqual(cloned.heroine.tags, ["festival", "quiet"]);
assert.equal(cloned.heroine.defaultPortraitAssetId, "asset-haru-festival-portrait");

const fromLibrary = await useCases.createProjectFromHeroine({
  projectDirectory,
  heroineId: "haru-festival",
  title: "하루 Beta",
  premise: "축제 준비 중 반복 제작을 검증하는 프로젝트"
});
assert.equal(fromLibrary.project.characters[0].sourceHeroineId, "haru-festival");
assert.equal(fromLibrary.project.characters[0].sourceHeroineName, "하루 축제 변형");
assert.match(fromLibrary.project.characters[0].sourceSnapshotCreatedAt, /^\d{4}-\d{2}-\d{2}T/);

const reused = await useCases.listHeroines({ projectDirectory, query: "축제" });
const reusedHeroine = reused.heroines.find((heroine) => heroine.id === "haru-festival");
assert.equal(reusedHeroine.reuseHistory.length, 1);
assert.equal(reusedHeroine.reuseHistory[0].projectId, "하루-beta");

const defaults = await useCases.planDefaultEmotionAssets({
  projectDirectory,
  heroineId: "haru-festival"
});
assert.deepEqual(defaults.tags, ["normal", "happy", "sad", "angry", "shy"]);
assert.equal(defaults.jobs.length, 5);
assert.equal(defaults.project.characters[0].emotionTags.includes("happy"), true);
assert.equal(Boolean(defaults.project.characters[0].expressionAssetIds.happy), true);

const tagged = await useCases.planExpressionAssets({
  projectDirectory,
  heroineId: "haru-festival",
  tags: ["embarrassed", "festival_nervous"]
});
assert.deepEqual(tagged.tags, ["embarrassed", "festival_nervous"]);
assert.equal(tagged.jobs.every((job) => job.status === "planned" && job.kind === "expression"), true);

const expressionScene = {
  ...tagged.project.scenes[0],
  id: "scene-happy-expression",
  label: "표정 선택 검증",
  speaker: "하루",
  text: "응, 축제 준비라면 조금 기대돼.",
  characters: [{ characterId: "haru-festival", expression: "happy", position: "center" }],
  choices: []
};
await useCases.saveScene({ projectDirectory, scene: expressionScene });
const expressionPreview = await useCases.previewProject({ projectDirectory, startSceneId: "scene-happy-expression" });
const previewScene = expressionPreview.runtime.scenes.find((scene) => scene.id === "scene-happy-expression");
assert.equal(previewScene.characters[0].asset.id, defaults.project.characters[0].expressionAssetIds.happy);

const expressionSceneWithPortrait = {
  ...expressionScene,
  id: "scene-happy-expression-explicit-portrait",
  characters: [{
    characterId: "haru-festival",
    expression: "happy",
    assetId: "asset-haru-festival-portrait",
    position: "center"
  }]
};
await useCases.saveScene({ projectDirectory, scene: expressionSceneWithPortrait });
const expressionPriorityPreview = await useCases.previewProject({ projectDirectory, startSceneId: "scene-happy-expression-explicit-portrait" });
const priorityScene = expressionPriorityPreview.runtime.scenes.find((scene) => scene.id === "scene-happy-expression-explicit-portrait");
assert.equal(priorityScene.characters[0].asset.id, defaults.project.characters[0].expressionAssetIds.happy);

const boardBefore = await useCases.listGenerationJobs({ projectDirectory, status: "planned" });
assert.equal(boardBefore.jobs.some((job) => job.id === "job-haru-festival-expression-shy"), true);
assert.equal(boardBefore.jobs[0].provider, "image-generation-adapter");
assert.equal(typeof boardBefore.jobs[0].prompt, "string");

const failedBatch = await useCases.runGenerationJobs({
  projectDirectory,
  jobIds: ["job-haru-festival-expression-shy"]
});
assert.equal(failedBatch.ok, false);
assert.equal(failedBatch.jobs[0].status, "failed");
assert.match(failedBatch.jobs[0].failureMessage, /transient failure/);

const retriedBatch = await useCases.runGenerationJobs({
  projectDirectory,
  jobIds: ["job-haru-festival-expression-shy"],
  retryFailed: true
});
assert.equal(retriedBatch.ok, true);
assert.equal(retriedBatch.jobs[0].status, "completed");
assert.equal(retriedBatch.assets[0].kind, "expression");
assert.match(retriedBatch.assets[0].uri, /^data:image\/png;base64,/);
const openedAfterRetry = await useCases.openProject({ projectDirectory });
const retriedAsset = openedAfterRetry.project.assets.find((asset) => asset.id === "asset-haru-festival-expression-shy");
assert.match(retriedAsset.uri, /^data:image\/png;base64,/);

const replacedBatch = await useCases.runGenerationJobs({
  projectDirectory,
  jobIds: ["job-haru-festival-expression-shy"],
  replaceCompleted: true
});
assert.equal(replacedBatch.ok, true);
assert.equal(replacedBatch.jobs[0].status, "completed");
assert.equal(replacedBatch.assets[0].id, "asset-haru-festival-expression-shy");
assert.match(replacedBatch.assets[0].uri, /^data:image\/png;base64,/);

const expanded = await useCases.expandEvent({
  projectDirectory,
  userEvent: "축제 전날 하루가 도서관에서 대본을 떨어트리고 당황하는 짧은 이벤트"
});
assert.equal(expanded.ok, true);
assert.equal(Boolean(expanded.patchHistoryEntry?.id), true);

const proposedHistory = await useCases.listPatchHistory({ projectDirectory });
assert.equal(proposedHistory.entries.some((entry) => entry.status === "proposed" && entry.rawOutput), true);

const badPlan = {
  ...expanded.plan,
  decision: {
    ...expanded.plan.decision,
    newExpressionAssetCount: 1
  }
};
await assert.rejects(
  () => useCases.approveEvent({ projectDirectory, request: expanded.request, plan: badPlan }),
  /패치 검증 실패/
);
const failedHistory = await useCases.listPatchHistory({ projectDirectory });
assert.equal(failedHistory.entries.some((entry) => entry.status === "failed" && entry.validationIssues.length > 0), true);

const approved = await useCases.approveEvent({
  projectDirectory,
  request: expanded.request,
  plan: expanded.plan,
  patchHistoryId: expanded.patchHistoryEntry.id
});
assert.equal(approved.ok, true);
const sceneCountAfterApprove = approved.project.scenes.length;

const appliedHistory = await useCases.listPatchHistory({ projectDirectory });
const appliedEntry = appliedHistory.entries.find((entry) => entry.status === "applied");
assert.equal(Boolean(appliedEntry), true);
assert.match(appliedEntry.beforeSummary, /씬/);
assert.match(appliedEntry.afterSummary, /씬/);
assert.equal(Boolean(appliedEntry.rawOutput), true);
assert.equal(appliedEntry.attempts.length > 0, true);
assert.match(appliedEntry.diff.text, /씬|CG|생성 작업/);

const undone = await useCases.undoPatch({
  projectDirectory,
  patchHistoryId: appliedEntry.id
});
assert.equal(undone.ok, true);
assert.equal(undone.project.scenes.length, sceneCountAfterApprove - expanded.plan.decision.sceneCount);

const historyAfterUndo = await useCases.listPatchHistory({ projectDirectory });
assert.equal(historyAfterUndo.entries.some((entry) => entry.id === appliedEntry.id && entry.revertedAt), true);

const secondExpanded = await useCases.expandEvent({
  projectDirectory,
  userEvent: "되돌린 뒤 하루가 축제 포스터 문구를 다시 고르는 짧은 이벤트"
});
assert.equal(secondExpanded.ok, true);
const secondApproved = await useCases.approveEvent({
  projectDirectory,
  request: secondExpanded.request,
  plan: secondExpanded.plan,
  patchHistoryId: secondExpanded.patchHistoryEntry.id
});
const manuallyEditedScene = {
  ...secondApproved.project.scenes[0],
  text: `${secondApproved.project.scenes[0].text} 수동 수정`
};
await useCases.saveScene({ projectDirectory, scene: manuallyEditedScene });
await assert.rejects(
  () => useCases.undoPatch({ projectDirectory, patchHistoryId: secondApproved.patchHistoryEntry.id }),
  /현재 프로젝트가 패치 적용 직후 상태와 달라/
);
const openedAfterRejectedUndo = await useCases.openProject({ projectDirectory });
assert.equal(openedAfterRejectedUndo.project.scenes.find((scene) => scene.id === manuallyEditedScene.id).text, manuallyEditedScene.text);

let codexTextCalls = 0;
const mockApi = webHandlers.createApiRequestHandler({
  projectDirectory,
  codex: {
    async readSession() {
      return { connected: true, mode: "chatgpt", account: { email: "beta@example.test" } };
    },
    async startLogin() {
      return { type: "device", userCode: "BETA-1234", verificationUri: "https://example.test" };
    },
    async logout() {},
    async generateImageAsset(input) {
      return {
        job: {
          id: input.jobId || `job-${input.kind}-${input.targetId}`,
          kind: input.kind,
          targetId: input.targetId,
          prompt: input.prompt,
          style: input.style,
          provider: "image-generation-adapter",
          status: "completed",
          outputAssetId: input.outputAssetId
        },
        asset: {
          id: input.outputAssetId || `asset-${input.kind}-${input.targetId}`,
          kind: input.kind,
          label: `api ${input.kind}`,
          uri: `${input.publicPathPrefix}/${input.outputAssetId || `asset-${input.kind}`}.png`,
          source: "generated",
          generationJobId: input.jobId
        }
      };
    },
    async generateEventExpansionPlan({ request }) {
      codexTextCalls += 1;
      return core.createDeterministicEventExpansionPlan(request);
    }
  }
});

const apiJobs = await mockApi({
  method: "POST",
  path: "/api/generation/jobs/list",
  body: { projectDirectory }
});
assert.equal(apiJobs.status, 200);
assert.equal(apiJobs.body.jobs.some((job) => job.kind === "expression"), true);

const apiHistory = await mockApi({
  method: "POST",
  path: "/api/events/history",
  body: { projectDirectory }
});
assert.equal(apiHistory.status, 200);
assert.equal(apiHistory.body.entries.some((entry) => entry.status === "applied" || entry.status === "proposed"), true);

const apiExpand = await mockApi({
  method: "POST",
  path: "/api/events/expand",
  body: {
    projectDirectory,
    userEvent: "브라우저 기본 패치 경로가 Codex 텍스트 turn 없이 검증 가능한 패치를 만든다."
  }
});
assert.equal(apiExpand.status, 200);
assert.equal(apiExpand.body.ok, true);
assert.equal(codexTextCalls, 0);

const cliJobsOutput = execFileSync(process.execPath, ["packages/cli/dist/index.js", "list-generation-jobs"], {
  input: JSON.stringify({ projectDirectory }),
  encoding: "utf8"
});
const cliJobs = JSON.parse(cliJobsOutput);
assert.equal(cliJobs.ok, true);
assert.equal(cliJobs.jobs.some((job) => job.provider === "image-generation-adapter"), true);

const cliHistoryOutput = execFileSync(process.execPath, ["packages/cli/dist/index.js", "list-patch-history"], {
  input: JSON.stringify({ projectDirectory }),
  encoding: "utf8"
});
const cliHistory = JSON.parse(cliHistoryOutput);
assert.equal(cliHistory.ok, true);
assert.equal(cliHistory.entries.some((entry) => entry.revertedAt), true);

await rm(tempRoot, { recursive: true, force: true });
