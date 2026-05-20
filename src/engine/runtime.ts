import type {
  BacklogEntry,
  CharacterMemoryTags,
  CharacterRouteState,
  Choice,
  Condition,
  DebugSnapshot,
  FlagSet,
  GameState,
  RuntimeOptions,
  SaveSlot,
  ScheduleConfig,
  Scene,
  SceneMap
} from "./types";

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function replaceObjectContents<T extends Record<string, unknown>>(target: T, source: T): void {
  Object.keys(target).forEach((key) => {
    delete target[key];
  });

  Object.assign(target, clonePlain(source));
}

export function createVisualNovelRuntime(options: RuntimeOptions) {
  const { state, scenes } = options;
  const affinityMax = options.affinityMax ?? 5;
  const routeStatMax = options.routeStatMax ?? 9;
  const initialState = clonePlain(state);
  let backlog: BacklogEntry[] = [];
  let lastBacklogSignature = "";

  function getBacklogSignature(entry: BacklogEntry): string {
    return [entry.sceneId, entry.speaker, entry.text].join("\u0000");
  }

  function updateLastBacklogSignature(): void {
    const lastEntry = backlog[backlog.length - 1];
    lastBacklogSignature = lastEntry ? getBacklogSignature(lastEntry) : "";
  }

  function clampAffinity(value: number): number {
    return Math.max(0, Math.min(affinityMax, value));
  }

  function clampRouteStat(value: number): number {
    return Math.max(0, Math.min(routeStatMax, value));
  }

  function normalizeFlagList(flags?: string[] | FlagSet): string[] {
    if (!flags) {
      return [];
    }

    if (Array.isArray(flags)) {
      return flags;
    }

    return Object.entries(flags)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([flagName]) => flagName);
  }

  function ensureCharacterRoute(characterName: string): CharacterRouteState {
    if (!state.characterRoutes[characterName]) {
      state.characterRoutes[characterName] = {
        stage: "common",
        memoryTags: {}
      };
    }

    return state.characterRoutes[characterName];
  }

  function normalizeCharacterTagMap(memoryTags?: CharacterMemoryTags): Record<string, string[]> {
    if (!memoryTags) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(memoryTags).map(([characterName, tags]) => [characterName, normalizeFlagList(tags)])
    );
  }

  function applyAffinityChange(change = {} as Record<string, number>): void {
    Object.entries(change).forEach(([characterName, delta]) => {
      state.affinity[characterName] = clampAffinity((state.affinity[characterName] ?? 0) + delta);
    });
  }

  function applyRouteStats(change = {} as Record<string, number>): void {
    Object.entries(change).forEach(([statName, delta]) => {
      if (typeof state.route[statName] !== "number") {
        return;
      }

      state.route[statName] = clampRouteStat((state.route[statName] as number) + delta);
    });
  }

  function setRouteFlags(flags?: string[] | FlagSet): void {
    normalizeFlagList(flags).forEach((flagName) => {
      state.route.flags[flagName] = true;
    });
  }

  function clearRouteFlags(flags?: string[] | FlagSet): void {
    normalizeFlagList(flags).forEach((flagName) => {
      delete state.route.flags[flagName];
    });
  }

  function applyRouteProgress(routeStages = {} as Record<string, string>): void {
    Object.entries(routeStages).forEach(([characterName, stage]) => {
      ensureCharacterRoute(characterName).stage = stage;
    });
  }

  function applyMemoryTags(memoryTags?: CharacterMemoryTags): void {
    Object.entries(normalizeCharacterTagMap(memoryTags)).forEach(([characterName, tags]) => {
      const characterRoute = ensureCharacterRoute(characterName);

      tags.forEach((tagName) => {
        characterRoute.memoryTags[tagName] = true;
      });
    });
  }

  function clearMemoryTags(memoryTags?: CharacterMemoryTags): void {
    Object.entries(normalizeCharacterTagMap(memoryTags)).forEach(([characterName, tags]) => {
      const characterRoute = ensureCharacterRoute(characterName);

      tags.forEach((tagName) => {
        delete characterRoute.memoryTags[tagName];
      });
    });
  }

  function hasMemoryTag(characterName: string, tagName: string): boolean {
    return Boolean(ensureCharacterRoute(characterName).memoryTags[tagName]);
  }

  function startSchedule(schedule: ScheduleConfig = {}): void {
    if (!schedule.id) {
      return;
    }

    const isNewSchedule = state.schedule.id !== schedule.id || schedule.reset === true;
    state.schedule.id = schedule.id;
    state.schedule.currentSlot = schedule.slot || state.schedule.currentSlot;

    if (isNewSchedule) {
      state.schedule.actionPoints = Number.isInteger(schedule.actionPoints) ? schedule.actionPoints ?? null : null;
      state.schedule.maxActionPoints = Number.isInteger(schedule.actionPoints) ? schedule.actionPoints ?? null : null;
      state.schedule.usedActions = [];
    }
  }

  function applyScheduleEffects(scheduleEffects: ScheduleConfig = {}): void {
    if (scheduleEffects.id || scheduleEffects.slot || Number.isInteger(scheduleEffects.actionPoints)) {
      startSchedule({
        id: scheduleEffects.id || state.schedule.id,
        slot: scheduleEffects.slot || state.schedule.currentSlot,
        actionPoints: Number.isInteger(scheduleEffects.actionPoints)
          ? scheduleEffects.actionPoints
          : state.schedule.actionPoints ?? undefined,
        reset: scheduleEffects.reset
      });
    }

    if (scheduleEffects.slot) {
      state.schedule.currentSlot = scheduleEffects.slot;
    }

    const actionPointCost = scheduleEffects.actionPointCost || 0;

    if (actionPointCost > 0 && typeof state.schedule.actionPoints === "number") {
      state.schedule.actionPoints = Math.max(0, state.schedule.actionPoints - actionPointCost);
    }

    if (scheduleEffects.markAction && !state.schedule.usedActions.includes(scheduleEffects.markAction)) {
      state.schedule.usedActions.push(scheduleEffects.markAction);
    }
  }

  function applyChoiceEffects(choice: Choice): void {
    const effects = choice.effects || {};

    applyAffinityChange(choice.affinity);
    applyRouteStats(choice.stats);
    applyAffinityChange(effects.affinity);
    applyRouteStats(effects.stats);
    setRouteFlags(choice.flags);
    setRouteFlags(effects.flags || effects.setFlags);
    clearRouteFlags(choice.clearFlags);
    clearRouteFlags(effects.clearFlags);
    applyRouteProgress(choice.routeStages || effects.routeStages);
    applyMemoryTags(choice.memoryTags || effects.memoryTags);
    clearMemoryTags(choice.clearMemoryTags || effects.clearMemoryTags);
    applyScheduleEffects({
      actionPointCost: choice.actionPointCost,
      markAction: choice.scheduleAction,
      ...effects.schedule
    });

    if (effects.endingReason) {
      state.route.endingReason = effects.endingReason;
    }
  }

  function meetsStatCondition(statRequirements = {} as Record<string, number>, comparator: (current: number, required: number) => boolean): boolean {
    return Object.entries(statRequirements).every(([statName, requiredValue]) => {
      const currentValue = state.route[statName];

      if (typeof currentValue !== "number") {
        return false;
      }

      return comparator(currentValue, requiredValue);
    });
  }

  function meetsAffinityCondition(affinityRequirements = {} as Record<string, number>, comparator: (current: number, required: number) => boolean): boolean {
    return Object.entries(affinityRequirements).every(([characterName, requiredValue]) => {
      const currentValue = state.affinity[characterName];

      if (typeof currentValue !== "number") {
        return false;
      }

      return comparator(currentValue, requiredValue);
    });
  }

  function meetsCharacterStageCondition(stageRequirements = {} as Record<string, string>): boolean {
    return Object.entries(stageRequirements).every(([characterName, requiredStage]) => {
      return ensureCharacterRoute(characterName).stage === requiredStage;
    });
  }

  function meetsMemoryTagCondition(memoryTagRequirements?: CharacterMemoryTags): boolean {
    return Object.entries(normalizeCharacterTagMap(memoryTagRequirements)).every(([characterName, tags]) => {
      return tags.every((tagName) => hasMemoryTag(characterName, tagName));
    });
  }

  function meetsAnyMemoryTagCondition(memoryTagRequirements?: CharacterMemoryTags): boolean {
    return Object.entries(normalizeCharacterTagMap(memoryTagRequirements)).some(([characterName, tags]) => {
      return tags.some((tagName) => hasMemoryTag(characterName, tagName));
    });
  }

  function meetsNoMemoryTagCondition(memoryTagRequirements?: CharacterMemoryTags): boolean {
    return Object.entries(normalizeCharacterTagMap(memoryTagRequirements)).every(([characterName, tags]) => {
      return tags.every((tagName) => !hasMemoryTag(characterName, tagName));
    });
  }

  function meetsCondition(condition?: Condition): boolean {
    if (!condition) {
      return true;
    }

    if (condition.all && !condition.all.every(meetsCondition)) {
      return false;
    }

    if (condition.any && !condition.any.some(meetsCondition)) {
      return false;
    }

    if (condition.none && condition.none.some(meetsCondition)) {
      return false;
    }

    if (condition.flags && !normalizeFlagList(condition.flags).every((flagName) => state.route.flags[flagName])) {
      return false;
    }

    if (condition.anyFlags && !normalizeFlagList(condition.anyFlags).some((flagName) => state.route.flags[flagName])) {
      return false;
    }

    if (condition.notFlags && normalizeFlagList(condition.notFlags).some((flagName) => state.route.flags[flagName])) {
      return false;
    }

    if (condition.minStats && !meetsStatCondition(condition.minStats, (current, required) => current >= required)) {
      return false;
    }

    if (condition.maxStats && !meetsStatCondition(condition.maxStats, (current, required) => current <= required)) {
      return false;
    }

    if (condition.minAffinity && !meetsAffinityCondition(condition.minAffinity, (current, required) => current >= required)) {
      return false;
    }

    if (condition.maxAffinity && !meetsAffinityCondition(condition.maxAffinity, (current, required) => current <= required)) {
      return false;
    }

    if (condition.routeStages && !meetsCharacterStageCondition(condition.routeStages)) {
      return false;
    }

    if (condition.memoryTags && !meetsMemoryTagCondition(condition.memoryTags)) {
      return false;
    }

    if (condition.anyMemoryTags && !meetsAnyMemoryTagCondition(condition.anyMemoryTags)) {
      return false;
    }

    if (condition.notMemoryTags && !meetsNoMemoryTagCondition(condition.notMemoryTags)) {
      return false;
    }

    const minActionPoints = condition.minActionPoints;
    const maxActionPoints = condition.maxActionPoints;

    if (
      Number.isInteger(minActionPoints) &&
      (typeof state.schedule.actionPoints !== "number" || state.schedule.actionPoints < minActionPoints!)
    ) {
      return false;
    }

    if (
      Number.isInteger(maxActionPoints) &&
      (typeof state.schedule.actionPoints !== "number" || state.schedule.actionPoints > maxActionPoints!)
    ) {
      return false;
    }

    if (condition.usedActions && !normalizeFlagList(condition.usedActions).every((actionName) => state.schedule.usedActions.includes(actionName))) {
      return false;
    }

    if (condition.notUsedActions && normalizeFlagList(condition.notUsedActions).some((actionName) => state.schedule.usedActions.includes(actionName))) {
      return false;
    }

    if (condition.timeSlot && state.schedule.currentSlot !== condition.timeSlot) {
      return false;
    }

    return true;
  }

  function resolveValue<T>(value: T | ((runtimeState: GameState) => T)): T {
    if (typeof value === "function") {
      return (value as (runtimeState: GameState) => T)(state);
    }

    return value;
  }

  function resolveSceneVariant(scene: Scene): Scene {
    const matchedVariant = (scene.variants || []).find((variant) => meetsCondition(variant.when));

    if (!matchedVariant) {
      return scene;
    }

    const { when, ...variantSceneData } = matchedVariant;
    return {
      ...scene,
      ...variantSceneData,
      variants: scene.variants
    };
  }

  function getResolvedScene(sceneId: string): Scene {
    const scene = scenes[sceneId];

    if (!scene) {
      throw new Error(`존재하지 않는 장면입니다: ${sceneId}`);
    }

    return resolveSceneVariant(scene);
  }

  function applySceneHud(scene: Scene): void {
    if (!scene.hud) {
      return;
    }

    state.route.name = scene.hud.name || state.route.name;
    state.route.chapter = scene.hud.chapter || state.route.chapter;
  }

  function applySceneMetadata(scene: Scene): void {
    if (scene.schedule) {
      startSchedule(scene.schedule);
    } else if (scene.timeSlot) {
      state.schedule.currentSlot = scene.timeSlot;
    }

    applyRouteProgress(scene.routeStages);
    applyMemoryTags(scene.memoryTags);
  }

  function applySceneUnlocks(scene: Scene): string[] {
    const unlocks = normalizeFlagList(scene.unlocks);

    if (unlocks.length === 0) {
      return [];
    }

    const newlyUnlockedFlags = unlocks.filter((flagName) => !state.route.flags[flagName]);
    setRouteFlags(unlocks);
    return newlyUnlockedFlags;
  }

  function getNextSceneId(scene: Scene): string | undefined {
    return scene.next ? resolveValue(scene.next) : undefined;
  }

  function resetState(): void {
    replaceObjectContents(state as unknown as Record<string, unknown>, initialState as unknown as Record<string, unknown>);
    clearBacklog();
  }

  function debugSnapshot(): DebugSnapshot {
    return clonePlain({
      currentSceneId: state.currentSceneId,
      affinity: state.affinity,
      route: state.route,
      schedule: state.schedule,
      characterRoutes: state.characterRoutes
    });
  }

  function recordBacklogEntry(
    sceneId: string,
    scene: Scene,
    renderedLine?: Partial<Pick<BacklogEntry, "label" | "speaker" | "text">>
  ): BacklogEntry | null {
    const text = renderedLine?.text ?? resolveValue(scene.text);

    if (!String(text).trim()) {
      return null;
    }

    const entry: BacklogEntry = {
      sceneId,
      label: renderedLine?.label ?? resolveValue(scene.label),
      speaker: renderedLine?.speaker ?? resolveValue(scene.speaker),
      text,
      characterNames: (scene.characters || []).map((character) => character.name),
      createdAt: Date.now()
    };
    const signature = getBacklogSignature(entry);

    // 같은 장면을 다시 렌더링할 때 같은 대사가 중복 저장되지 않게 막는다.
    if (signature === lastBacklogSignature) {
      return null;
    }

    backlog.push(entry);
    backlog = backlog.slice(-200);
    lastBacklogSignature = signature;

    return clonePlain(entry);
  }

  function getBacklog(): BacklogEntry[] {
    return clonePlain(backlog);
  }

  function clearBacklog(): void {
    backlog = [];
    lastBacklogSignature = "";
  }

  function createSaveSlot(id = "quick", label = "빠른 저장"): SaveSlot {
    return {
      id,
      label,
      savedAt: new Date().toISOString(),
      sceneId: state.currentSceneId,
      state: clonePlain(state),
      backlog: getBacklog()
    };
  }

  function restoreSaveSlot(saveSlot: SaveSlot): void {
    if (!saveSlot || !saveSlot.state || !saveSlot.sceneId) {
      throw new Error("유효하지 않은 저장 슬롯입니다.");
    }

    replaceObjectContents(state as unknown as Record<string, unknown>, saveSlot.state as unknown as Record<string, unknown>);
    backlog = clonePlain(saveSlot.backlog || []);
    updateLastBacklogSignature();
  }

  return {
    state,
    scenes: scenes as SceneMap,
    applyChoiceEffects,
    applySceneHud,
    applySceneMetadata,
    applySceneUnlocks,
    clearBacklog,
    createSaveSlot,
    ensureCharacterRoute,
    getNextSceneId,
    getBacklog,
    getResolvedScene,
    meetsCondition,
    recordBacklogEntry,
    resetState,
    restoreSaveSlot,
    resolveValue,
    debugSnapshot
  };
}
