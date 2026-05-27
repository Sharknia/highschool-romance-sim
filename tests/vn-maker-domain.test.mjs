import assert from "node:assert/strict";

const core = await import("../packages/engine-core/dist/index.js");

const starter = core.createStarterProject({
  id: "domain-test",
  title: "도메인 테스트",
  premise: "순수 함수와 DTO schema 검증"
});

const parsedProject = core.parseVnMakerProject({
  ...starter,
  title: ""
});
assert.equal(parsedProject.ok, false);
assert.equal(parsedProject.issues.some((issue) => issue.path === "title"), true);

const parsedMalformedNestedProject = core.parseVnMakerProject({
  ...starter,
  characters: [{}]
});
assert.equal(parsedMalformedNestedProject.ok, false);
assert.equal(parsedMalformedNestedProject.issues.some((issue) => issue.path === "characters.0.id"), true);

const parsedValidProject = core.parseVnMakerProject(starter);
assert.equal(parsedValidProject.ok, true);
assert.equal(parsedValidProject.value.id, "domain-test");

const invalidPlan = core.parseEventExpansionPlan({
  summary: "잘못된 패치",
  decision: {
    sceneCount: "3",
    choiceCount: 1,
    cgCount: 1,
    newExpressionAssetCount: 0
  },
  patch: {
    operations: []
  }
});
assert.equal(invalidPlan.ok, false);
assert.equal(invalidPlan.issues.some((issue) => issue.path === "decision.sceneCount"), true);

const malformedChoicePlan = core.parseEventExpansionPlan({
  summary: "선택지 schema가 깨진 패치",
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
        sceneId: "scene-opening",
        choice: { id: 1, text: "잘못된 선택지", next: "scene-ending" }
      }
    ]
  }
});
assert.equal(malformedChoicePlan.ok, false);
assert.equal(malformedChoicePlan.issues.some((issue) => issue.path === "patch.operations.0.choice.id"), true);

const malformedAssetPlan = core.parseEventExpansionPlan({
  summary: "에셋 schema가 깨진 패치",
  decision: {
    sceneCount: 0,
    choiceCount: 0,
    cgCount: 1,
    newExpressionAssetCount: 0
  },
  patch: {
    operations: [
      {
        type: "addAsset",
        asset: { id: "asset-bad", kind: "not-real", label: "잘못된 에셋" }
      }
    ]
  }
});
assert.equal(malformedAssetPlan.ok, false);
assert.equal(malformedAssetPlan.issues.some((issue) => issue.path === "patch.operations.0.asset.kind"), true);

const malformedJobPlan = core.parseEventExpansionPlan({
  summary: "생성 작업 schema가 깨진 패치",
  decision: {
    sceneCount: 0,
    choiceCount: 0,
    cgCount: 0,
    newExpressionAssetCount: 0
  },
  patch: {
    operations: [
      {
        type: "addGenerationJob",
        job: { id: "job-bad", kind: "cg", targetId: "scene-opening", prompt: "bad", provider: "mock-adapter", status: "queued" }
      }
    ]
  }
});
assert.equal(malformedJobPlan.ok, false);
assert.equal(malformedJobPlan.issues.some((issue) => issue.path === "patch.operations.0.job.status"), true);

const secondCharacter = {
  id: "mira",
  displayName: "미라",
  role: "서브 히로인",
  profile: "방송부 친구.",
  emotionTags: ["normal"],
  portraitAssetIds: []
};
const withCharacter = core.upsertProjectCharacter(starter, secondCharacter);
assert.equal(withCharacter.characters.some((character) => character.id === "mira"), true);
assert.equal(starter.characters.some((character) => character.id === "mira"), false);

const replacementCharacter = {
  ...secondCharacter,
  profile: "방송부에서 제작툴 테스트를 돕는 친구."
};
const replacedCharacterProject = core.upsertProjectCharacter(withCharacter, replacementCharacter);
assert.equal(replacedCharacterProject.characters.filter((character) => character.id === "mira").length, 1);
assert.equal(replacedCharacterProject.characters.find((character) => character.id === "mira").profile, replacementCharacter.profile);

