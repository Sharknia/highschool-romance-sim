import type { ApiResult } from "../../api/types";
import type { HeroineDraft, HeroineLibraryResult, HeroineRevisionRef } from "./heroinePageTypes";

type PostAuthedJson = <T extends ApiResult = ApiResult>(path: string, body: unknown) => Promise<T>;

export function failureText(result: ApiResult, fallback: string): string {
  const message = typeof result.message === "string" ? result.message : "";
  const error = typeof result.error === "string" ? result.error : "";
  return message || error || fallback;
}

export function isHeroineFailure(result: ApiResult): boolean {
  return result.ok === false && typeof result.code === "string" && result.code.startsWith("HEROINE_");
}

export function listHeroines(postJson: PostAuthedJson): Promise<HeroineLibraryResult> {
  return postJson<HeroineLibraryResult>("/api/heroines/list", {});
}

export function getHeroine(postJson: PostAuthedJson, heroineId: string): Promise<HeroineLibraryResult> {
  return postJson<HeroineLibraryResult>("/api/heroines/get", { heroineId });
}

export function createHeroine(
  postJson: PostAuthedJson,
  draft: HeroineDraft,
  stagedPortraitRef?: HeroineLibraryResult["stagedPortraitRef"]
): Promise<HeroineLibraryResult> {
  return postJson<HeroineLibraryResult>("/api/heroines/create", {
    action: "createHeroine",
    requestId: `create-${draft.id}-${Date.now()}`,
    heroine: draft,
    stagedPortraitRef
  });
}

export function updateHeroine(
  postJson: PostAuthedJson,
  draft: HeroineDraft,
  expectedHeroineRevision?: HeroineRevisionRef
): Promise<HeroineLibraryResult> {
  return postJson<HeroineLibraryResult>("/api/heroines/update", {
    action: "updateHeroine",
    requestId: `update-${draft.id}-${Date.now()}`,
    heroine: draft,
    expectedHeroineRevision
  });
}

export function deleteHeroine(
  postJson: PostAuthedJson,
  heroine: HeroineDraft,
  expectedHeroineRevision?: HeroineRevisionRef
): Promise<HeroineLibraryResult> {
  return postJson<HeroineLibraryResult>("/api/heroines/delete", {
    action: "deleteHeroine",
    requestId: `delete-${heroine.id}-${Date.now()}`,
    heroineId: heroine.id,
    confirmName: heroine.name,
    confirmId: heroine.id,
    expectedHeroineRevision
  });
}

export function generateHeroinePortrait(
  postJson: PostAuthedJson,
  input: {
    draft?: HeroineDraft;
    heroineId?: string;
    expectedHeroineRevision?: HeroineRevisionRef;
  }
): Promise<HeroineLibraryResult> {
  return postJson<HeroineLibraryResult>("/api/heroines/portrait/generate", {
    action: "generateHeroinePortrait",
    requestId: `portrait-${input.heroineId || input.draft?.id || "draft"}-${Date.now()}`,
    ...input
  });
}

export function createProjectFromHeroine(postJson: PostAuthedJson, heroine: HeroineDraft): Promise<HeroineLibraryResult> {
  return postJson<HeroineLibraryResult>("/api/projects/from-heroine", {
    heroineId: heroine.id,
    title: `${heroine.name} 프로젝트`,
    premise: `${heroine.name}의 원본 히로인 스냅샷으로 시작하는 제작 프로젝트`
  });
}
