import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const core = await import("../packages/engine-core/dist/index.js");
const projectStoreModule = await import("../packages/project-store/dist/index.js");
const useCasesModule = await import("../packages/use-cases/dist/index.js");

const tempRoot = await mkdtemp(join(tmpdir(), "vn-maker-use-cases-"));
const projectDirectory = join(tempRoot, "UseCase.vnmaker");
const manualProjectDirectory = join(tempRoot, "ManualScenes.vnmaker");
const preserveNextProjectDirectory = join(tempRoot, "PreserveNext.vnmaker");
const missingRecentProjectDirectory = join(tempRoot, "MissingRecent.vnmaker");
const mismatchRecentProjectDirectory = join(tempRoot, "MismatchRecent.vnmaker");
const recentProjectIndexFile = join(tempRoot, "recent-projects.json");
const useCases = useCasesModule.createVnMakerUseCases({
  recentProjectIndexFile,
  eventText: {
    async generateEventExpansionPlan({ request }) {
      return core.createDeterministicEventExpansionPlan(request);
    }
  },
  image: {
    async generateImageAsset(input) {
      assert.equal(input.cwd, projectDirectory);
      assert.equal(input.publicPathPrefix, "/generated-assets");
      assert.equal(Boolean(input.model), false);
      return {
        job: {
          id: input.jobId || `job-${input.kind}`,
          kind: input.kind,
          targetId: input.targetId,
          prompt: input.prompt,
          style: input.style,
          provider: "image-generation-adapter",
          status: "completed",
          outputAssetId: input.outputAssetId
        },
        asset: {
          id: input.outputAssetId || `asset-${input.kind}`,
          kind: input.kind,
          label: `generated ${input.kind}`,
          uri: `${input.publicPathPrefix}/${input.outputAssetId || `asset-${input.kind}`}.png`,
          source: "generated",
          generationJobId: input.jobId || `job-${input.kind}`
        },
        image: {
          mimeType: "image/png",
          b64Json: Buffer.from("fake image").toString("base64"),
          dataUrl: `data:image/png;base64,${Buffer.from("fake image").toString("base64")}`,
          uri: `${input.publicPathPrefix}/${input.outputAssetId || `asset-${input.kind}`}.png`
        },
        raw: { item: { type: "test" } }
      };
    }
  }
});

const heroine = core.createHeroineProfile({
  id: "haru",
  name: "하루",
  description: "도서관에서 자주 만나는 학생.",
  personality: "차분하다.",
  speechStyle: "조심스럽게 말한다.",
  appearance: "단정한 교복."
});

const created = await useCases.createProjectFromHeroine({
  projectDirectory,
  heroine,
  title: "하루 Use Case",
  premise: "공통 use case 프로젝트"
});
assert.equal(created.ok, true);
assert.equal(created.projectDirectory, projectDirectory);
assert.equal(created.project.characters.length, 1);

const recentAfterCreate = await useCases.listRecentProjects();
assert.equal(recentAfterCreate.ok, true);
assert.equal(recentAfterCreate.projects[0].projectId, created.project.id);
assert.equal(recentAfterCreate.projects[0].projectDirectory, projectDirectory);
assert.equal(recentAfterCreate.projects[0].title, "하루 Use Case");
assert.equal(recentAfterCreate.projects[0].validationState, "valid");
assert.equal(recentAfterCreate.projects[0].missing, false);

const manualCreated = await useCases.createProjectFromHeroine({
  projectDirectory: manualProjectDirectory,
  heroine,
  title: "하루 Manual",
  premise: "수동 장면 제작 use-case 프로젝트"
});
assert.equal(manualCreated.ok, true);