const addedScene = {
  id: "scene-domain-extra",
  label: "추가 장면",
  speaker: "미라",
  text: "순수 함수로 추가된 장면.",
  characters: [],
  choices: []
};
const withScene = core.upsertProjectScene(starter, addedScene);
assert.equal(withScene.scenes.some((scene) => scene.id === "scene-domain-extra"), true);
assert.equal(starter.scenes.some((scene) => scene.id === "scene-domain-extra"), false);

const generationJob = core.createImageGenerationJob({
  id: "job-domain-cg",
  kind: "cg",
  targetId: starter.scenes[0].id,
  prompt: "domain cg",
  outputAssetId: "asset-domain-cg"
});
generationJob.status = "completed";
const withGenerationResult = core.applyGenerationResultToProject(starter, {
  job: generationJob,
  asset: {
    id: "asset-domain-cg",
    kind: "cg",
    label: "도메인 CG",
    uri: "/generated-assets/asset-domain-cg.png",
    source: "generated",
    generationJobId: "job-domain-cg"
  }
});
assert.equal(withGenerationResult.generationJobs.some((job) => job.id === "job-domain-cg" && job.status === "completed"), true);
assert.equal(withGenerationResult.assets.some((asset) => asset.id === "asset-domain-cg" && asset.source === "generated"), true);
assert.equal(starter.generationJobs.some((job) => job.id === "job-domain-cg"), false);

assert.equal(core.MOCK_IMAGE_PACK_ADAPTER, "mock-image-pack-adapter");
const mockPackManifest = core.parseMockImagePackManifest({
  id: "alpha-mock-pack",
  version: "2026.05.26",
  adapter: core.MOCK_IMAGE_PACK_ADAPTER,
  sourceGeneratedBy: "codex-imageGeneration",
  assets: [{
    id: "asset-mock-bg",
    kind: "background",
    target: "project-background",
    filePath: "mock-pack/backgrounds/classroom.webp",
    label: "목 이미지 교실 배경",
    license: "internal mock asset",
    provenance: {
      adapter: core.MOCK_IMAGE_PACK_ADAPTER,
      fallbackReason: "OAUTH_REQUIRED",
      packId: "alpha-mock-pack",
      packVersion: "2026.05.26",
      sourceGeneratedBy: "codex-imageGeneration",
      license: "internal mock asset"
    }
  }]
});
assert.equal(mockPackManifest.ok, true);
assert.equal(mockPackManifest.value.assets[0].provenance.packVersion, "2026.05.26");
const invalidMockPackManifest = core.parseMockImagePackManifest({
  id: "broken-pack",
  version: "2026.05.26",
  adapter: core.MOCK_IMAGE_PACK_ADAPTER,
  sourceGeneratedBy: "codex-imageGeneration",
  assets: [{ id: "asset-broken", kind: "background", target: "project-background", label: "broken" }]
});
assert.equal(invalidMockPackManifest.ok, false);
assert.equal(invalidMockPackManifest.issues.some((issue) => issue.path === "assets.0.filePath"), true);

