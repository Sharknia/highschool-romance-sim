import type { ProjectAsset, ProjectData, ProjectGenerationJob, ProjectWorkflowSummary } from "./projectPageTypes";

type WorkflowStep = NonNullable<ProjectWorkflowSummary["steps"]>[number];
type DummyFallbackItem = ProjectAsset | ProjectGenerationJob | null | undefined;

const mockImagePackAdapter = "mock-image-pack-adapter";

export type DisplayWorkflowStep = WorkflowStep & {
  displayLabel: string;
  displayState: WorkflowStep["state"];
};

export function displayWorkflowStep(step: WorkflowStep): DisplayWorkflowStep {
  if (step.id === "studio") {
    return { ...step, displayLabel: "제작 준비 중", displayState: "waiting" };
  }
  return { ...step, displayLabel: step.label, displayState: step.state };
}

export function imageJobKindLabel(kind?: string): string {
  if (kind === "background") {
    return "배경 화면";
  }
  if (kind === "cg") {
    return "이벤트 CG";
  }
  return "이미지";
}

export function jobStatusLabel(value?: string): string {
  if (value === "planned") return "작업 예정";
  if (value === "running") return "생성 중";
  if (value === "failed") return "실패";
  if (value === "completed") return "완료";
  return value || "확인 필요";
}

export function generationProviderText(provider?: string): string {
  if (!provider) {
    return "생성 연결 확인 필요";
  }
  if (provider === mockImagePackAdapter) {
    return "패키징된 목 이미지";
  }
  if (provider === "codex" || provider === "openai" || provider === "imageGeneration") {
    return "이미지 생성 연결";
  }
  return "연결된 생성 서비스";
}

function isProjectGenerationJob(item: ProjectAsset | ProjectGenerationJob): item is ProjectGenerationJob {
  return "status" in item
    || "provider" in item
    || "prompt" in item
    || "targetId" in item
    || "outputAssetId" in item
    || "dummy" in item;
}

function itemAsset(item: DummyFallbackItem): ProjectAsset | null {
  if (!item) {
    return null;
  }
  return isProjectGenerationJob(item) ? item.asset || null : item;
}

function itemFallbackReason(item: DummyFallbackItem): string | undefined {
  if (!item) {
    return undefined;
  }
  const asset = itemAsset(item);
  if ("fallbackReason" in item && item.fallbackReason) {
    return item.fallbackReason;
  }
  return asset?.provenance?.fallbackReason;
}

function itemPackVersion(item: DummyFallbackItem): string | undefined {
  if (!item) {
    return undefined;
  }
  const asset = itemAsset(item);
  if ("packVersion" in item && item.packVersion) {
    return item.packVersion;
  }
  return asset?.provenance?.packVersion;
}

function itemKind(item: DummyFallbackItem): string | undefined {
  return item?.kind || itemAsset(item)?.kind;
}

function itemTargetId(item: DummyFallbackItem): string | undefined {
  if (!item) {
    return undefined;
  }
  if ("targetId" in item && item.targetId) {
    return item.targetId;
  }
  return item.id || itemAsset(item)?.id;
}

export function isDummyAsset(asset?: ProjectAsset | null): boolean {
  return Boolean(
    asset
    && (
      asset.source === "mock"
      || asset.source === "dummy"
      || asset.provenance?.adapter === mockImagePackAdapter
      || Boolean(asset.provenance?.fallbackReason)
      || Boolean(asset.provenance?.packVersion)
    )
  );
}

export function isDummyGenerationJob(job?: ProjectGenerationJob | null): boolean {
  return Boolean(
    job
    && (
      job.dummy === true
      || job.provider === mockImagePackAdapter
      || Boolean(job.fallbackReason)
      || Boolean(job.packVersion)
      || isDummyAsset(job.asset)
    )
  );
}

export function fallbackReasonText(value?: string): string {
  if (value === "OAUTH_REQUIRED") {
    return "Codex 미연결";
  }
  if (value === "IMAGE_GENERATION_UNAVAILABLE") {
    return "이미지 생성 기능 사용 불가";
  }
  if (value === "alpha-sandbox") {
    return "Alpha sandbox 목 이미지";
  }
  if (value === "codex-imageGeneration-unavailable") {
    return "Codex imageGeneration 사용 불가";
  }
  if (value === "PACKAGED_MOCK_IMAGE") {
    return "패키징된 목 이미지";
  }
  return value || "패키징된 목 이미지";
}

export function dummyFallbackSummaryText(count: number): string {
  return count > 0 ? `더미 이미지 ${count}개 포함` : "더미 이미지 없음";
}

export function dummyFallbackDetailText(item: DummyFallbackItem): string {
  const reason = itemFallbackReason(item);
  if (reason === "OAUTH_REQUIRED") {
    return "Codex 미연결 상태라 패키징된 목 이미지를 연결했습니다.";
  }
  if (reason === "IMAGE_GENERATION_UNAVAILABLE") {
    return "이미지 생성 기능을 사용할 수 없어 패키징된 목 이미지를 연결했습니다.";
  }
  return "실제 생성 결과가 없어 패키징된 목 이미지를 연결했습니다.";
}

export function dummyFallbackTargetText(item: DummyFallbackItem): string {
  const target = itemTargetId(item);
  const kind = imageJobKindLabel(itemKind(item));
  return target ? `${kind} · 대상 ${target}` : `${kind} · 대상 확인 필요`;
}

export function dummyPackVersionText(item: DummyFallbackItem): string {
  const packVersion = itemPackVersion(item);
  return packVersion ? `packVersion ${packVersion}` : "packVersion 확인 필요";
}

export function backgroundConnectionText(asset: ProjectAsset | null, job: ProjectGenerationJob | null): string {
  if (asset?.id) {
    return "배경 연결됨";
  }
  if (job?.status === "completed") {
    return "생성 결과 확인 필요";
  }
  if (job) {
    return `${imageJobKindLabel(job.kind)} ${jobStatusLabel(job.status)}`;
  }
  return "생성 전";
}

export function backgroundSceneConnectionText(scene: NonNullable<ProjectData["scenes"]>[number] | null): string {
  if (!scene) {
    return "연결할 장면 없음";
  }
  if (scene.backgroundAssetId) {
    return scene.label ? `${scene.label}에 연결됨` : "기본 장면에 연결됨";
  }
  return scene.label ? `${scene.label} 연결 대기` : "기본 장면 연결 대기";
}

export function backgroundAssetDisplayLabel(asset: ProjectAsset): string {
  const label = asset.label?.trim();
  if (label && !label.includes("@") && !/fixture|sandbox/i.test(label)) {
    return label;
  }
  return "생성된 배경";
}
