import type { ProjectAsset, ProjectData, ProjectGenerationJob, ProjectWorkflowSummary } from "./projectPageTypes";

type WorkflowStep = NonNullable<ProjectWorkflowSummary["steps"]>[number];

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
  if (provider === "codex" || provider === "openai" || provider === "imageGeneration") {
    return "이미지 생성 연결";
  }
  return "연결된 생성 서비스";
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
