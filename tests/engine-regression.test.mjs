import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function loadEngineBundle() {
  const bundleCode = readFileSync("dist/visual-novel-engine.js", "utf8");
  const context = {
    console,
    setTimeout,
    clearTimeout
  };

  vm.runInNewContext(`${bundleCode}\nthis.VisualNovelEngine = VisualNovelEngine;`, context);
  return context.VisualNovelEngine;
}

function createInitialState() {
  return {
    currentSceneId: "start",
    affinity: { haru: 1 },
    route: {
      name: "COMMON",
      chapter: "TEST",
      focus: 0,
      courage: 0,
      glitch: 0,
      flags: {},
      endingReason: ""
    },
    schedule: {
      id: "",
      currentSlot: "",
      actionPoints: null,
      maxActionPoints: null,
      usedActions: []
    },
    characterRoutes: {
      haru: {
        stage: "common",
        memoryTags: {}
      }
    }
  };
}

function createMemoryWebStorage() {
  const values = new Map();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    key(index) {
      return [...values.keys()][index] || null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function createFakeElement() {
  return {
    textContent: "",
    hidden: false,
    className: "",
    src: "",
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      }
    },
    addEventListener() {},
    append() {},
    removeAttribute() {},
    replaceChildren() {},
    setAttribute() {}
  };
}

function createFakeDomElements() {
  return {
    gameShell: createFakeElement(),
    backgroundImage: createFakeElement(),
    cgImage: createFakeElement(),
    haruSprite: createFakeElement(),
    minaSprite: createFakeElement(),
    haruHearts: createFakeElement(),
    minaHearts: createFakeElement(),
    routeName: createFakeElement(),
    chapterName: createFakeElement(),
    focusValue: createFakeElement(),
    courageValue: createFakeElement(),
    glitchValue: createFakeElement(),
    speakerName: createFakeElement(),
    sceneLabel: createFakeElement(),
    dialogueText: createFakeElement(),
    choiceGrid: createFakeElement(),
    nextButton: createFakeElement(),
    restartButton: createFakeElement(),
    toast: createFakeElement()
  };
}

const VisualNovelEngine = loadEngineBundle();

assert.equal(typeof VisualNovelEngine.validateVisualNovelProject, "function");
assert.equal(typeof VisualNovelEngine.createDefaultVisualNovelPlatform, "function");
assert.equal(typeof VisualNovelEngine.createLocalStorageSaveStorage, "function");

const scenes = {
  start: {
    label: "방과 후",
    background: "classroom",
    speaker: "하루",
    text: "오늘도 같이 만들자.",
    characters: [{ name: "haru", expression: "normal", active: true }],
    choices: [
      {
        text: "고개를 끄덕인다.",
        next: "end",
        affinity: { haru: 1 }
      }
    ]
  },
  end: {
    label: "교문",
    background: "gate",
    speaker: "나",
    text: "조금 더 가까워졌다.",
    ending: true
  }
};

const validationIssues = VisualNovelEngine.validateVisualNovelProject({
  scenes: {
    ...scenes,
    broken: {
      label: "끊긴 장면",
      background: "classroom",
      speaker: "나",
      text: "다음 장면이 없다.",
      next: "missingScene"
    }
  },
  imageAssets: { classroom: "classroom.png", gate: "gate.png", haruNormal: "haru.png" },
  characterAssetMap: { haru: { normal: "haruNormal" } }
});

assert.deepEqual(
  JSON.parse(JSON.stringify(validationIssues.filter((issue) => issue.severity === "error").map((issue) => issue.field))),
  ["next"]
);

const runtime = VisualNovelEngine.createVisualNovelRuntime({
  state: createInitialState(),
  scenes
});

const startScene = runtime.getResolvedScene("start");
runtime.recordBacklogEntry("start", startScene, {
  label: "방과 후",
  speaker: "하루",
  text: "오늘도 같이 만들자."
});
runtime.recordBacklogEntry("start", startScene, {
  label: "방과 후",
  speaker: "하루",
  text: "오늘도 같이 만들자."
});

assert.equal(runtime.getBacklog().length, 1);

const saveSlot = runtime.createSaveSlot("quick", "빠른 저장");
runtime.applyChoiceEffects(startScene.choices[0]);
runtime.state.currentSceneId = "end";
runtime.recordBacklogEntry("end", runtime.getResolvedScene("end"), {
  label: "교문",
  speaker: "나",
  text: "조금 더 가까워졌다."
});

assert.equal(runtime.state.currentSceneId, "end");
assert.equal(runtime.getBacklog().length, 2);

runtime.restoreSaveSlot(saveSlot);

assert.equal(runtime.state.currentSceneId, "start");
assert.equal(runtime.state.affinity.haru, 1);
assert.equal(runtime.getBacklog().length, 1);

const deterministicRuntime = VisualNovelEngine.createVisualNovelRuntime({
  state: createInitialState(),
  scenes,
  platform: {
    now: () => 123456,
    createSaveTimestamp: () => "2040-01-02T03:04:05.000Z"
  }
});

const deterministicScene = deterministicRuntime.getResolvedScene("start");
const deterministicBacklog = deterministicRuntime.recordBacklogEntry("start", deterministicScene, {
  label: "방과 후",
  speaker: "하루",
  text: "시간도 주입된다."
});
const deterministicSaveSlot = deterministicRuntime.createSaveSlot("deterministic", "결정적 저장");

assert.equal(deterministicBacklog.createdAt, 123456);
assert.equal(deterministicSaveSlot.savedAt, "2040-01-02T03:04:05.000Z");

const localStorageAdapter = VisualNovelEngine.createLocalStorageSaveStorage({
  storageKey: "vn-test",
  storage: createMemoryWebStorage()
});

await localStorageAdapter.save(saveSlot);
assert.equal((await localStorageAdapter.load("quick")).sceneId, "start");
assert.equal((await localStorageAdapter.list()).length, 1);
await localStorageAdapter.remove("quick");
assert.equal(await localStorageAdapter.load("quick"), null);

const platformBackedStorage = createMemoryWebStorage();
const platformStorageAdapter = VisualNovelEngine.createLocalStorageSaveStorage({
  storageKey: "vn-platform-test",
  platform: {
    getStorage: () => platformBackedStorage
  }
});

await platformStorageAdapter.save(saveSlot);
assert.equal((await platformStorageAdapter.load("quick")).sceneId, "start");

const injectedSlots = new Map();
const injectedStorage = {
  async save(slot) {
    injectedSlots.set(slot.id, slot);
    return slot;
  },
  async load(slotId) {
    return injectedSlots.get(slotId) || null;
  },
  async list() {
    return [...injectedSlots.values()];
  },
  async remove(slotId) {
    injectedSlots.delete(slotId);
  }
};

const domApp = VisualNovelEngine.createVisualNovelDomApp({
  state: createInitialState(),
  scenes,
  imageAssets: { classroom: "classroom.png", gate: "gate.png", haruNormal: "haru.png" },
  characterAssetMap: { haru: { normal: "haruNormal" } },
  elements: createFakeDomElements(),
  saveStorage: injectedStorage
});

assert.equal((await domApp.save("custom", "주입 저장")).sceneId, "start");
assert.equal((await domApp.listSaves()).length, 1);
await domApp.clearSave("custom");
assert.equal((await domApp.listSaves()).length, 0);