const preserveCreated = await useCases.createProjectFromHeroine({
  projectDirectory: preserveNextProjectDirectory,
  heroine,
  title: "하루 Preserve Next",
  premise: "기존 next를 새 장면 뒤로 보존한다."
});
const preserveOpening = preserveCreated.project.routes[0].entrySceneId;
const previousNext = preserveCreated.project.scenes.find((scene) => scene.id === preserveOpening).next;
const preservedInsert = await useCases.insertManualScene({
  projectDirectory: preserveNextProjectDirectory,
  sourceSceneId: preserveOpening,
  link: {
    type: "next",
    preservePreviousNext: true
  },
  scene: {
    id: "scene-preserved-bridge",
    label: "보존된 중간 장면",
    speaker: "하루",
    text: "기존 엔딩 앞에 한 장면을 더 넣는다.",
    characters: [],
    choices: []
  }
});
assert.equal(preservedInsert.ok, true);
assert.equal(preservedInsert.project.scenes.find((scene) => scene.id === preserveOpening).next, "scene-preserved-bridge");
assert.equal(preservedInsert.project.scenes.find((scene) => scene.id === "scene-preserved-bridge").next, previousNext);
assert.equal(preservedInsert.validation.ok, true);

const manualOpening = manualCreated.project.routes[0].entrySceneId;
const openedBranch = await useCases.saveScene({
  projectDirectory: manualProjectDirectory,
  scene: {
    ...manualCreated.project.scenes.find((scene) => scene.id === manualOpening),
    next: undefined
  }
});
assert.equal(openedBranch.validation.ok, false);
assert.equal(openedBranch.validation.issues.some((issue) => issue.message.includes("엔딩 없이 끝납니다")), true);

const invalidPreview = await useCases.previewProject({
  projectDirectory: manualProjectDirectory,
  startSceneId: manualOpening
});
assert.equal(invalidPreview.ok, true);
assert.equal(invalidPreview.runtime.validation.ok, false);
assert.equal(invalidPreview.validation.ok, false);
assert.equal(invalidPreview.routeGraphAnalysis.uncoveredTerminalSceneIds.includes(manualOpening), true);

const insertedGood = await useCases.insertManualScene({
  projectDirectory: manualProjectDirectory,
  sourceSceneId: manualOpening,
  link: {
    type: "choice",
    choiceId: "choice-good",
    choiceText: "솔직히 고백한다"
  },
  scene: {
    id: "scene-good-ending",
    label: "고백 엔딩",
    speaker: "하루",
    text: "내년에도 같이 만들자.",
    characters: [],
    choices: []
  }
});
assert.equal(insertedGood.ok, true);
assert.equal(insertedGood.selectedSceneId, "scene-good-ending");
assert.equal(insertedGood.routeGraphAnalysis.issues.some((issue) => issue.code === "uncovered-terminal"), true);

const goodEnded = await useCases.setSceneEnding({
  projectDirectory: manualProjectDirectory,
  sceneId: "scene-good-ending",
  ending: {
    id: "ending-good",
    title: "문화제의 약속",
    kind: "good"
  }
});
assert.equal(goodEnded.ok, true);
assert.equal(goodEnded.routeGraphAnalysis.reachableEndingIds.includes("ending-good"), true);

const insertedNormal = await useCases.insertManualScene({
  projectDirectory: manualProjectDirectory,
  link: { type: "none" },
  scene: {
    id: "scene-normal-ending",
    label: "작업 엔딩",
    speaker: "하루",
    text: "오늘은 여기까지지만 다음이 있어.",
    characters: [],
    choices: [],
    ending: {
      id: "ending-normal",
      title: "다음 작품으로",
      kind: "normal"
    }
  }
});
assert.equal(insertedNormal.ok, true);
assert.equal(insertedNormal.routeGraphAnalysis.orphanSceneIds.includes("scene-normal-ending"), true);

const linkedNormal = await useCases.linkManualScene({
  projectDirectory: manualProjectDirectory,
  sourceSceneId: manualOpening,
  targetSceneId: "scene-normal-ending",
  link: {
    type: "choice",
    choiceId: "choice-normal",
    choiceText: "전시를 마무리한다"
  }
});
assert.equal(linkedNormal.ok, true);
assert.equal(linkedNormal.routeGraphAnalysis.uncoveredTerminalSceneIds.length, 0);
assert.deepEqual(linkedNormal.routeGraphAnalysis.reachableEndingIds.sort(), ["ending-good", "ending-normal"]);
assert.equal(linkedNormal.project.scenes.find((scene) => scene.id === manualOpening).choices.length, 2);

