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

const policy = core.describeEventExpansionPolicy();
assert.equal(policy.allowedOperationTypes.includes("addScene"), true);
assert.equal(policy.alphaTarget.sceneCount, 3);
