import { createVisualNovelRuntime } from "./runtime";
import type {
  CharacterState,
  GameState,
  RuntimeOptions,
  Scene,
  SceneMap
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
  toast: HTMLElement;
  specialEffects?: HTMLElement | null;
}

export interface CharacterAssetMap {
  [characterName: string]: Record<string, string>;
}

export interface DomAppOptions extends RuntimeOptions {
  imageAssets: Record<string, string>;
  characterAssetMap: CharacterAssetMap;
  elements: DomElements;
  routeStageCharacter?: string;
}

function heartText(value: number, max: number): string {
  const filledCount = Math.max(0, Math.min(max, value));
  return "♥".repeat(filledCount) + "♡".repeat(max - filledCount);
}

export function createVisualNovelDomApp(options: DomAppOptions) {
  const runtime = createVisualNovelRuntime(options);
  const {
    state,
    imageAssets,
    characterAssetMap,
    elements,
    routeStageCharacter = "haru",
    affinityMax = 5
  } = options;

  function showToast(message?: string): void {
    if (!message) {
      return;
    }

    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    window.setTimeout(() => {
      elements.toast.classList.remove("visible");
    }, 1300);
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

      const button = document.createElement("button");
      const choiceText = document.createElement("span");

      button.type = "button";
      button.className = "choice-button";
      choiceText.textContent = choice.text;
      button.append(choiceText);

      if (!isUnlocked) {
        const lockedReason = document.createElement("small");
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

    elements.speakerName.textContent = runtime.resolveValue(scene.speaker);
    elements.sceneLabel.textContent = runtime.resolveValue(scene.label);
    elements.dialogueText.textContent = runtime.resolveValue(scene.text);

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

  return {
    advance,
    goTo,
    restart,
    render: renderScene,
    state,
    scenes: options.scenes as SceneMap,
    meetsCondition: runtime.meetsCondition,
    debugSnapshot: runtime.debugSnapshot
  };
}

export type VisualNovelDomApp = ReturnType<typeof createVisualNovelDomApp>;
