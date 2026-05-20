import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function loadEngineBundle() {
  const bundleCode = readFileSync("dist/visual-novel-engine.js", "utf8");
  const context = {
    console,
    window: {},
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

const VisualNovelEngine = loadEngineBundle();

assert.equal(typeof VisualNovelEngine.validateVisualNovelProject, "function");

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
