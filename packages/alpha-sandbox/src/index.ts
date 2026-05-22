import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createDeterministicEventExpansionPlan,
  createHeroineProfile,
  createImageGenerationJob,
  type EventExpansionPlan,
  type HeroineProfile,
  type VnMakerAsset,
  type VnMakerGenerationJob
} from "@vn-maker/engine-core";
import type {
  EventTextGenerationAdapter,
  ProjectImageGenerationAdapter,
  ProjectImageGenerationInput,
  ProjectImageGenerationResult
} from "@vn-maker/use-cases";

export const ALPHA_SANDBOX_PACK_ID = "alpha-sandbox-pack";
export const ALPHA_SANDBOX_PACK_VERSION = "0.1.0";
export const ALPHA_SANDBOX_PROVENANCE = `${ALPHA_SANDBOX_PACK_ID}@${ALPHA_SANDBOX_PACK_VERSION}`;

const sandboxPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

export interface AlphaSandboxSession {
  connected: true;
  mode: "alpha-sandbox";
  account: null;
  requiresOpenaiAuth: false;
  capabilities: {
    imageGeneration: true;
    namespaceTools: false;
    webSearch: false;
  };
  sandbox: {
    enabled: true;
    provenance: typeof ALPHA_SANDBOX_PROVENANCE;
  };
}

export interface AlphaSandboxPack {
  id: typeof ALPHA_SANDBOX_PACK_ID;
  version: typeof ALPHA_SANDBOX_PACK_VERSION;
  provenance: typeof ALPHA_SANDBOX_PROVENANCE;
  heroine: HeroineProfile;
  assets: VnMakerAsset[];
  fixtureJob: VnMakerGenerationJob;
}

function normalizePathPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "fixture";
}

function publicAssetUri(prefix: string, fileName: string, fallback: string): string {
  if (!prefix.trim()) {
    return fallback;
  }
  return `${prefix.replace(/\/+$/g, "")}/${fileName}`;
}

function withAlphaSandboxTerminalEnding(plan: EventExpansionPlan, heroineName: string): EventExpansionPlan {
  const sceneIdsWithAddedChoices = new Set(
    plan.patch.operations.filter((operation) => operation.type === "addChoice").map((operation) => operation.sceneId)
  );

  return {
    ...plan,
    patch: {
      operations: plan.patch.operations.map((operation) => {
        if (operation.type !== "addScene") {
          return operation;
        }

        const scene = operation.scene;
        const hasOutgoing = Boolean(scene.next) || scene.choices.length > 0 || sceneIdsWithAddedChoices.has(scene.id);
        if (scene.ending || hasOutgoing) {
          return operation;
        }

        return {
          ...operation,
          scene: {
            ...scene,
            ending: {
              id: `ending-${normalizePathPart(scene.id)}`,
              title: `${heroineName}와의 작은 비밀`,
              kind: "normal"
            }
          }
        };
      })
    }
  };
}

export function createAlphaSandboxHeroine(): HeroineProfile {
  return createHeroineProfile({
    id: "alpha-sandbox-haru",
    name: "하루",
    description: "알파 샌드박스에서 재사용하는 조용한 도서관 히로인.",
    personality: "차분하고 배려심이 많지만 예상 밖의 순간에는 당황한 마음이 얼굴에 드러난다.",
    speechStyle: "짧고 조심스럽게 말하며, 가까운 사람에게는 부드럽게 농담한다.",
    appearance: "단정한 교복, 어깨까지 오는 검은 머리, 연한 분홍색 머리핀.",
    defaultPortraitAssetId: "asset-alpha-sandbox-haru-portrait",
    expressionAssetIds: {
      happy: "asset-alpha-sandbox-haru-expression-happy",
      shy: "asset-alpha-sandbox-haru-expression-shy"
    },
    tags: ["alpha-sandbox", "library", "romantic-comedy"]
  });
}

