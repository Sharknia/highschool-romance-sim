import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const core = await import("../packages/engine-core/dist/index.js");
const useCasesModule = await import("../packages/use-cases/dist/index.js");

const tempRoot = await mkdtemp(join(tmpdir(), "vn-maker-use-cases-"));
const projectDirectory = join(tempRoot, "UseCase.vnmaker");
const useCases = useCasesModule.createVnMakerUseCases({
  eventText: {
    async generateEventExpansionPlan({ request }) {
      return core.createDeterministicEventExpansionPlan(request);
    }
  },
  image: {
    async generateImageAsset(input) {
      assert.equal(input.cwd, projectDirectory);
      assert.equal(input.publicPathPrefix, "/generated-assets");
      assert.equal(Boolean(input.model), false);
      return {
        job: {
          id: input.jobId || `job-${input.kind}`,
          kind: input.kind,
          targetId: input.targetId,
          prompt: input.prompt,
          style: input.style,
          provider: "image-generation-adapter",
          status: "completed",
          outputAssetId: input.outputAssetId
        },
        asset: {
          id: input.outputAssetId || `asset-${input.kind}`,
          kind: input.kind,
          label: `generated ${input.kind}`,
          uri: `${input.publicPathPrefix}/${input.outputAssetId || `asset-${input.kind}`}.png`,
          source: "generated",
          generationJobId: input.jobId || `job-${input.kind}`
        },
        image: {
          mimeType: "image/png",
          b64Json: Buffer.from("fake image").toString("base64"),
          dataUrl: `data:image/png;base64,${Buffer.from("fake image").toString("base64")}`,
          uri: `${input.publicPathPrefix}/${input.outputAssetId || `asset-${input.kind}`}.png`
        },
        raw: { item: { type: "test" } }
      };
    }
  }
});

const heroine = core.createHeroineProfile({
  id: "haru",
  name: "하루",
  description: "도서관에서 자주 만나는 학생.",
  personality: "차분하다.",
  speechStyle: "조심스럽게 말한다.",
  appearance: "단정한 교복."
});

const created = await useCases.createProjectFromHeroine({
  projectDirectory,
  heroine,
  title: "하루 Use Case",
  premise: "공통 use case 프로젝트"
});
assert.equal(created.ok, true);
assert.equal(created.projectDirectory, projectDirectory);
assert.equal(created.project.characters.length, 1);

const expanded = await useCases.expandEvent({
  projectDirectory,
  userEvent: "도서관에서 책을 줍다가 손이 겹치고 노멀 엔딩으로 끝나는 이벤트"
});
assert.equal(expanded.ok, true);
assert.equal(expanded.plan.decision.sceneCount, 3);

const approved = await useCases.approveEvent({
  projectDirectory,
  request: expanded.request,
  plan: expanded.plan
});
assert.equal(approved.ok, true);
assert.equal(approved.project.scenes.length, 5);

const plannedJob = approved.project.generationJobs.find((job) => job.kind === "cg" && job.status === "planned");
assert.equal(Boolean(plannedJob), true);
const generated = await useCases.generateImage({
  projectDirectory,
  jobId: plannedJob.id
});
assert.equal(generated.ok, true);
assert.equal(generated.job.status, "completed");
assert.equal(generated.asset.id, plannedJob.outputAssetId);

const opened = await useCases.openProject({ projectDirectory });
assert.equal(opened.ok, true);
assert.equal(opened.project.assets.some((asset) => asset.id === plannedJob.outputAssetId), true);

const invalidProject = await useCases.validateProject({
  projectDirectory,
  project: {
    version: "vn-maker/v1",
    id: "bad",
    title: "",
    premise: "",
    characters: [],
    routes: [],
    scenes: [],
    assets: [],
    generationJobs: [],
    settings: {}
  }
});
assert.equal(invalidProject.ok, false);
assert.equal(invalidProject.issues.some((issue) => issue.path === "title"), true);

assert.equal(existsSync(join(projectDirectory, "project.sqlite")), true);

await rm(tempRoot, { recursive: true, force: true });
