import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm } from "node:fs/promises";
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
const heroineContractDirectory = join(tempRoot, "HeroineContract.vnmaker");
const stagedPortraitDirectory = join(tempRoot, "StagedPortrait.vnmaker");
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
      assert.match(input.cwd, /\.vnmaker$/);
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

const concurrentRecentProjectCount = 16;
const concurrentRecentProjectIndexFile = join(tempRoot, "concurrent-recent-projects.json");
await Promise.all(Array.from({ length: concurrentRecentProjectCount }, async (_, index) => {
  const store = new projectStoreModule.RecentProjectIndexStore({
    indexFilePath: concurrentRecentProjectIndexFile,
    clock: () => new Date(Date.UTC(2026, 0, 1, 0, 0, index))
  });
  await store.upsertProject({
    projectId: `concurrent-${index}`,
    projectDirectory: join(tempRoot, `Concurrent${index}.vnmaker`),
    title: `Concurrent ${index}`,
    validationState: "valid"
  });
}));
const concurrentRecentProjects = await new projectStoreModule.RecentProjectIndexStore({
  indexFilePath: concurrentRecentProjectIndexFile
}).listProjects();
assert.equal(concurrentRecentProjects.length, concurrentRecentProjectCount);

const heroine = core.createHeroineProfile({
  id: "haru",
  name: "하루",
  description: "도서관에서 자주 만나는 학생.",
  personality: "차분하다.",
  speechStyle: "조심스럽게 말한다.",
  appearance: "단정한 교복."
});

const emptyLibraryDirectory = join(tempRoot, "EmptyHeroineLibrary.vnmaker");
const blankProjectDirectory = join(tempRoot, "BlankProject.vnmaker");
const emptyLibrary = await useCases.listHeroines({ projectDirectory: emptyLibraryDirectory });
assert.equal(emptyLibrary.ok, true);
assert.deepEqual(emptyLibrary.heroines, []);