export function createAlphaSandboxPack(): AlphaSandboxPack {
  const heroine = createAlphaSandboxHeroine();
  const cgAssetId = "asset-alpha-sandbox-library-cg";
  const cgJobId = "job-alpha-sandbox-library-cg";

  return {
    id: ALPHA_SANDBOX_PACK_ID,
    version: ALPHA_SANDBOX_PACK_VERSION,
    provenance: ALPHA_SANDBOX_PROVENANCE,
    heroine,
    assets: [
      {
        id: "asset-alpha-sandbox-library-bg",
        kind: "background",
        label: "알파 샌드박스 도서관 배경",
        source: "generated"
      },
      {
        id: heroine.defaultPortraitAssetId!,
        kind: "portrait",
        label: "하루 샌드박스 기본 포트레이트",
        source: "generated"
      },
      {
        id: heroine.expressionAssetIds.happy,
        kind: "expression",
        label: "하루 샌드박스 happy 표정",
        source: "generated"
      },
      {
        id: heroine.expressionAssetIds.shy,
        kind: "expression",
        label: "하루 샌드박스 shy 표정",
        source: "generated"
      },
      {
        id: cgAssetId,
        kind: "cg",
        label: "하루 샌드박스 도서관 CG",
        source: "generated",
        generationJobId: cgJobId
      }
    ],
    fixtureJob: {
      id: cgJobId,
      kind: "cg",
      targetId: "scene-alpha-sandbox-library-cg",
      prompt: "alpha sandbox library romantic comedy cg fixture",
      style: "deterministic alpha sandbox fixture",
      provider: "mock-adapter",
      status: "completed",
      outputAssetId: cgAssetId
    }
  };
}

export function createAlphaSandboxSession(): AlphaSandboxSession {
  return {
    connected: true,
    mode: "alpha-sandbox",
    account: null,
    requiresOpenaiAuth: false,
    capabilities: {
      imageGeneration: true,
      namespaceTools: false,
      webSearch: false
    },
    sandbox: {
      enabled: true,
      provenance: ALPHA_SANDBOX_PROVENANCE
    }
  };
}

export function createAlphaSandboxEventTextAdapter(): EventTextGenerationAdapter {
  return {
    async generateEventExpansionPlan({ request }) {
      const plan = withAlphaSandboxTerminalEnding(
        createDeterministicEventExpansionPlan(request),
        request.heroineContext.name
      );

      return {
        ...plan,
        metadata: {
          adapter: "mock-adapter",
          provenance: ALPHA_SANDBOX_PROVENANCE
        }
      };
    }
  };
}

export function createAlphaSandboxImageAdapter(): ProjectImageGenerationAdapter {
  return {
    async generateImageAsset(input: ProjectImageGenerationInput): Promise<ProjectImageGenerationResult> {
      const kind = input.kind || "cg";
      const jobId = input.jobId || `job-alpha-sandbox-${normalizePathPart(kind)}-${normalizePathPart(input.targetId)}`;
      const outputAssetId = input.outputAssetId || `asset-alpha-sandbox-${normalizePathPart(kind)}-${normalizePathPart(input.targetId)}`;
      const fileName = `${outputAssetId}.png`;
      const filePath = join(input.outputDirectory, fileName);

      await mkdir(input.outputDirectory, { recursive: true });
      await writeFile(filePath, Buffer.from(sandboxPngBase64, "base64"));

      const job = createImageGenerationJob({
        id: jobId,
        kind,
        targetId: input.targetId,
        prompt: input.prompt,
        style: input.style || "deterministic alpha sandbox fixture",
        outputAssetId
      });
      job.provider = "mock-adapter";
      job.status = "completed";

      const asset: VnMakerAsset = {
        id: outputAssetId,
        kind,
        label: `${kind} fixture from ${ALPHA_SANDBOX_PROVENANCE}`,
        uri: publicAssetUri(input.publicPathPrefix, fileName, filePath),
        source: "generated",
        generationJobId: job.id
      };

      return {
        adapter: ALPHA_SANDBOX_PROVENANCE,
        job,
        asset,
        image: {
          mimeType: "image/png",
          b64Json: sandboxPngBase64,
          dataUrl: `data:image/png;base64,${sandboxPngBase64}`,
          fileName,
          filePath,
          uri: asset.uri,
          codexSavedPath: null,
          revisedPrompt: null
        },
        raw: {
          adapter: "mock-adapter",
          packId: ALPHA_SANDBOX_PACK_ID,
          version: ALPHA_SANDBOX_PACK_VERSION,
          provenance: ALPHA_SANDBOX_PROVENANCE,
          fixture: kind
        }
      };
    }
  };
}