await assert.rejects(
  () => useCases.linkManualScene({
    projectDirectory: manualProjectDirectory,
    sourceSceneId: "scene-good-ending",
    targetSceneId: "scene-normal-ending",
    link: { type: "next" }
  }),
  /엔딩 장면 뒤에는 연결할 수 없습니다/
);

const nextInserted = await useCases.insertManualScene({
  projectDirectory: manualProjectDirectory,
  sourceSceneId: "scene-normal-ending",
  link: { type: "next" },
  scene: {
    id: "scene-after-ending",
    label: "잘못된 뒤 장면",
    speaker: "나",
    text: "도달하면 안 된다.",
    characters: [],
    choices: []
  }
}).catch((error) => error);
assert.match(nextInserted.message, /엔딩 장면 뒤에는 연결할 수 없습니다/);

const endingNeedsConfirmation = await useCases.setSceneEnding({
  projectDirectory: manualProjectDirectory,
  sceneId: manualOpening,
  ending: {
    id: "ending-opening",
    title: "갑작스런 엔딩",
    kind: "bad"
  },
  clearOutgoing: false
}).catch((error) => error);
assert.match(endingNeedsConfirmation.message, /다음 장면이나 선택지를 제거해야 합니다/);

const clearedOpeningEnding = await useCases.setSceneEnding({
  projectDirectory: manualProjectDirectory,
  sceneId: manualOpening,
  ending: {
    id: "ending-opening",
    title: "갑작스런 엔딩",
    kind: "bad"
  },
  clearOutgoing: true
});
assert.equal(clearedOpeningEnding.ok, true);
assert.equal(clearedOpeningEnding.project.scenes.find((scene) => scene.id === manualOpening).choices.length, 0);
assert.equal(clearedOpeningEnding.project.scenes.find((scene) => scene.id === manualOpening).ending.kind, "bad");

const expanded = await useCases.expandEvent({
  projectDirectory,
  userEvent: "도서관에서 책을 줍다가 손이 겹치고 노멀 엔딩으로 끝나는 이벤트"
});
assert.equal(expanded.ok, true);
assert.equal(expanded.plan.decision.sceneCount, 3);

const approved = await useCases.approveEvent({
  projectDirectory,
  request: expanded.request,
  plan: expanded.plan
});
assert.equal(approved.ok, true);
assert.equal(approved.project.scenes.length, 5);

const plannedJob = approved.project.generationJobs.find((job) => job.kind === "cg" && job.status === "planned");
assert.equal(Boolean(plannedJob), true);
const generated = await useCases.generateImage({
  projectDirectory,
  jobId: plannedJob.id
});
assert.equal(generated.ok, true);
assert.equal(generated.job.status, "completed");
assert.equal(generated.asset.id, plannedJob.outputAssetId);

const opened = await useCases.openProject({ projectDirectory });
assert.equal(opened.ok, true);
assert.equal(opened.project.assets.some((asset) => asset.id === plannedJob.outputAssetId), true);

const openedByProjectId = await useCases.openProject({ projectId: created.project.id });
assert.equal(openedByProjectId.ok, true);
assert.equal(openedByProjectId.projectDirectory, projectDirectory);
assert.equal(openedByProjectId.project.id, created.project.id);

