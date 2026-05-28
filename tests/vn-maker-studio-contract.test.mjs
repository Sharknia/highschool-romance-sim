import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const core = await import("../packages/engine-core/dist/index.js");
const projectStoreModule = await import("../packages/project-store/dist/index.js");
const useCasesModule = await import("../packages/use-cases/dist/index.js");
const webHandlers = await import("../apps/web/dist/server/handlers.js");

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
    id: "studio-contract",
    heroine,
    title: "Studio Contract",
    premise: "공통 Studio contract 검증"
  });
  const opening = project.scenes[0];
  opening.next = "scene-middle";
  project.scenes.splice(1, 0, {
    id: "scene-middle",
    label: "중간",
    speaker: "하루",
    text: "분기 전 장면",
    characters: [],
    choices: [
      { id: "choice-good", text: "다가간다", next: "scene-good" },
      { id: "choice-missing", text: "도망간다", next: "scene-missing" }
    ]
  });
  project.scenes.push({
    id: "scene-good",
    label: "좋은 끝",
    speaker: "하루",
    text: "웃으며 끝난다.",
    characters: [],
    choices: [],
    ending: { id: "ending-good", title: "굿 엔딩", kind: "good" }
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

const project = makeProject();
const validationIssues = core.validateProject(project);
const validation = {
  ok: validationIssues.every((issue) => issue.severity !== "error"),
  issues: validationIssues
};
const projectRevision = core.createProjectRevision(project, "2026-05-28T00:00:00.000Z");
const previewPreflight = core.createPreviewPreflight(project, validation, projectRevision);
const routeId = project.routes[0].id;

const studio = core.createStudioViewModel(project, validation, previewPreflight, projectRevision, {
  routeId,
  selectedSceneId: "scene-middle"
});

assert.equal(studio.projectId, "studio-contract");
assert.equal(studio.routeSelection.routeId, routeId);
assert.equal(studio.routeSelection.selectedSceneId, "scene-middle");
assert.equal(studio.routeSelection.deepLinkQuery.route, routeId);
assert.equal(studio.routeSelection.deepLinkQuery.scene, "scene-middle");
assert.equal(studio.routeGraph.nodes.some((node) => node.id === "scene-orphan" && node.unreachable === true), true);
assert.equal(studio.routeGraph.edges.some((edge) => edge.kind === "choice" && edge.choiceId === "choice-good" && edge.targetSceneId === "scene-good"), true);
assert.equal(studio.routeGraph.edges.some((edge) => edge.kind === "choice" && edge.choiceId === "choice-missing" && edge.missingTarget === true), true);
assert.equal(studio.routeGraph.markers.unreachableSceneIds.includes("scene-orphan"), true);
assert.equal(studio.previewPreflight.canRun, false);
assert.equal(studio.previewPreflight.blockers.some((issue) => issue.issueCode === "missing-target" && issue.choiceId === "choice-missing"), true);

const sceneIndexIssueFocus = core.createStudioIssueFocus(project, {
  severity: "error",
  code: "missing-target",
  path: "scenes.1.choices.1.next",
  message: "missing",
  sceneIds: [],
  choiceIds: [],
  targetSceneId: "scene-missing"
}, { routeId });
const sceneBracketIssueFocus = core.createStudioIssueFocus(project, {
  severity: "error",
  code: "missing-target",
  path: "scenes[1].choices[1].next",
  message: "missing",
  sceneIds: [],
  choiceIds: []
}, { routeId });
const sceneIdIssueFocus = core.createStudioIssueFocus(project, {
  severity: "error",
  code: "mixed-outgoing",
  path: "scenes.scene-middle.choices.choice-good.next",
  message: "mixed",
  sceneIds: [],
  choiceIds: []
}, { routeId });
assert.equal(sceneIndexIssueFocus.sceneId, "scene-middle");
assert.equal(sceneIndexIssueFocus.targetSceneId, "scene-missing");
assert.equal(sceneIndexIssueFocus.field, "choiceTarget");
assert.equal(sceneBracketIssueFocus.sceneId, "scene-middle");
assert.equal(sceneBracketIssueFocus.choiceId, "choice-missing");
assert.equal(sceneIdIssueFocus.sceneId, "scene-middle");
assert.equal(sceneIdIssueFocus.choiceId, "choice-good");
assert.equal(sceneIdIssueFocus.inspectorPanel, "choices");

const missingTargetPreflightFocus = studio.previewPreflight.blockers.find((issue) => issue.issueCode === "missing-target" && issue.choiceId === "choice-missing");
assert.ok(missingTargetPreflightFocus);
assert.equal(missingTargetPreflightFocus.field, "choiceTarget");
assert.equal(missingTargetPreflightFocus.defaultAction, "repair");

const tempRoot = await mkdtemp(join(tmpdir(), "vn-maker-studio-contract-"));
const projectDirectory = join(tempRoot, "StudioContract.vnmaker");
const useCases = useCasesModule.createVnMakerUseCases();

try {
  await projectStoreModule.createProjectWorkspace({ projectDirectory, project });
  const context = await useCases.getStudioContext({
    projectDirectory,
    routeId,
    sceneId: "scene-middle"
  });

  assert.equal(context.ok, true);
  assert.equal(context.studio.routeSelection.selectedSceneId, "scene-middle");
  assert.equal(context.studio.previewPreflight.canRun, false);
  assert.equal(context.problemActions.some((action) => action.actionId === "create-target-scene"), true);
  const missingTargetIssue = context.studio.issues.find((issue) => issue.issueCode === "missing-target" && issue.choiceId === "choice-missing");
  assert.equal(Boolean(missingTargetIssue), true);
  assert.equal(
    context.problemActions
      .filter((action) => action.issueCode === "missing-target" && action.targetPath === missingTargetIssue.path)
      .every((action) => action.issueId === missingTargetIssue.issueId),
    true,
    "problem action issueId must match the canonical Studio issue focus id"
  );

  const duplicateResult = await useCases.applyStudioMutation({
    projectDirectory,
    expectedProjectRevision: context.projectRevision,
    routeId,
    operations: [
      { type: "duplicateChoice", sceneId: "scene-middle", choiceId: "choice-good", newChoiceId: "choice-good-copy" },
      { type: "clearChoiceTarget", sceneId: "scene-middle", choiceId: "choice-missing" }
    ]
  });

  const middleScene = duplicateResult.project.scenes.find((scene) => scene.id === "scene-middle");
  assert.equal(duplicateResult.ok, true);
  assert.equal(duplicateResult.appliedOperations.length, 2);
  assert.equal(duplicateResult.selectedSceneId, "scene-middle");
  assert.equal(middleScene.choices.some((choice) => choice.id === "choice-good-copy"), true);
  assert.equal(middleScene.choices.find((choice) => choice.id === "choice-missing").next, "studio-unlinked-target-choice-missing");
  assert.notEqual(duplicateResult.projectRevision.revision, context.projectRevision.revision);
  assert.equal(duplicateResult.studio.previewPreflight.blockers.some((issue) => issue.targetSceneId === "studio-unlinked-target-choice-missing"), true);

  const staleResult = await useCases.applyStudioMutation({
    projectDirectory,
    expectedProjectRevision: context.projectRevision,
    operations: [{ type: "deleteChoice", sceneId: "scene-middle", choiceId: "choice-good-copy" }]
  });

  assert.equal(staleResult.ok, false);
  assert.equal(staleResult.code, "STALE_PROJECT_REVISION");

  const invalidMutation = await useCases.applyStudioMutation({
    projectDirectory,
    expectedProjectRevision: duplicateResult.projectRevision,
    operations: [{ type: "reorderChoice", sceneId: "scene-middle", choiceId: "choice-good-copy" }]
  });
  assert.equal(invalidMutation.ok, false);
  assert.equal(invalidMutation.code, "PROJECT_INPUT_INVALID");
  assert.equal(invalidMutation.issues.some((issue) => issue.path === "operations.0.toIndex"), true);

  const apiHandler = webHandlers.createApiRequestHandler();
  const apiContext = await apiHandler({
    method: "POST",
    path: "/api/project/studio/context",
    body: { projectDirectory, routeId, sceneId: "scene-middle" }
  });
  assert.equal(apiContext.status, 200);
  assert.equal(apiContext.body.ok, true);
  assert.equal(apiContext.body.studio.routeGraph.routeId, routeId);
  assert.equal(apiContext.body.studio.previewPreflight.canRun, false);

  const apiInvalidMutation = await apiHandler({
    method: "POST",
    path: "/api/project/studio/mutate",
    body: {
      projectDirectory,
      expectedProjectRevision: duplicateResult.projectRevision,
      operations: [{ type: "reorderChoice", sceneId: "scene-middle", choiceId: "choice-good-copy" }]
    }
  });
  assert.equal(apiInvalidMutation.status, 400);
  assert.equal(apiInvalidMutation.body.ok, false);
  assert.equal(apiInvalidMutation.body.code, "PROJECT_INPUT_INVALID");

  const deleteEntryResult = await useCases.applyStudioMutation({
    projectDirectory,
    expectedProjectRevision: duplicateResult.projectRevision,
    routeId,
    operations: [{ type: "deleteScene", sceneId: project.routes[0].entrySceneId, mode: "unlinkReferences" }]
  });
  assert.equal(deleteEntryResult.ok, true);
  assert.equal(deleteEntryResult.project.routes[0].entrySceneId, "scene-middle");
  assert.equal(deleteEntryResult.project.scenes.some((scene) => scene.id === project.routes[0].entrySceneId), false);

  const cliContextRaw = execFileSync("node", ["packages/cli/dist/index.js", "studio-context"], {
    cwd: process.cwd(),
    input: JSON.stringify({ projectDirectory, routeId, sceneId: "scene-middle" }),
    encoding: "utf8"
  });
  const cliContext = JSON.parse(cliContextRaw);
  assert.equal(cliContext.ok, true);
  assert.equal(cliContext.studio.routeGraph.routeId, routeId);
  assert.equal(cliContext.studio.previewPreflight.canRun, false);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

const handlersSource = readFileSync("apps/web/src/server/handlers.ts", "utf8");
const cliSource = readFileSync("packages/cli/src/index.ts", "utf8");
const clientTypesSource = readFileSync("apps/web/src/client/pages/projects/projectPageTypes.ts", "utf8");

assert.match(handlersSource, /\/api\/project\/studio\/context/);
assert.match(handlersSource, /\/api\/project\/studio\/mutate/);
assert.match(cliSource, /studio-context/);
assert.match(cliSource, /studio-mutate/);
assert.match(clientTypesSource, /interface StudioViewModel/);
assert.match(clientTypesSource, /studio\?: StudioViewModel/);
