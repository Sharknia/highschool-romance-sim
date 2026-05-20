import type {
  CharacterState,
  Choice,
  Resolvable,
  Scene,
  SceneMap,
  SceneValidationIssue,
  SceneVariant,
  VisualNovelProjectDefinition
} from "./types";

function isStaticSceneTarget(value: Resolvable<string> | undefined): value is string {
  return typeof value === "string";
}

function addIssue(
  issues: SceneValidationIssue[],
  severity: SceneValidationIssue["severity"],
  sceneId: string,
  field: string,
  message: string
): void {
  issues.push({ severity, sceneId, field, message });
}

function validateSceneTarget(
  issues: SceneValidationIssue[],
  sceneIds: Set<string>,
  sceneId: string,
  field: string,
  target: Resolvable<string> | undefined
): void {
  if (isStaticSceneTarget(target) && !sceneIds.has(target)) {
    addIssue(issues, "error", sceneId, field, `존재하지 않는 장면을 가리킵니다: ${target}`);
  }
}

function validateImageAsset(
  issues: SceneValidationIssue[],
  sceneId: string,
  field: string,
  imageKey: string | undefined,
  imageAssets?: Record<string, string>
): void {
  if (!imageAssets || !imageKey) {
    return;
  }

  if (!imageAssets[imageKey]) {
    addIssue(issues, "error", sceneId, field, `등록되지 않은 이미지 키입니다: ${imageKey}`);
  }
}

function validateCharacterAssets(
  issues: SceneValidationIssue[],
  sceneId: string,
  characters: CharacterState[] | undefined,
  project: VisualNovelProjectDefinition,
  fieldPrefix: string
): void {
  if (!characters || !project.characterAssetMap) {
    return;
  }

  characters.forEach((character, index) => {
    const assetMap = project.characterAssetMap?.[character.name];
    const expression = character.expression || "normal";

    if (!assetMap) {
      addIssue(issues, "error", sceneId, `${fieldPrefix}.${index}.name`, `캐릭터 에셋 맵이 없습니다: ${character.name}`);
      return;
    }

    const assetKey = assetMap[expression] || assetMap.normal;

    if (!assetKey) {
      addIssue(
        issues,
        "error",
        sceneId,
        `${fieldPrefix}.${index}.expression`,
        `캐릭터 표정 에셋이 없습니다: ${character.name}.${expression}`
      );
      return;
    }

    validateImageAsset(issues, sceneId, `${fieldPrefix}.${index}.expression`, assetKey, project.imageAssets);
  });
}

function validateChoice(
  issues: SceneValidationIssue[],
  sceneIds: Set<string>,
  sceneId: string,
  choice: Choice,
  index: number,
  fieldPrefix = "choices"
): void {
  validateSceneTarget(issues, sceneIds, sceneId, `${fieldPrefix}.${index}.next`, choice.next);

  if (choice.requires && !choice.hideWhenLocked && !choice.lockedReason) {
    addIssue(
      issues,
      "warning",
      sceneId,
      `${fieldPrefix}.${index}.lockedReason`,
      "잠긴 선택지에 표시할 lockedReason이 없습니다."
    );
  }
}

function validateVariant(
  issues: SceneValidationIssue[],
  sceneIds: Set<string>,
  sceneId: string,
  variant: SceneVariant,
  index: number,
  project: VisualNovelProjectDefinition
): void {
  validateSceneTarget(issues, sceneIds, sceneId, `variants.${index}.next`, variant.next);
  validateImageAsset(issues, sceneId, `variants.${index}.background`, variant.background, project.imageAssets);
  validateImageAsset(issues, sceneId, `variants.${index}.cg`, variant.cg, project.imageAssets);
  validateCharacterAssets(issues, sceneId, variant.characters, project, `variants.${index}.characters`);

  (variant.choices || []).forEach((choice, choiceIndex) => {
    validateChoice(issues, sceneIds, sceneId, choice, choiceIndex, `variants.${index}.choices`);
  });
}

function validateScene(
  issues: SceneValidationIssue[],
  sceneIds: Set<string>,
  sceneId: string,
  scene: Scene,
  project: VisualNovelProjectDefinition
): void {
  validateSceneTarget(issues, sceneIds, sceneId, "next", scene.next);
  validateImageAsset(issues, sceneId, "background", scene.background, project.imageAssets);
  validateImageAsset(issues, sceneId, "cg", scene.cg, project.imageAssets);
  validateCharacterAssets(issues, sceneId, scene.characters, project, "characters");

  (scene.choices || []).forEach((choice, index) => {
    validateChoice(issues, sceneIds, sceneId, choice, index);
  });

  (scene.variants || []).forEach((variant, index) => {
    validateVariant(issues, sceneIds, sceneId, variant, index, project);
  });
}

export function validateVisualNovelProject(project: VisualNovelProjectDefinition): SceneValidationIssue[] {
  const issues: SceneValidationIssue[] = [];
  const scenes: SceneMap = project.scenes;
  const sceneIds = new Set(Object.keys(scenes));

  Object.entries(scenes).forEach(([sceneId, scene]) => {
    validateScene(issues, sceneIds, sceneId, scene, project);
  });

  return issues;
}