const mockPackJob = {
  id: "job-mock-bg",
  kind: "background",
  targetId: "domain-project",
  prompt: "fallback classroom background",
  provider: core.MOCK_IMAGE_PACK_ADAPTER,
  status: "completed",
  outputAssetId: "asset-mock-bg",
  dummy: true,
  fallbackReason: "OAUTH_REQUIRED",
  packVersion: "2026.05.26",
  sourceGeneratedBy: "codex-imageGeneration"
};
const mockPackAsset = {
  id: "asset-mock-bg",
  kind: "background",
  label: "목 이미지 교실 배경",
  uri: "/generated-assets/asset-mock-bg.webp",
  source: "mock",
  generationJobId: "job-mock-bg",
  provenance: {
    adapter: core.MOCK_IMAGE_PACK_ADAPTER,
    fallbackReason: "OAUTH_REQUIRED",
    packId: "alpha-mock-pack",
    packVersion: "2026.05.26",
    sourceGeneratedBy: "codex-imageGeneration",
    license: "internal mock asset"
  }
};
const mockPackProject = {
  ...starter,
  assets: [mockPackAsset, ...starter.assets.filter((asset) => asset.kind !== "background")],
  generationJobs: [mockPackJob, ...starter.generationJobs],
  scenes: starter.scenes.map((scene) => ({ ...scene, backgroundAssetId: "asset-mock-bg" }))
};
assert.equal(core.parseVnMakerProject(mockPackProject).ok, true);
assert.equal(core.validateProject(mockPackProject).filter((issue) => issue.severity === "error").length, 0);
const mockPackAssetManifest = core.createAssetManifest(mockPackProject);
assert.equal(mockPackAssetManifest.requiredAssets.some((asset) => asset.id === "asset-mock-bg" && asset.source === "mock"), true);
assert.equal(mockPackAssetManifest.requiredAssets.find((asset) => asset.id === "asset-mock-bg")?.provenance.packVersion, "2026.05.26");
const mockRuntime = core.createPlayerRuntimeData(mockPackProject);
assert.equal(mockRuntime.scenes.every((scene) => scene.backgroundAsset?.source === "mock"), true);
assert.equal(mockRuntime.scenes.every((scene) => scene.backgroundAsset?.provenance?.adapter === core.MOCK_IMAGE_PACK_ADAPTER), true);
const missingMockProvenanceProject = {
  ...mockPackProject,
  assets: [{ ...mockPackAsset, provenance: undefined }]
};
assert.equal(
  core.validateProject(missingMockProvenanceProject).some((issue) => issue.path === "assets.0.provenance" && issue.severity === "error"),
  true,
  "mock/dummy asset은 provenance 없이 통과하면 안 됩니다."
);

const parsedBackgroundInput = core.parseCreateImageGenerationJobInput({
  id: "job-domain-background",
  kind: "background",
  targetId: starter.id,
  prompt: "after school classroom background",
  outputAssetId: "asset-domain-background"
});
assert.equal(parsedBackgroundInput.ok, true);

const backgroundJob = core.createImageGenerationJob({
  id: "job-domain-background",
  kind: "background",
  targetId: starter.id,
  prompt: "after school classroom background",
  outputAssetId: "asset-domain-background"
});
assert.equal(backgroundJob.kind, "background");
assert.equal(backgroundJob.outputAssetId, "asset-domain-background");
assert.equal(core.createImageGenerationJob({
  id: "job-background-contract",
  kind: "background",
  targetId: "project-background-contract",
  prompt: "contract background",
  outputAssetId: "asset-background-contract"
}).kind, "background");

const parsedBackgroundJob = core.parseVnMakerProject({
  ...starter,
  generationJobs: [backgroundJob],
  assets: [{
    id: "asset-domain-background",
    kind: "background",
    label: "도메인 배경",
    uri: "/generated-assets/asset-domain-background.png",
    source: "generated",
    generationJobId: "job-domain-background"
  }]
});
assert.equal(parsedBackgroundJob.ok, true);

const parsedUnsupportedGenerationJobKindProject = core.parseVnMakerProject({
  ...starter,
  generationJobs: [{
    ...backgroundJob,
    id: "job-domain-unsupported-kind",
    kind: "soundtrack"
  }]
});
assert.equal(parsedUnsupportedGenerationJobKindProject.ok, false);
assert.equal(parsedUnsupportedGenerationJobKindProject.issues.some((issue) => issue.path === "generationJobs.0.kind"), true);

const policy = core.describeEventExpansionPolicy();
assert.equal(policy.allowedOperationTypes.includes("addScene"), true);
assert.equal(policy.alphaTarget.sceneCount, 3);

