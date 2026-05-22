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
  portraitStatus?: "none" | "placeholder" | "generated" | "imported" | "missing";
  expressionAssetIds?: Record<string, string>;
  updatedAt?: string;
  summary?: string;
  personalitySummary?: string;
  heroineRevision?: HeroineRevisionRef;
  reuseHistory?: Array<{
    projectId: string;
    projectTitle: string;
    projectDirectory: string;
    snapshotCharacterId: string;
    snapshotCreatedAt: string;
  }>;
}

export interface HeroineRevisionRef {
  kind: "heroineRevision";
  heroineId: string;
  value: string;
  updatedAt: string;
  capturedAt: string;
}

export interface HeroineLibraryRevisionRef {
  kind: "heroineLibraryRevision";
  value: string;
  updatedAt: string;
  capturedAt: string;
}

export interface HeroineLibraryResult extends ApiResult {
  projectDirectory?: string;
  heroine?: HeroineDraft;
  heroines?: HeroineDraft[];
  count?: number;
  empty?: boolean;
  loadedAt?: string;
  sort?: "updatedAtDesc";
  heroineRevision?: HeroineRevisionRef;
  libraryRevision?: HeroineLibraryRevisionRef;
  deletedHeroineId?: string;
  snapshotPolicy?: "projectSnapshotsPreserved";
  targetRoute?: string;
  projectId?: string;
  stagedPortraitRef?: {
    id: string;
    expiresAt: string;
    previewUri?: string;
  };
  asset?: {
    id?: string;
    uri?: string;
  };
}

export type HeroineListState = "loading" | "empty" | "ready" | "error" | "deleting";

export type HeroineLoadState = "loading" | "error" | "notFound" | "ready" | "saving" | "deleting" | "conflict";
