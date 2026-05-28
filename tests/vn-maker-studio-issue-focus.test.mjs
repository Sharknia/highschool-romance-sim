import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const core = await import("../packages/engine-core/dist/index.js");
const projectStoreModule = await import("../packages/project-store/dist/index.js");
const useCasesModule = await import("../packages/use-cases/dist/index.js");

const heroine = core.createHeroineProfile({
  id: "haru",
  name: "하루",
  description: "도서관에서 자주 만나는 학생.",
  personality: "차분하다.",
  speechStyle: "조심스럽게 말한다.",
  appearance: "단정한 교복."
});

function makeProject() {
  const project = core.createProjectFromHeroine({
    id: "studio-issue-focus",
    heroine,
    title: "Studio Issue Focus",
    premise: "문제 위치 매핑 검증"
  });
  const opening = project.scenes[0];
  opening.next = "scene-middle";
  project.scenes.splice(1, 0, {
    id: "scene-middle",
    label: "중간",
    speaker: "하루",
    text: "다음 장면과 선택지를 동시에 가진 장면",
    characters: [],
    next: "scene-next",
    choices: [
      { id: "choice-branch", text: "분기로 간다", next: "scene-choice" }
    ]
  });
  project.scenes.push({
    id: "scene-choice",
    label: "선택",
    speaker: "하루",
    text: "조건부 선택지를 보여준다.",
    characters: [],
    choices: [
      {
        id: "choice-conditional",
        text: "조건을 확인한다",
        next: "scene-ending",
        condition: { minAffinity: { haru: 2 } },
        effects: { affinity: { haru: 1 } }
      },
      { id: "choice-missing", text: "없는 장면으로 간다", next: "scene-missing" }
    ]
  });
  project.scenes.push({
    id: "scene-ending",
    label: "끝",
    speaker: "하루",
    text: "엔딩이지만 다음 장면도 가진다.",
    characters: [],
    choices: [],
    next: "scene-next",
    ending: { id: "ending-good", title: "굿 엔딩", kind: "good" }
  });
  project.scenes.push({
    id: "scene-next",
    label: "다음",
    speaker: "",
    text: "mixed outgoing의 next 타깃",
    characters: [],
    choices: [],
    ending: { id: "ending-next", title: "다음 엔딩", kind: "normal" }
  });
  project.scenes.push({
    id: "scene-orphan",
    label: "고립",
    speaker: "",
    text: "도달할 수 없는 장면",
    characters: [],
    choices: []
  });
  return project;
}

function requiredIssue(issues, code, predicate = () => true) {
  const issue = issues.find((item) => item.code === code && predicate(item));
  assert.ok(issue, `${code} issue가 있어야 합니다.`);
  return issue;
}

const project = makeProject();
const routeId = project.routes[0].id;
const validationIssues = core.validateProject(project);
const validation = {
  ok: validationIssues.every((issue) => issue.severity !== "error"),
  issues: validationIssues
};
const projectRevision = core.createProjectRevision(project, "2026-05-28T00:00:00.000Z");
const previewPreflight = core.createPreviewPreflight(project, validation, projectRevision);
const studio = core.createStudioViewModel(project, validation, previewPreflight, projectRevision, {
  routeId,
  selectedSceneId: "scene-middle"
});

const dottedSceneFocus = core.createStudioIssueFocus(project, {
  severity: "error",
  code: "mixed-outgoing",
  path: "scenes.1",
  message: "mixed",
  sceneIds: [],
  choiceIds: []
}, { routeId });
const bracketSceneFocus = core.createStudioIssueFocus(project, {
  severity: "error",
  code: "mixed-outgoing",
  path: "scenes[1]",
  message: "mixed",
  sceneIds: [],
  choiceIds: []
}, { routeId });
const idSceneFocus = core.createStudioIssueFocus(project, {
  severity: "error",
  code: "mixed-outgoing",
  path: "scenes.scene-middle",
  message: "mixed",
  sceneIds: [],
  choiceIds: []
}, { routeId });
assert.equal(dottedSceneFocus.sceneId, "scene-middle");
assert.equal(bracketSceneFocus.sceneId, "scene-middle");
assert.equal(idSceneFocus.sceneId, "scene-middle");

const endingIssue = requiredIssue(validationIssues, "ending-has-outgoing", (issue) => issue.sceneIds?.includes("scene-ending"));
const endingFocus = core.createStudioIssueFocus(project, endingIssue, { routeId });
assert.equal(endingFocus.inspectorPanel, "scene");
assert.equal(endingFocus.field, "ending");

const mixedIssue = requiredIssue(validationIssues, "mixed-outgoing", (issue) => issue.sceneIds?.includes("scene-middle"));
const mixedFocus = core.createStudioIssueFocus(project, mixedIssue, { routeId });
assert.equal(mixedFocus.inspectorPanel, "choices");
assert.equal(mixedFocus.field, "outgoing");

