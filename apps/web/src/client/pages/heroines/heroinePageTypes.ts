import type { ApiResult } from "../../api/types";

export interface HeroineDraft {
  id: string;
  name: string;
  description: string;
  personality: string;
  speechStyle: string;
  appearance: string;
  defaultPortraitAssetId?: string;
  defaultPortraitUri?: string;
  portraitAssetIds?: string[];
  portraitAssetUris?: string[];
  expressionAssetIds?: Record<string, string>;
  reuseHistory?: Array<{
    projectId: string;
    projectTitle: string;
    projectDirectory: string;
    snapshotCharacterId: string;
    snapshotCreatedAt: string;
  }>;
}

export interface HeroineLibraryResult extends ApiResult {
  projectDirectory?: string;
  heroine?: HeroineDraft;
  heroines?: HeroineDraft[];
}

export type HeroineListState = "loading" | "empty" | "ready" | "error";