async function assertHeroineFieldRequired(field, value = "") {
  const result = await useCases.createHeroine({
    projectDirectory: emptyLibraryDirectory,
    heroine: {
      id: "required-contract",
      name: "필수 검증",
      description: "필수 필드 검증용 히로인.",
      personality: "차분하다.",
      speechStyle: "정중하게 말한다.",
      appearance: "단정한 교복.",
      [field]: value
    }
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "HEROINE_INPUT_INVALID");
  assert.equal(result.retryable, false);
  assert.equal(
    result.issues.some((issue) => issue.path === field && issue.message.includes("비어 있을 수 없습니다")),
    true,
    `${field} 필수값 누락을 검증해야 합니다.`
  );
}

await assertHeroineFieldRequired("id");
await assertHeroineFieldRequired("name");
await assertHeroineFieldRequired("description", "   ");
await assertHeroineFieldRequired("personality", "   ");
await assertHeroineFieldRequired("speechStyle", "   ");
await assertHeroineFieldRequired("appearance", "   ");

const contractHeroine = core.createHeroineProfile({
  id: "aoi",
  name: "아오이",
  description: "학생회에서 차분하게 일을 정리하는 친구.",
  personality: "침착하고 책임감이 강하다.",
  speechStyle: "정중하지만 가끔 농담을 섞는다.",
  appearance: "남색 카디건과 단정한 단발머리."
});
const contractCreated = await useCases.createHeroine({
  requestId: "heroine-create-aoi",
  projectDirectory: heroineContractDirectory,
  heroine: contractHeroine
});
assert.equal(contractCreated.ok, true);
assert.equal(contractCreated.heroine.id, "aoi");
assert.equal(contractCreated.heroineRevision.kind, "heroineRevision");
assert.equal(contractCreated.heroineRevision.heroineId, "aoi");
assert.equal(contractCreated.libraryRevision.kind, "heroineLibraryRevision");
assert.equal(typeof contractCreated.heroine.updatedAt, "string");

const duplicateCreate = await useCases.createHeroine({
  requestId: "heroine-create-aoi-duplicate",
  projectDirectory: heroineContractDirectory,
  heroine: contractHeroine
});
assert.equal(duplicateCreate.ok, false);
assert.equal(duplicateCreate.code, "HEROINE_ID_CONFLICT");
assert.equal(duplicateCreate.requestId, "heroine-create-aoi-duplicate");
assert.equal(duplicateCreate.retryable, false);

const reservedCreate = await useCases.createHeroine({
  projectDirectory: heroineContractDirectory,
  heroine: { ...contractHeroine, id: "new", name: "예약어" }
});
assert.equal(reservedCreate.ok, false);
assert.equal(reservedCreate.code, "HEROINE_ID_RESERVED");

const invalidIdCreate = await useCases.createHeroine({
  projectDirectory: heroineContractDirectory,
  heroine: { ...contractHeroine, id: "bad id", name: "잘못된 ID" }
});
assert.equal(invalidIdCreate.ok, false);
assert.equal(invalidIdCreate.code, "HEROINE_INPUT_INVALID");

const contractList = await useCases.listHeroines({ projectDirectory: heroineContractDirectory });
assert.equal(contractList.ok, true);
assert.equal(contractList.count, 1);
assert.equal(contractList.empty, false);
assert.equal(contractList.sort, "updatedAtDesc");
assert.equal(contractList.heroines[0].portraitStatus, "missing");
assert.equal(contractList.heroines[0].heroineRevision.value, contractCreated.heroineRevision.value);

const contractFetched = await useCases.getHeroine({
  projectDirectory: heroineContractDirectory,
  heroineId: "aoi"
});
assert.equal(contractFetched.ok, true);
assert.equal(contractFetched.heroine.name, "아오이");
assert.equal(contractFetched.heroineRevision.value, contractCreated.heroineRevision.value);

const missingHeroine = await useCases.getHeroine({
  requestId: "heroine-missing",
  projectDirectory: heroineContractDirectory,
  heroineId: "missing-heroine"
});
assert.equal(missingHeroine.ok, false);
assert.equal(missingHeroine.code, "HEROINE_NOT_FOUND");
assert.equal(missingHeroine.requestId, "heroine-missing");

const missingRevisionUpdate = await useCases.updateHeroine({
  projectDirectory: heroineContractDirectory,
  heroine: { ...contractHeroine, name: "아오이 revision 누락" }
});
assert.equal(missingRevisionUpdate.ok, false);
assert.equal(missingRevisionUpdate.code, "HEROINE_INPUT_INVALID");
assert.equal(missingRevisionUpdate.issues.some((issue) => issue.path === "expectedHeroineRevision"), true);

const contractUpdated = await useCases.updateHeroine({
  projectDirectory: heroineContractDirectory,
  heroine: { ...contractHeroine, name: "아오이 수정" },
  expectedHeroineRevision: contractFetched.heroineRevision
});
assert.equal(contractUpdated.ok, true);
assert.equal(contractUpdated.heroine.name, "아오이 수정");
assert.notEqual(contractUpdated.heroineRevision.value, contractFetched.heroineRevision.value);

const legacySaveExistingWithoutRevision = await useCases.saveHeroine({
  projectDirectory: heroineContractDirectory,
  heroine: { ...contractHeroine, name: "아오이 레거시 우회" }
});
assert.equal(legacySaveExistingWithoutRevision.ok, false);
assert.equal(legacySaveExistingWithoutRevision.code, "HEROINE_INPUT_INVALID");

const staleUpdate = await useCases.updateHeroine({
  projectDirectory: heroineContractDirectory,
  heroine: { ...contractHeroine, name: "아오이 충돌" },
  expectedHeroineRevision: contractFetched.heroineRevision
});
assert.equal(staleUpdate.ok, false);
assert.equal(staleUpdate.code, "HEROINE_REVISION_CONFLICT");
assert.equal(staleUpdate.retryable, true);

const missingRevisionDelete = await useCases.deleteHeroine({
  projectDirectory: heroineContractDirectory,
  heroineId: "aoi",
  confirmName: "아오이 수정",
  confirmId: "aoi"
});
assert.equal(missingRevisionDelete.ok, false);
assert.equal(missingRevisionDelete.code, "HEROINE_INPUT_INVALID");
assert.equal(missingRevisionDelete.issues.some((issue) => issue.path === "expectedHeroineRevision"), true);

const missingConfirmationDelete = await useCases.deleteHeroine({
  projectDirectory: heroineContractDirectory,
  heroineId: "aoi",
  expectedHeroineRevision: contractUpdated.heroineRevision
});
assert.equal(missingConfirmationDelete.ok, false);
assert.equal(missingConfirmationDelete.code, "HEROINE_INPUT_INVALID");
assert.equal(missingConfirmationDelete.issues.some((issue) => issue.path === "confirmName"), true);
assert.equal(missingConfirmationDelete.issues.some((issue) => issue.path === "confirmId"), true);

const staleDeleteAfterRename = await useCases.deleteHeroine({
  projectDirectory: heroineContractDirectory,
  heroineId: "aoi",
  confirmName: "아오이",
  confirmId: "aoi",
  expectedHeroineRevision: contractFetched.heroineRevision
});
assert.equal(staleDeleteAfterRename.ok, false);
assert.equal(staleDeleteAfterRename.code, "HEROINE_REVISION_CONFLICT");

const staleDelete = await useCases.deleteHeroine({
  projectDirectory: heroineContractDirectory,
  heroineId: "aoi",
  confirmName: "아오이 수정",
  confirmId: "aoi",
  expectedHeroineRevision: contractFetched.heroineRevision
});
assert.equal(staleDelete.ok, false);
assert.equal(staleDelete.code, "HEROINE_REVISION_CONFLICT");

const currentAoi = await useCases.getHeroine({
  projectDirectory: heroineContractDirectory,
  heroineId: "aoi"
});
const deletedAoi = await useCases.deleteHeroine({
  projectDirectory: heroineContractDirectory,
  heroineId: "aoi",
  confirmName: "아오이 수정",
  confirmId: "aoi",
  expectedHeroineRevision: currentAoi.heroineRevision
});
assert.equal(deletedAoi.ok, true);
assert.equal(deletedAoi.deletedHeroineId, "aoi");
assert.equal(deletedAoi.snapshotPolicy, "projectSnapshotsPreserved");
assert.equal(deletedAoi.heroines.some((item) => item.id === "aoi"), false);

const deletedAgain = await useCases.deleteHeroine({
  projectDirectory: heroineContractDirectory,
  heroineId: "aoi",
  confirmName: "아오이 수정",
  confirmId: "aoi"
});
assert.equal(deletedAgain.ok, false);
assert.equal(deletedAgain.code, "HEROINE_NOT_FOUND");

const stagedDraft = core.createHeroineProfile({
  id: "staged-aoi",
  name: "스테이지 아오이",
  description: "저장 전 포트레이트 연결을 검증하는 히로인.",
  personality: "차분하고 꼼꼼하다.",
  speechStyle: "정확하게 말한다.",
  appearance: "짙은 남색 리본과 단정한 교복."
});
const stagedPortrait = await useCases.generateHeroinePortrait({
  projectDirectory: stagedPortraitDirectory,
  draft: stagedDraft,
  outputAssetId: "asset-staged-aoi-custom"
});
assert.equal(stagedPortrait.ok, true);
assert.equal(stagedPortrait.generationState, "completed");
assert.equal(stagedPortrait.stagedPortraitRef.id.startsWith("staged-"), true);
assert.equal(stagedPortrait.asset.kind, "portrait");
const libraryBeforeStagedCreate = await useCases.listHeroines({ projectDirectory: stagedPortraitDirectory });
assert.equal(libraryBeforeStagedCreate.ok, true);
assert.equal(libraryBeforeStagedCreate.empty, true);
const forgedStagedPortrait = await useCases.createHeroine({
  projectDirectory: stagedPortraitDirectory,
  heroine: { ...stagedDraft, id: "forged-staged-aoi", name: "위조 스테이지" },
  stagedPortraitRef: {
    id: `staged-${stagedPortrait.asset.id}`,
    expiresAt: stagedPortrait.stagedPortraitRef.expiresAt,
    previewUri: stagedPortrait.stagedPortraitRef.previewUri
  }
});
assert.equal(forgedStagedPortrait.ok, false);
assert.equal(forgedStagedPortrait.code, "HEROINE_INPUT_INVALID");
const wrongHeroineStagedPortrait = await useCases.createHeroine({
  projectDirectory: stagedPortraitDirectory,
  heroine: { ...stagedDraft, id: "wrong-staged-aoi", name: "다른 스테이지" },
  stagedPortraitRef: stagedPortrait.stagedPortraitRef
});
assert.equal(wrongHeroineStagedPortrait.ok, false);
assert.equal(wrongHeroineStagedPortrait.code, "HEROINE_INPUT_INVALID");
const createdWithStagedPortrait = await useCases.createHeroine({
  projectDirectory: stagedPortraitDirectory,
  heroine: stagedDraft,
  stagedPortraitRef: stagedPortrait.stagedPortraitRef
});
assert.equal(createdWithStagedPortrait.ok, true);
assert.equal(createdWithStagedPortrait.heroine.defaultPortraitAssetId, stagedPortrait.asset.id);
assert.equal(createdWithStagedPortrait.heroine.portraitAssetIds.includes(stagedPortrait.asset.id), true);
assert.equal(createdWithStagedPortrait.heroine.defaultPortraitUri, stagedPortrait.asset.uri);
const reusedStagedPortrait = await useCases.createHeroine({
  projectDirectory: stagedPortraitDirectory,
  heroine: { ...stagedDraft, id: "reused-staged-aoi", name: "재사용 스테이지" },
  stagedPortraitRef: stagedPortrait.stagedPortraitRef
});
assert.equal(reusedStagedPortrait.ok, false);
assert.equal(reusedStagedPortrait.code, "HEROINE_INPUT_INVALID");

const existingPortraitHeroine = core.createHeroineProfile({
  id: "portrait-existing",
  name: "포트레이트 기존",
  description: "기존 원본 포트레이트 생성을 검증한다.",
  personality: "명랑하다.",
  speechStyle: "활기차게 말한다.",
  appearance: "밝은 갈색 머리와 미소."
});
const existingPortraitCreated = await useCases.createHeroine({
  projectDirectory: stagedPortraitDirectory,
  heroine: existingPortraitHeroine
});
assert.equal(existingPortraitCreated.ok, true);
const generatedForExisting = await useCases.generateHeroinePortrait({
  projectDirectory: stagedPortraitDirectory,
  heroineId: "portrait-existing",
  expectedHeroineRevision: existingPortraitCreated.heroineRevision
});
assert.equal(generatedForExisting.ok, true);
assert.equal(generatedForExisting.heroine.defaultPortraitAssetId, generatedForExisting.asset.id);
assert.equal(generatedForExisting.heroine.portraitAssetIds.includes(generatedForExisting.asset.id), true);
assert.notEqual(generatedForExisting.heroineRevision.value, existingPortraitCreated.heroineRevision.value);

const oauthFailureUseCases = useCasesModule.createVnMakerUseCases({
  image: {
    async generateImageAsset() {
      throw new Error("Codex ChatGPT OAuth 로그인이 필요합니다.");
    }
  }
});
const oauthPortrait = await oauthFailureUseCases.generateHeroinePortrait({
  projectDirectory: join(tempRoot, "OAuthPortrait.vnmaker"),
  draft: stagedDraft
});
assert.equal(oauthPortrait.ok, false);
assert.equal(oauthPortrait.code, "OAUTH_REQUIRED");
assert.equal(oauthPortrait.retryable, true);

const unavailableImageUseCases = useCasesModule.createVnMakerUseCases({
  image: {
    async generateImageAsset() {
      throw new Error("현재 Codex app-server가 imageGeneration 기능을 제공하지 않습니다.");
    }
  }
});
const unavailablePortrait = await unavailableImageUseCases.generateHeroinePortrait({
  projectDirectory: join(tempRoot, "UnavailablePortrait.vnmaker"),
  draft: stagedDraft
});
assert.equal(unavailablePortrait.ok, false);
assert.equal(unavailablePortrait.code, "IMAGE_GENERATION_UNAVAILABLE");
assert.equal(unavailablePortrait.retryable, true);

const created = await useCases.createProjectFromHeroine({
  projectDirectory,
  heroine,
  title: "하루 Use Case",
  premise: "공통 use case 프로젝트"
});
assert.equal(created.ok, true);
assert.equal(created.projectDirectory, projectDirectory);
assert.equal(created.projectId, created.project.id);
assert.equal(created.targetRoute, `/projects/${created.project.id}/overview`);
assert.equal(created.project.characters.length, 1);

await assert.rejects(
  () => useCases.createProjectFromHeroine({
    projectDirectory,
    projectId: "second-project",
    heroine,
    title: "Second Project",
    premise: "기존 히로인 기반 프로젝트를 덮어쓰면 안 된다."
  }),
  (error) => {
    const failure = useCasesModule.projectActionFailureFromError(error, "createProjectFromHeroine");
    assert.equal(failure.ok, false);
    assert.equal(failure.action, "createProjectFromHeroine");
    assert.equal(failure.code, "PROJECT_ID_MISMATCH");
    assert.equal(failure.retryable, false);
    assert.equal(failure.projectId, created.project.id);
    assert.equal(failure.projectDirectory, projectDirectory);
    return true;
  }
);
const openedAfterBlockedHeroineCreate = await useCases.openProject({ projectDirectory });
assert.equal(openedAfterBlockedHeroineCreate.project.id, created.project.id);

const generatedPortrait = await useCases.generateImage({
  projectDirectory,
  kind: "portrait",
  heroine
});
assert.equal(generatedPortrait.ok, true);
assert.equal(generatedPortrait.asset.id, heroine.defaultPortraitAssetId);

const plannedBackground = await useCases.createGenerationJob({
  projectDirectory,
  id: "job-usecase-background",
  kind: "background",
  targetId: created.project.id,
  prompt: "library classroom at sunset",
  outputAssetId: "asset-usecase-background"
});
assert.equal(plannedBackground.ok, true);
assert.equal(plannedBackground.job.kind, "background");
const blockedExportWithPlannedBackground = await useCases.exportProject({ projectDirectory }).catch((error) => error);
assert.equal(blockedExportWithPlannedBackground.code, "EXPORT_BLOCKED");
assert.match(blockedExportWithPlannedBackground.message, /job-usecase-background/);
assert.equal(blockedExportWithPlannedBackground.workflowSummary.primaryAction, "goToBackground");

const generatedBackground = await useCases.generateImage({
  projectDirectory,
  kind: "background",
  targetId: created.project.id,
  prompt: "library classroom at sunset",
  outputAssetId: "asset-direct-background"
});
assert.equal(generatedBackground.ok, true);
assert.equal(generatedBackground.asset.kind, "background");
assert.equal(generatedBackground.job.kind, "background");
assert.equal(generatedBackground.project.assets.some((asset) => asset.kind === "background"), true);

const heroineBeforeGeneratedPortrait = await useCases.getHeroine({
  projectDirectory,
  heroineId: heroine.id
});
assert.equal(heroineBeforeGeneratedPortrait.ok, true);
const heroineWithGeneratedPortrait = await useCases.saveHeroine({
  projectDirectory,
  heroine: {
    ...heroine,
    defaultPortraitAssetId: generatedPortrait.asset.id,
    portraitAssetIds: [generatedPortrait.asset.id]
  },
  expectedHeroineRevision: heroineBeforeGeneratedPortrait.heroineRevision
});
assert.equal(heroineWithGeneratedPortrait.ok, true);
const heroineLibraryAfterPortrait = await useCases.listHeroines({ projectDirectory });
assert.equal(heroineLibraryAfterPortrait.heroines.find((item) => item.id === heroine.id)?.defaultPortraitAssetId, generatedPortrait.asset.id);
assert.equal(heroineLibraryAfterPortrait.heroines.find((item) => item.id === heroine.id)?.defaultPortraitUri, generatedPortrait.asset.uri);
assert.deepEqual(heroineLibraryAfterPortrait.heroines.find((item) => item.id === heroine.id)?.portraitAssetIds, [generatedPortrait.asset.id]);

const libraryHeroineBeforeDelete = await useCases.getHeroine({
  projectDirectory,
  heroineId: heroine.id
});
assert.equal(libraryHeroineBeforeDelete.ok, true);
const deletedLibraryHeroine = await useCases.deleteHeroine({
  projectDirectory,
  heroineId: heroine.id,
  confirmName: heroine.name,
  confirmId: heroine.id,
  expectedHeroineRevision: libraryHeroineBeforeDelete.heroineRevision
});
assert.equal(deletedLibraryHeroine.ok, true);
assert.equal(deletedLibraryHeroine.heroines.some((item) => item.id === heroine.id), false);
const openedAfterLibraryDelete = await useCases.openProject({ projectDirectory });
assert.equal(openedAfterLibraryDelete.project.characters[0].sourceHeroineId, heroine.id);
assert.equal(openedAfterLibraryDelete.project.characters[0].displayName, heroine.name);
assert.equal(openedAfterLibraryDelete.project.characters[0].defaultPortraitAssetId, heroine.defaultPortraitAssetId);

const recentAfterCreate = await useCases.listRecentProjects();
assert.equal(recentAfterCreate.ok, true);
assert.equal(recentAfterCreate.action, "listRecentProjects");
assert.equal(typeof recentAfterCreate.requestId, "string");
assert.equal(recentAfterCreate.count, 1);
assert.equal(recentAfterCreate.missingCount, 0);
assert.equal(recentAfterCreate.sort, "lastOpenedAtDesc");
assert.equal(typeof recentAfterCreate.loadedAt, "string");
assert.equal(Boolean(recentAfterCreate.workflowSummary), true);
assert.equal(recentAfterCreate.projects[0].projectId, created.project.id);
assert.equal(recentAfterCreate.projects[0].projectDirectory, projectDirectory);
assert.equal(recentAfterCreate.projects[0].title, "하루 Use Case");
assert.equal(recentAfterCreate.projects[0].validationState, "valid");
assert.equal(recentAfterCreate.projects[0].missing, false);

const removedRecentProject = await useCases.removeRecentProject({
  projectId: created.project.id
});
assert.equal(removedRecentProject.ok, true);
assert.equal(removedRecentProject.action, "removeRecentProject");
assert.equal(removedRecentProject.removedProject.projectId, created.project.id);
assert.equal(removedRecentProject.projects.some((entry) => entry.projectId === created.project.id), false);
assert.equal(removedRecentProject.deletionPolicy.mode, "recentIndexOnly");
assert.equal(removedRecentProject.deletionPolicy.reversible, true);
assert.equal(Array.isArray(removedRecentProject.deletionPolicy.impact), true);
assert.equal(existsSync(join(projectDirectory, "project.sqlite")), true);
const restoredRecentProject = await useCases.restoreRecentProject({
  recentProject: removedRecentProject.removedProject
});
assert.equal(restoredRecentProject.ok, true);
assert.equal(restoredRecentProject.action, "restoreRecentProject");
assert.equal(restoredRecentProject.projects[0].projectId, created.project.id);

const reconnectedProject = await useCases.reconnectRecentProject({
  projectId: created.project.id,
  projectDirectory
});
assert.equal(reconnectedProject.ok, true);
assert.equal(reconnectedProject.action, "reconnectRecentProject");
assert.equal(reconnectedProject.project.id, created.project.id);

await assert.rejects(
  () => useCases.createProject({
    projectDirectory: join(tempRoot, "ReservedProject.vnmaker"),
    starter: {
      id: "new",
      title: "예약어 프로젝트",
      premise: "예약어는 URL 라우트와 충돌한다."
    }
  }),
  (error) => {
    const failure = useCasesModule.projectActionFailureFromError(error, "createProject");
    assert.equal(failure.ok, false);
    assert.equal(failure.action, "createProject");
    assert.equal(failure.code, "PROJECT_ID_RESERVED");
    assert.equal(failure.retryable, false);
    assert.equal(typeof failure.requestId, "string");
    return true;
  }
);

await assert.rejects(
  () => useCases.createProject({
    projectDirectory,
    starter: {
      id: "different-project",
      title: "다른 프로젝트",
      premise: "기존 프로젝트를 덮어쓰면 안 된다."
    }
  }),
  (error) => {
    const failure = useCasesModule.projectActionFailureFromError(error, "createProject");
    assert.equal(failure.ok, false);
    assert.equal(failure.action, "createProject");
    assert.equal(failure.code, "PROJECT_ID_MISMATCH");
    assert.equal(failure.retryable, false);
    assert.equal(failure.projectId, created.project.id);
    assert.equal(failure.projectDirectory, projectDirectory);
    return true;
  }
);

const blankProject = await useCases.createProject({
  projectDirectory: blankProjectDirectory,
  project: {
    version: "vn-maker/v1",
    id: "blank-alpha",
    title: "Blank Alpha",
    premise: "히로인 없이 시작하는 빈 프로젝트",
    characters: [],
    routes: [],
    scenes: [],
    assets: [],
    generationJobs: [],
    settings: {
      defaultRouteId: "",
      outputFileName: "index.html",
      language: "ko"
    }
  }
});
assert.equal(blankProject.ok, true);
assert.equal(blankProject.workflowSummary.blockingIssues.includes("히로인 1명을 먼저 선택해야 합니다."), true);
const assignedSnapshot = await useCases.assignHeroineSnapshot({
  projectDirectory: blankProjectDirectory,
  heroine
});
assert.equal(assignedSnapshot.ok, true);
assert.equal(assignedSnapshot.action, "assignHeroineSnapshot");
assert.equal(assignedSnapshot.project.characters.length, 1);
assert.equal(assignedSnapshot.project.characters[0].sourceHeroineId, heroine.id);
assert.equal(assignedSnapshot.project.characters[0].sourceHeroineName, heroine.name);
assert.equal(typeof assignedSnapshot.project.characters[0].sourceSnapshotCreatedAt, "string");
assert.equal(assignedSnapshot.project.routes.length, 1);
assert.equal(assignedSnapshot.workflowSummary.blockingIssues.includes("히로인 1명을 먼저 선택해야 합니다."), false);
assert.equal(assignedSnapshot.workflowSummary.blockingIssues.includes("배경 화면 생성이 필요합니다."), true);
assert.equal(assignedSnapshot.workflowSummary.previewState, "blocked");
assert.equal(assignedSnapshot.workflowSummary.exportState, "blocked");
assert.deepEqual(
  assignedSnapshot.workflowSummary.steps.map((step) => step.id),
  ["project", "heroine", "background", "studio", "preview", "export"]
);
assert.equal(assignedSnapshot.workflowSummary.primaryAction, "goToBackground");
const changedSourceHeroine = {
  ...heroine,
  name: "수정된 하루",
  personality: "원본이 바뀌어도 스냅샷은 유지된다."
};
await useCases.saveHeroine({
  projectDirectory: blankProjectDirectory,
  heroine: changedSourceHeroine
});
const openedAssignedSnapshot = await useCases.openProject({ projectDirectory: blankProjectDirectory });
assert.equal(openedAssignedSnapshot.project.characters[0].sourceHeroineId, heroine.id);
assert.equal(openedAssignedSnapshot.project.characters[0].displayName, heroine.name);
assert.notEqual(openedAssignedSnapshot.project.characters[0].displayName, changedSourceHeroine.name);
assert.equal(openedAssignedSnapshot.project.characters[0].personality, heroine.personality);
await assert.rejects(
  () => useCases.assignHeroineSnapshot({
    projectDirectory: blankProjectDirectory,
    heroine: changedSourceHeroine
  }),
  (error) => {
    const failure = useCasesModule.projectActionFailureFromError(error, "assignHeroineSnapshot");
    assert.equal(failure.ok, false);
    assert.equal(failure.code, "HEROINE_REPLACE_BLOCKED");
    assert.equal(failure.retryable, false);
    return true;
  }
);

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
const blockedExportWithPlannedCg = await useCases.exportProject({ projectDirectory }).catch((error) => error);
assert.equal(blockedExportWithPlannedCg.code, "EXPORT_BLOCKED");
assert.match(blockedExportWithPlannedCg.message, /완료되지 않은 이미지 작업/);
const runningStore = await projectStoreModule.openProjectStore(projectDirectory);
try {
  const project = runningStore.requireProject();
  runningStore.saveProject({
    ...project,
    generationJobs: project.generationJobs.map((job) => job.id === plannedJob.id ? { ...job, status: "running" } : job)
  });
} finally {
  runningStore.close();
}
const blockedExportWithRunningCg = await useCases.exportProject({ projectDirectory }).catch((error) => error);
assert.equal(blockedExportWithRunningCg.code, "EXPORT_BLOCKED");
assert.equal(blockedExportWithRunningCg.workflowSummary.generationState, "running");
assert.equal(blockedExportWithRunningCg.workflowSummary.exportState, "blocked");
assert.equal(blockedExportWithRunningCg.workflowSummary.primaryAction, "goToBackground");
const plannedStore = await projectStoreModule.openProjectStore(projectDirectory);
try {
  const project = plannedStore.requireProject();
  plannedStore.saveProject({
    ...project,
    generationJobs: project.generationJobs.map((job) => job.id === plannedJob.id ? { ...job, status: "planned" } : job)
  });
} finally {
  plannedStore.close();
}
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

const readOnlyRecentIndexDirectory = join(tempRoot, "ReadOnlyRecentIndex");
await mkdir(readOnlyRecentIndexDirectory, { recursive: true });
await chmod(readOnlyRecentIndexDirectory, 0o500);
try {
  const readOnlyRecentIndexUseCases = useCasesModule.createVnMakerUseCases({
    recentProjectIndexFile: join(readOnlyRecentIndexDirectory, "recent-projects.json")
  });
  const openedWithReadOnlyRecentIndex = await readOnlyRecentIndexUseCases.openProject({ projectDirectory });
  assert.equal(openedWithReadOnlyRecentIndex.ok, true);
  assert.equal(openedWithReadOnlyRecentIndex.project.id, created.project.id);
} finally {
  await chmod(readOnlyRecentIndexDirectory, 0o700);
}

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
assert.equal(removedRecent.deletionPolicy.mode, "recentIndexOnly");
assert.equal(removedRecent.deletionPolicy.reversible, true);
assert.equal(existsSync(join(manualProjectDirectory, "project.sqlite")), true);

const blockedDeleteDirectory = join(tempRoot, "BlockedProject");
const blockedDeleteTarget = await useCases.createProject({
  projectDirectory: blockedDeleteDirectory,
  starter: { id: "blocked-project", title: "차단 대상", premise: "삭제 차단 검증" }
});
assert.equal(blockedDeleteTarget.ok, true);
const blockedDelete = await useCases.deleteProjectWorkspace({
  projectDirectory: blockedDeleteDirectory,
  projectId: blockedDeleteTarget.project.id,
  confirmTitle: blockedDeleteTarget.project.title,
  deleteFiles: true
});
assert.equal(blockedDelete.ok, false);
assert.equal(blockedDelete.code, "PROJECT_INPUT_INVALID");
assert.equal(blockedDelete.action, "deleteProjectWorkspace");
assert.equal(existsSync(join(blockedDeleteDirectory, "project.sqlite")), true);

const deleteTargetDirectory = join(tempRoot, "DeleteProject.vnmaker");
const deleteTarget = await useCases.createProject({
  projectDirectory: deleteTargetDirectory,
  starter: { id: "delete-project", title: "삭제 대상", premise: "삭제 정책 검증" }
});
const deleteWithoutFiles = await useCases.deleteProjectWorkspace({
  projectDirectory: deleteTargetDirectory,
  projectId: deleteTarget.project.id,
  confirmTitle: deleteTarget.project.title,
  deleteFiles: false
});
assert.equal(deleteWithoutFiles.ok, false);
assert.equal(deleteWithoutFiles.code, "PROJECT_INPUT_INVALID");
const deleteOmittedFiles = await useCases.deleteProjectWorkspace({
  projectDirectory: deleteTargetDirectory,
  projectId: deleteTarget.project.id,
  confirmTitle: deleteTarget.project.title
});
assert.equal(deleteOmittedFiles.ok, false);
assert.equal(deleteOmittedFiles.code, "PROJECT_INPUT_INVALID");
const deleteWithoutProjectId = await useCases.deleteProjectWorkspace({
  projectDirectory: deleteTargetDirectory,
  confirmTitle: deleteTarget.project.title,
  deleteFiles: true
});
assert.equal(deleteWithoutProjectId.ok, false);
assert.equal(deleteWithoutProjectId.code, "PROJECT_INPUT_INVALID");
const deleteWithoutDirectory = await useCases.deleteProjectWorkspace({
  projectId: deleteTarget.project.id,
  confirmTitle: deleteTarget.project.title,
  deleteFiles: true
});
assert.equal(deleteWithoutDirectory.ok, false);
assert.equal(deleteWithoutDirectory.code, "PROJECT_INPUT_INVALID");
const wrongTitleDelete = await useCases.deleteProjectWorkspace({
  projectDirectory: deleteTargetDirectory,
  projectId: "delete-project",
  confirmTitle: "틀린 제목",
  deleteFiles: true
});
assert.equal(wrongTitleDelete.ok, false);
assert.equal(wrongTitleDelete.code, "PROJECT_INPUT_INVALID");
const deletedProject = await useCases.deleteProjectWorkspace({
  projectDirectory: deleteTargetDirectory,
  projectId: deleteTarget.project.id,
  confirmTitle: deleteTarget.project.title,
  deleteFiles: true
});
assert.equal(deletedProject.ok, true);
assert.equal(deletedProject.action, "deleteProjectWorkspace");
assert.equal(deletedProject.deletionPolicy.mode, "localProjectFiles");
assert.equal(deletedProject.deletionPolicy.reversible, false);
assert.equal(Array.isArray(deletedProject.deletionPolicy.impact), true);
assert.equal(existsSync(join(deleteTargetDirectory, "project.sqlite")), false);

const brokenDeleteIndexPath = join(tempRoot, "BrokenDeleteIndexAsFile");
await mkdir(brokenDeleteIndexPath, { recursive: true });
const brokenDeleteIndexUseCases = useCasesModule.createVnMakerUseCases({
  recentProjectIndexFile: brokenDeleteIndexPath
});
const brokenIndexDeleteDirectory = join(tempRoot, "BrokenIndexDelete.vnmaker");
const brokenIndexDeleteTarget = await brokenDeleteIndexUseCases.createProject({
  projectDirectory: brokenIndexDeleteDirectory,
  starter: { id: "broken-index-delete", title: "최근 인덱스 실패 삭제", premise: "삭제 후 인덱스 실패 검증" }
});
assert.equal(brokenIndexDeleteTarget.ok, true);
const deletedWithBrokenRecentIndex = await brokenDeleteIndexUseCases.deleteProjectWorkspace({
  projectDirectory: brokenIndexDeleteDirectory,
  projectId: brokenIndexDeleteTarget.project.id,
  confirmTitle: brokenIndexDeleteTarget.project.title,
  deleteFiles: true
});
assert.equal(deletedWithBrokenRecentIndex.ok, true);
assert.equal(deletedWithBrokenRecentIndex.recentIndexRemoval.ok, false);
assert.match(deletedWithBrokenRecentIndex.recentIndexRemoval.error, /EISDIR|illegal operation|directory/i);
assert.equal(existsSync(join(brokenIndexDeleteDirectory, "project.sqlite")), false);

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