const missingPreflightIssue = previewPreflight.blockers.find((issue) =>
  issue.issueCode === "missing-target" && issue.choiceIds?.includes("choice-missing")
);
assert.ok(missingPreflightIssue, "missing-target preflight blocker가 있어야 합니다.");
const missingFocus = core.createStudioIssueFocus(project, missingPreflightIssue, { routeId, severity: "error" });
assert.equal(missingFocus.sceneId, "scene-choice");
assert.equal(missingFocus.choiceId, "choice-missing");
assert.equal(missingFocus.targetSceneId, "scene-missing");
assert.equal(missingFocus.scriptBlockId, "scene:scene-choice");
assert.equal(missingFocus.inspectorPanel, "choices");
assert.equal(missingFocus.field, "choiceTarget");
assert.equal(missingFocus.defaultAction, "repair");
assert.deepEqual(missingFocus.repairActionIds, ["create-target-scene", "connect-existing-scene"]);

const orphanIssue = requiredIssue(validationIssues, "orphan-scene", (issue) => issue.sceneIds?.includes("scene-orphan"));
const orphanFocus = core.createStudioIssueFocus(project, orphanIssue, { routeId });
assert.equal(orphanFocus.sceneId, "scene-orphan");
assert.equal(orphanFocus.defaultAction, "focus");

const conditionFocus = studio.previewPreflight.warnings.find((issue) => issue.issueCode === "conditional-choice-runtime-unsupported");
assert.ok(conditionFocus, "condition/effects runtime warning이 Studio preflight warning에 있어야 합니다.");
assert.equal(conditionFocus.inspectorPanel, "stats");
assert.equal(conditionFocus.field, "condition");
assert.equal(conditionFocus.sceneId, "scene-choice");
assert.equal(conditionFocus.choiceId, "choice-conditional");

const backgroundFocus = core.createStudioIssueFocus(project, {
  severity: "warning",
  path: "scenes.scene-choice.backgroundAssetId",
  message: "missing background"
}, { routeId });
assert.equal(backgroundFocus.inspectorPanel, "assets");
assert.equal(backgroundFocus.field, "backgroundAssetId");

const cgFocus = core.createStudioIssueFocus(project, {
  severity: "warning",
  path: "scenes.scene-choice.cgAssetId",
  message: "missing cg"
}, { routeId });
assert.equal(cgFocus.inspectorPanel, "assets");
assert.equal(cgFocus.field, "cgAssetId");

const genericAssetFocus = core.createStudioIssueFocus(project, {
  severity: "error",
  path: "assets.0.provenance",
  message: "missing provenance"
}, { routeId });
assert.equal(genericAssetFocus.inspectorPanel, "assets");
assert.equal(genericAssetFocus.field, "assets");

const backgroundRequiredFocus = core.createStudioIssueFocus(project, {
  issueCode: "background-required",
  path: "assets",
  message: "background required",
  repairActionIds: ["generate-background"]
}, { routeId, severity: "error" });
assert.equal(backgroundRequiredFocus.inspectorPanel, "assets");
assert.equal(backgroundRequiredFocus.field, "backgroundAssetId");
assert.equal(backgroundRequiredFocus.defaultAction, "repair");

const generationIncompleteFocus = core.createStudioIssueFocus(project, {
  issueCode: "image-generation-incomplete",
  path: "generationJobs",
  message: "image jobs incomplete",
  repairActionIds: ["run-generation-jobs"]
}, { routeId, severity: "error" });
assert.equal(generationIncompleteFocus.inspectorPanel, "assets");
assert.equal(generationIncompleteFocus.field, "generationJobs");

const tempRoot = await mkdtemp(join(tmpdir(), "vn-maker-studio-issue-focus-"));
const projectDirectory = join(tempRoot, "StudioIssueFocus.vnmaker");
const useCases = useCasesModule.createVnMakerUseCases();

try {
  await projectStoreModule.createProjectWorkspace({ projectDirectory, project });
  const context = await useCases.getStudioContext({
    projectDirectory,
    routeId,
    sceneId: "scene-middle",
    problemId: missingFocus.issueId
  });
  assert.equal(context.ok, true);
  const contextMissingIssue = context.studio.issues.find((issue) =>
    issue.issueCode === "missing-target" && issue.choiceId === "choice-missing"
  );
  assert.ok(contextMissingIssue, "Studio context는 canonical missing-target issue focus를 반환해야 합니다.");
  const contextActions = context.problemActions.filter((action) => action.issueId === contextMissingIssue.issueId);
  assert.equal(contextActions.length >= 2, true);
  assert.equal(contextActions.every((action) => action.issueCode === "missing-target"), true);
  assert.equal(contextActions.every((action) => action.requiresPreflight === true), true);
  assert.equal(contextActions.every((action) => "disabledReason" in action), true);
  assert.equal(context.studio.routeSelection.selectedProblemId, missingFocus.issueId);
  assert.equal(context.studio.routeSelection.deepLinkQuery.problem, missingFocus.issueId);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