function createManualBranchProject(overrides = {}) {
  const project = core.createStarterProject({
    id: "manual-branch-test",
    title: "수동 분기 테스트",
    premise: "분기별 엔딩 도달 검증"
  });

  const branchProject = {
    ...project,
    routes: [
      {
        ...project.routes[0],
        entrySceneId: "scene-opening"
      }
    ],
    scenes: [
      {
        id: "scene-opening",
        label: "분기 시작",
        speaker: "나",
        text: "하루와 문화제를 준비한다.",
        backgroundAssetId: "asset-classroom-bg",
        characters: [{ characterId: "haru", expression: "normal", assetId: "asset-haru-portrait", position: "center" }],
        choices: [
          { id: "choice-good", text: "솔직히 고백한다", next: "scene-good-ending" },
          { id: "choice-normal", text: "함께 전시를 마무리한다", next: "scene-normal-ending" }
        ]
      },
      {
        id: "scene-good-ending",
        label: "굿 엔딩",
        speaker: "하루",
        text: "내년 문화제도 같이 만들자.",
        backgroundAssetId: "asset-classroom-bg",
        characters: [{ characterId: "haru", expression: "happy", assetId: "asset-haru-portrait", position: "center" }],
        choices: [],
        ending: { id: "ending-good", title: "문화제의 약속", kind: "good" }
      },
      {
        id: "scene-normal-ending",
        label: "노멀 엔딩",
        speaker: "하루",
        text: "오늘은 여기까지지만, 우리는 계속 만들 수 있어.",
        backgroundAssetId: "asset-classroom-bg",
        characters: [{ characterId: "haru", expression: "normal", assetId: "asset-haru-portrait", position: "center" }],
        choices: [],
        ending: { id: "ending-normal", title: "다음 작품으로", kind: "normal" }
      }
    ]
  };

  return {
    ...branchProject,
    ...overrides,
    routes: overrides.routes || branchProject.routes,
    scenes: overrides.scenes || branchProject.scenes
  };
}

function issueCodes(issues) {
  return issues.map((issue) => issue.code || issue.message);
}

const manualBranchProject = createManualBranchProject();
assert.equal(typeof core.analyzeRouteGraph, "function");
const branchAnalysis = core.analyzeRouteGraph(manualBranchProject);
assert.deepEqual(branchAnalysis.reachableEndingIds.sort(), ["ending-good", "ending-normal"]);
assert.deepEqual(branchAnalysis.uncoveredTerminalSceneIds, []);
assert.deepEqual(branchAnalysis.missingTargets, []);
assert.deepEqual(branchAnalysis.cyclesWithoutEndingPath, []);
assert.equal(branchAnalysis.issues.filter((issue) => issue.severity === "error").length, 0);
assert.deepEqual(core.validateProject(manualBranchProject).filter((issue) => issue.severity === "error"), []);

const parsedEndingScene = core.parseVnMakerScene(manualBranchProject.scenes[1]);
assert.equal(parsedEndingScene.ok, true);
assert.equal(parsedEndingScene.value.ending.title, "문화제의 약속");

const runtimeWithEnding = core.createPlayerRuntimeData(manualBranchProject);
assert.equal(runtimeWithEnding.scenes.find((scene) => scene.id === "scene-good-ending").ending.title, "문화제의 약속");

const uncoveredBranchProject = createManualBranchProject({
  scenes: manualBranchProject.scenes.map((scene) => scene.id === "scene-normal-ending" ? { ...scene, ending: undefined } : scene)
});
const uncoveredAnalysis = core.analyzeRouteGraph(uncoveredBranchProject);
assert.deepEqual(uncoveredAnalysis.uncoveredTerminalSceneIds, ["scene-normal-ending"]);
assert.equal(issueCodes(uncoveredAnalysis.issues).includes("uncovered-terminal"), true);
assert.equal(core.validateProject(uncoveredBranchProject).some((issue) => issue.message.includes("엔딩 없이 끝납니다")), true);

const endingWithNextProject = createManualBranchProject({
  scenes: manualBranchProject.scenes.map((scene) => scene.id === "scene-good-ending" ? { ...scene, next: "scene-normal-ending" } : scene)
});
const endingNextAnalysis = core.analyzeRouteGraph(endingWithNextProject);
assert.equal(issueCodes(endingNextAnalysis.issues).includes("ending-has-outgoing"), true);

const endingWithChoicesProject = createManualBranchProject({
  scenes: manualBranchProject.scenes.map((scene) => scene.id === "scene-good-ending"
    ? { ...scene, choices: [{ id: "choice-after-ending", text: "계속한다", next: "scene-normal-ending" }] }
    : scene)
});
const endingChoicesAnalysis = core.analyzeRouteGraph(endingWithChoicesProject);
assert.equal(issueCodes(endingChoicesAnalysis.issues).includes("ending-has-outgoing"), true);

