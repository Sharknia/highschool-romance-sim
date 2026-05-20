import { createVisualNovelRuntime } from "./runtime";
import { createDefaultVisualNovelPlatform } from "./platform";
import { createLocalStorageSaveStorage } from "./storage";
import { validateVisualNovelProject } from "./validator";
import type {
  BacklogEntry,
  CharacterAssetMap,
  CharacterState,
  RuntimeOptions,
  SaveSlot,
  Scene,
  SceneValidationIssue,
  SceneMap,
  VisualNovelSaveStorage
} from "./types";

export interface DomElements {
  gameShell: HTMLElement;
  backgroundImage: HTMLImageElement;
  cgImage: HTMLImageElement;
  haruSprite: HTMLImageElement;
  minaSprite: HTMLImageElement;
  haruHearts: HTMLElement;
  minaHearts: HTMLElement;
  routeName: HTMLElement;
  chapterName: HTMLElement;
  scheduleSlotValue?: HTMLElement | null;
  actionPointValue?: HTMLElement | null;
  routeStageValue?: HTMLElement | null;
  focusValue: HTMLElement;
  courageValue: HTMLElement;
  glitchValue: HTMLElement;
  speakerName: HTMLElement;
  sceneLabel: HTMLElement;
  dialogueText: HTMLElement;
  choiceGrid: HTMLElement;
  nextButton: HTMLButtonElement;
  restartButton: HTMLButtonElement;
  backlogButton?: HTMLButtonElement | null;
  saveButton?: HTMLButtonElement | null;
  loadButton?: HTMLButtonElement | null;
  toast: HTMLElement;
  specialEffects?: HTMLElement | null;
  engineModal?: HTMLElement | null;
  engineModalTitle?: HTMLElement | null;
  engineModalBody?: HTMLElement | null;
  engineModalClose?: HTMLButtonElement | null;
}

export interface DomAppOptions extends RuntimeOptions {
  imageAssets: Record<string, string>;
  characterAssetMap: CharacterAssetMap;
  elements: DomElements;
  routeStageCharacter?: string;
  saveStorage?: VisualNovelSaveStorage;
  saveStorageKey?: string;
  quickSaveSlotId?: string;
  validateOnStart?: boolean;
}

function heartText(value: number, max: number): string {
  const filledCount = Math.max(0, Math.min(max, value));
  return "♥".repeat(filledCount) + "♡".repeat(max - filledCount);
}