const missingCreated = await useCases.createProject({
  projectDirectory: missingRecentProjectDirectory,
  starter: {
    id: "missing-recent",
    title: "Missing Recent",
    premise: "최근 인덱스 missing 테스트"
  }
});
assert.equal(missingCreated.ok, true);
await rm(missingRecentProjectDirectory, { recursive: true, force: true });
await assert.rejects(
  () => useCases.openProject({ projectId: "missing-recent" }),
  (error) => {
    assert.equal(error.code, "PROJECT_DIRECTORY_MISSING");
    assert.match(error.message, /프로젝트 폴더를 찾을 수 없습니다/);
    return true;
  }
);
const recentAfterMissing = await useCases.listRecentProjects();
assert.equal(recentAfterMissing.projects.find((entry) => entry.projectId === "missing-recent").missing, true);
const wrongReconnectDirectory = join(tempRoot, "WrongReconnect.vnmaker");
await assert.rejects(
  () => useCases.openProject({ projectId: "missing-recent", projectDirectory: wrongReconnectDirectory }),
  (error) => {
    assert.equal(error.code, "PROJECT_DIRECTORY_MISSING");
    assert.match(error.message, /프로젝트 폴더를 찾을 수 없습니다/);
    return true;
  }
);
assert.equal(existsSync(join(wrongReconnectDirectory, "project.sqlite")), false);

const mismatchCreated = await useCases.createProject({
  projectDirectory: mismatchRecentProjectDirectory,
  starter: {
    id: "expected-recent",
    title: "Expected Recent",
    premise: "최근 인덱스 ID 불일치 테스트"
  }
});
assert.equal(mismatchCreated.ok, true);
const mismatchStore = await projectStoreModule.createProjectWorkspace({
  projectDirectory: mismatchRecentProjectDirectory,
  project: core.createStarterProject({
    id: "actual-recent",
    title: "Actual Recent",
    premise: "인덱스와 다른 프로젝트"
  })
});
mismatchStore.close();
await assert.rejects(
  () => useCases.openProject({ projectId: "expected-recent" }),
  (error) => {
    assert.equal(error.code, "PROJECT_ID_MISMATCH");
    assert.equal(error.expectedProjectId, "expected-recent");
    assert.equal(error.actualProjectId, "actual-recent");
    assert.match(error.message, /프로젝트 ID가 일치하지 않습니다/);
    return true;
  }
);
const recentAfterMismatch = await useCases.listRecentProjects();
const mismatchEntry = recentAfterMismatch.projects.find((entry) => entry.projectId === "expected-recent");
assert.equal(mismatchEntry.projectDirectory, mismatchRecentProjectDirectory);
assert.equal(mismatchEntry.title, "Expected Recent");

const removedRecent = await useCases.removeRecentProject({ projectId: manualCreated.project.id });
assert.equal(removedRecent.ok, true);
assert.equal(removedRecent.projects.some((entry) => entry.projectId === manualCreated.project.id), false);
assert.equal(existsSync(join(manualProjectDirectory, "project.sqlite")), true);

const malformedEventTextUseCases = useCasesModule.createVnMakerUseCases({
  eventText: {
    async generateEventExpansionPlan() {
      return {
        summary: "깨진 선택지 패치",
        decision: {
          sceneCount: 0,
          choiceCount: 1,
          cgCount: 0,
          newExpressionAssetCount: 0
        },
        patch: {
          operations: [
            {
              type: "addChoice",
              sceneId: opened.project.routes[0].entrySceneId,
              choice: { id: 1, text: "schema invalid", next: "scene-missing" }
            }
          ]
        }
      };
    }
  }
});
const malformedExpanded = await malformedEventTextUseCases.expandEvent({
  projectDirectory,
  userEvent: "schema가 깨진 선택지를 반환한다."
});
assert.equal(malformedExpanded.ok, false);
assert.equal(malformedExpanded.attempts[0].failureKind, "schema_invalid");
assert.match(malformedExpanded.error, /patch\.operations\.0\.choice\.id/);

const invalidProject = await useCases.validateProject({
  projectDirectory,
  project: {
    version: "vn-maker/v1",
    id: "bad",
    title: "",
    premise: "",
    characters: [],
    routes: [],
    scenes: [],
    assets: [],
    generationJobs: [],
    settings: {}
  }
});
assert.equal(invalidProject.ok, false);
assert.equal(invalidProject.issues.some((issue) => issue.path === "title"), true);

assert.equal(existsSync(join(projectDirectory, "project.sqlite")), true);

await rm(tempRoot, { recursive: true, force: true });