const mixedOutgoingProject = createManualBranchProject({
  scenes: manualBranchProject.scenes.map((scene) => scene.id === "scene-opening" ? { ...scene, next: "scene-good-ending" } : scene)
});
const mixedOutgoingAnalysis = core.analyzeRouteGraph(mixedOutgoingProject);
assert.equal(issueCodes(mixedOutgoingAnalysis.issues).includes("mixed-outgoing"), true);

const cycleProject = createManualBranchProject({
  scenes: [
    {
      ...manualBranchProject.scenes[0],
      choices: [
        { id: "choice-cycle", text: "계속 반복한다", next: "scene-cycle-a" }
      ]
    },
    {
      id: "scene-cycle-a",
      label: "순환 A",
      speaker: "하루",
      text: "다시 처음으로 돌아가는 기분이다.",
      characters: [],
      choices: [],
      next: "scene-cycle-b"
    },
    {
      id: "scene-cycle-b",
      label: "순환 B",
      speaker: "나",
      text: "끝나지 않는 준비가 이어진다.",
      characters: [],
      choices: [],
      next: "scene-cycle-a"
    }
  ]
});
const cycleAnalysis = core.analyzeRouteGraph(cycleProject);
assert.equal(issueCodes(cycleAnalysis.issues).includes("cycle-without-ending-path"), true);
assert.equal(cycleAnalysis.cyclesWithoutEndingPath.length, 1);

const duplicateChoiceProject = createManualBranchProject({
  scenes: manualBranchProject.scenes.map((scene) => scene.id === "scene-opening"
    ? { ...scene, choices: [...scene.choices, { id: "choice-good", text: "다시 고백한다", next: "scene-good-ending" }] }
    : scene)
});
assert.equal(issueCodes(core.analyzeRouteGraph(duplicateChoiceProject).issues).includes("duplicate-choice-id"), true);

const emptyChoiceTextProject = createManualBranchProject({
  scenes: manualBranchProject.scenes.map((scene) => scene.id === "scene-opening"
    ? { ...scene, choices: scene.choices.map((choice) => choice.id === "choice-good" ? { ...choice, text: "   " } : choice) }
    : scene)
});
assert.equal(issueCodes(core.analyzeRouteGraph(emptyChoiceTextProject).issues).includes("empty-choice-text"), true);
assert.equal(core.parseVnMakerScene(emptyChoiceTextProject.scenes[0]).issues.some((issue) => issue.path === "choices.0.text"), true);

const duplicateEndingProject = createManualBranchProject({
  scenes: manualBranchProject.scenes.map((scene) => scene.ending ? { ...scene, ending: { ...scene.ending, id: "ending-shared" } } : scene)
});
assert.equal(issueCodes(core.analyzeRouteGraph(duplicateEndingProject).issues).includes("duplicate-ending-id"), true);

const missingTargetProject = createManualBranchProject({
  scenes: manualBranchProject.scenes.map((scene) => scene.id === "scene-opening"
    ? { ...scene, choices: scene.choices.map((choice) => choice.id === "choice-normal" ? { ...choice, next: "scene-missing-ending" } : choice) }
    : scene)
});
const missingTargetAnalysis = core.analyzeRouteGraph(missingTargetProject);
assert.equal(issueCodes(missingTargetAnalysis.issues).includes("missing-target"), true);
assert.deepEqual(missingTargetAnalysis.missingTargets, [{ sourceSceneId: "scene-opening", targetSceneId: "scene-missing-ending", edgeType: "choice", choiceId: "choice-normal" }]);

const invalidEndingParse = core.parseVnMakerScene({
  ...manualBranchProject.scenes[1],
  ending: { id: "ending-invalid", title: "잘못된 엔딩", kind: "special" }
});
assert.equal(invalidEndingParse.ok, false);
assert.equal(invalidEndingParse.issues.some((issue) => issue.path === "ending.kind"), true);