export function createVisualNovelDomApp(options: DomAppOptions) {
  const platform = createDefaultVisualNovelPlatform(options.platform);
  const runtime = createVisualNovelRuntime({ ...options, platform });
  const {
    state,
    imageAssets,
    characterAssetMap,
    elements,
    routeStageCharacter = "haru",
    affinityMax = 5
  } = options;
  const quickSaveSlotId = options.quickSaveSlotId || "quick";
  const saveStorage = options.saveStorage || (options.saveStorageKey
    ? createLocalStorageSaveStorage({ storageKey: options.saveStorageKey, platform })
    : null);

  function showToast(message?: string): void {
    if (!message) {
      return;
    }

    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    platform.setTimeout(() => {
      elements.toast.classList.remove("visible");
    }, 1300);
  }

  function validate(): SceneValidationIssue[] {
    return validateVisualNovelProject({
      scenes: options.scenes,
      imageAssets,
      characterAssetMap
    });
  }

  function reportValidationIssues(issues: SceneValidationIssue[]): void {
    issues.forEach((issue) => {
      const logMessage = `[VN validation:${issue.severity}] ${issue.sceneId}.${issue.field} - ${issue.message}`;
      if (issue.severity === "error") {
        platform.logger.error(logMessage);
      } else {
        platform.logger.warn(logMessage);
      }
    });
  }

  function hasSaveStorage(): boolean {
    return Boolean(saveStorage);
  }

  async function save(slotId = quickSaveSlotId, label = "빠른 저장", silent = false): Promise<SaveSlot | null> {
    if (!hasSaveStorage()) {
      showToast("저장소를 사용할 수 없습니다.");
      return null;
    }

    const saveSlot = runtime.createSaveSlot(slotId, label);

    try {
      const storedSaveSlot = await saveStorage!.save(saveSlot);
      if (!silent) {
        showToast("진행 상황을 저장했다.");
      }
      return storedSaveSlot;
    } catch (error) {
      platform.logger.error("VN save failed", error);
      showToast("저장에 실패했다.");
      return null;
    }
  }

  async function listSaves(): Promise<SaveSlot[]> {
    if (!hasSaveStorage()) {
      return [];
    }

    try {
      return await saveStorage!.list();
    } catch (error) {
      platform.logger.error("VN save list failed", error);
      return [];
    }
  }

  async function load(slotId = quickSaveSlotId): Promise<SaveSlot | null> {
    if (!hasSaveStorage()) {
      showToast("저장소를 사용할 수 없습니다.");
      return null;
    }

    let saveSlot: SaveSlot | null = null;

    try {
      saveSlot = await saveStorage!.load(slotId);
    } catch (error) {
      platform.logger.error("VN load failed", error);
      showToast("불러오기에 실패했다.");
      return null;
    }

    if (!saveSlot) {
      showToast("불러올 저장이 없습니다.");
      return null;
    }

    try {
      runtime.restoreSaveSlot(saveSlot);
      renderScene();
      showToast("저장 지점으로 돌아왔다.");
      return saveSlot;
    } catch (error) {
      platform.logger.error("VN load failed", error);
      showToast("불러오기에 실패했다.");
      return null;
    }
  }

  async function clearSave(slotId = quickSaveSlotId): Promise<void> {
    if (!hasSaveStorage()) {
      return;
    }

    try {
      await saveStorage!.remove(slotId);
    } catch (error) {
      platform.logger.error("VN save remove failed", error);
    }
  }

  function closeModal(): void {
    if (elements.engineModal) {
      elements.engineModal.hidden = true;
    }
  }

  function openModal(title: string, body: HTMLElement): void {
    if (!elements.engineModal || !elements.engineModalTitle || !elements.engineModalBody) {
      platform.alert(`${title}\n\n${body.textContent || ""}`);
      return;
    }

    elements.engineModalTitle.textContent = title;
    elements.engineModalBody.replaceChildren(body);
    elements.engineModal.hidden = false;
  }

  function createDomElement<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K] {
    const element = platform.createElement?.(tagName);

    if (!element) {
      throw new Error("DOM 요소 생성 팩토리가 없습니다.");
    }

    return element as HTMLElementTagNameMap[K];
  }

  function createBacklogBody(entries: BacklogEntry[]): HTMLElement {
    const wrapper = createDomElement("div");
    wrapper.className = "backlog-list";

    if (entries.length === 0) {
      const emptyMessage = createDomElement("p");
      emptyMessage.className = "backlog-empty";
      emptyMessage.textContent = "아직 기록된 대사가 없습니다.";
      wrapper.append(emptyMessage);
      return wrapper;
    }

    entries.slice(-40).reverse().forEach((entry) => {
      const item = createDomElement("article");
      const meta = createDomElement("strong");
      const text = createDomElement("p");

      item.className = "backlog-item";
      meta.textContent = `${entry.label} · ${entry.speaker}`;
      text.textContent = entry.text;
      item.append(meta, text);
      wrapper.append(item);
    });

    return wrapper;
  }

  function showBacklog(): void {
    openModal("백로그", createBacklogBody(runtime.getBacklog()));
  }

  function getCharacterAsset(characterState: CharacterState): string {
    const characterAssets = characterAssetMap[characterState.name];
    const expression = characterState.expression || "normal";

    if (!characterAssets) {
      return "";
    }

    return imageAssets[characterAssets[expression] || characterAssets.normal];
  }

  function updateCharacter(sprite: HTMLImageElement, characterState?: CharacterState): void {
    sprite.className = "character";

    if (!characterState) {
      return;
    }

    sprite.src = getCharacterAsset(characterState);
    sprite.classList.add(characterState.position || "center", "visible");

    if (!characterState.active) {
      sprite.classList.add("dimmed");
    }
  }

  function renderCharacters(characterStates: CharacterState[] = []): void {
    const haruState = characterStates.find((character) => character.name === "haru");
    const minaState = characterStates.find((character) => character.name === "mina");

    updateCharacter(elements.haruSprite, haruState);
    updateCharacter(elements.minaSprite, minaState);
  }

  function renderEffects(scene: Scene): void {
    if (scene.cg) {
      elements.cgImage.src = imageAssets[scene.cg];
    } else {
      elements.cgImage.removeAttribute("src");
    }

    elements.gameShell.classList.toggle("cg-mode", Boolean(scene.cg));
    elements.gameShell.classList.toggle("effect-kiss", scene.effect === "kiss");
    elements.gameShell.classList.toggle("effect-spark", scene.effect === "spark");
  }

  function renderChoices(scene: Scene): void {
    elements.choiceGrid.innerHTML = "";

    if (!scene.choices) {
      elements.choiceGrid.hidden = true;
      elements.nextButton.hidden = Boolean(scene.ending);
      elements.nextButton.textContent = scene.cg ? "계속" : "다음";
      return;
    }

    elements.choiceGrid.hidden = false;
    elements.nextButton.hidden = true;

    scene.choices.forEach((choice) => {
      const hasEnoughActionPoints = !choice.actionPointCost ||
        typeof state.schedule.actionPoints !== "number" ||
        state.schedule.actionPoints >= choice.actionPointCost;
      const isUnlocked = runtime.meetsCondition(choice.requires) && hasEnoughActionPoints;

      if (!isUnlocked && choice.hideWhenLocked) {
        return;
      }

      const button = createDomElement("button");
      const choiceText = createDomElement("span");

      button.type = "button";
      button.className = "choice-button";
      choiceText.textContent = choice.text;
      button.append(choiceText);

      if (!isUnlocked) {
        const lockedReason = createDomElement("small");
        lockedReason.className = "choice-lock";
        lockedReason.textContent = !hasEnoughActionPoints
          ? "행동 포인트가 부족하다."
          : choice.lockedReason || "조건 미충족";
        button.classList.add("locked");
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
        button.append(lockedReason);
      } else {
        button.addEventListener("click", () => {
          runtime.applyChoiceEffects(choice);
          showToast(choice.effects?.toast || choice.toast);
          goTo(runtime.resolveValue(choice.next));
        });
      }

      elements.choiceGrid.append(button);
    });
  }

  function renderAffinity(): void {
    elements.haruHearts.textContent = heartText(state.affinity.haru, affinityMax);
    elements.minaHearts.textContent = heartText(state.affinity.mina, affinityMax);
  }

  function renderRouteHud(): void {
    elements.routeName.textContent = state.route.name;
    elements.chapterName.textContent = state.route.chapter;
    elements.scheduleSlotValue && (elements.scheduleSlotValue.textContent = state.schedule.currentSlot || "-");
    elements.actionPointValue && (elements.actionPointValue.textContent = typeof state.schedule.actionPoints === "number"
      ? `${state.schedule.actionPoints}/${state.schedule.maxActionPoints ?? state.schedule.actionPoints}`
      : "-");
    elements.routeStageValue && (elements.routeStageValue.textContent = runtime.ensureCharacterRoute(routeStageCharacter).stage.toUpperCase());
    elements.focusValue.textContent = String(state.route.focus);
    elements.courageValue.textContent = String(state.route.courage);
    elements.glitchValue.textContent = String(state.route.glitch);
  }

  function renderScene(): void {
    const scene = runtime.getResolvedScene(state.currentSceneId);

    runtime.applySceneHud(scene);
    runtime.applySceneMetadata(scene);
    elements.backgroundImage.src = imageAssets[scene.background];

    const newlyUnlockedFlags = runtime.applySceneUnlocks(scene);
    if (newlyUnlockedFlags.length > 0) {
      showToast(scene.unlockToast || "새 장면 플래그가 해금됐다.");
    }

    const speaker = runtime.resolveValue(scene.speaker);
    const label = runtime.resolveValue(scene.label);
    const text = runtime.resolveValue(scene.text);

    elements.speakerName.textContent = speaker;
    elements.sceneLabel.textContent = label;
    elements.dialogueText.textContent = text;
    runtime.recordBacklogEntry(state.currentSceneId, scene, { label, speaker, text });

    renderEffects(scene);
    renderCharacters(scene.characters);
    renderChoices(scene);
    renderAffinity();
    renderRouteHud();
  }

  function goTo(sceneId: string): void {
    state.currentSceneId = sceneId;
    renderScene();
  }

  function advance(): void {
    const scene = runtime.getResolvedScene(state.currentSceneId);
    const nextSceneId = runtime.getNextSceneId(scene);

    if (nextSceneId) {
      goTo(nextSceneId);
    }
  }

  function restart(): void {
    runtime.resetState();
    renderScene();
    showToast("처음 장면으로 돌아왔다.");
  }

  if (options.validateOnStart) {
    reportValidationIssues(validate());
  }

  elements.backlogButton?.addEventListener("click", showBacklog);
  elements.saveButton?.addEventListener("click", () => {
    void save();
  });
  elements.loadButton?.addEventListener("click", () => {
    void load();
  });
  elements.engineModalClose?.addEventListener("click", closeModal);
  elements.engineModal?.addEventListener("click", (event) => {
    if (event.target === elements.engineModal) {
      closeModal();
    }
  });

  return {
    advance,
    clearSave,
    goTo,
    getBacklog: runtime.getBacklog,
    listSaves,
    load,
    restart,
    render: renderScene,
    save,
    state,
    scenes: options.scenes as SceneMap,
    meetsCondition: runtime.meetsCondition,
    validate,
    debugSnapshot: runtime.debugSnapshot
  };
}

export type VisualNovelDomApp = ReturnType<typeof createVisualNovelDomApp>;
