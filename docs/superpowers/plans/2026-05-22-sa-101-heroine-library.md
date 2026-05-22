# SA-101 Heroine Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Alpha `/heroines` flow so a user can create the first heroine, save required profile fields, prepare a default portrait, understand Codex imageGeneration availability, and delete library entries without implying project snapshots are removed.

**Architecture:** Reuse the existing `@vn-maker/use-cases` heroine APIs and `project-store` library table as the single owner for persistence. Add a focused React heroine page with local draft/list UI state, leaving Beta-only search, sorting, tags, clone, emotion asset batches, and expression asset batches out of the Alpha primary flow.

**Tech Stack:** TypeScript, React, React Router, Hono API handlers, `@vn-maker/use-cases`, `@vn-maker/project-store`, `@vn-maker/engine-core`, Node integration tests.

---

### Task 1: SA-119 Library Contract And Required Field Verification

**Files:**
- Modify: `tests/vn-maker-use-cases.test.mjs`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`
- Modify: `packages/use-cases/src/index.ts` only if current result DTOs are insufficient.

- [ ] **Step 1: Write failing use-case assertions**

Add assertions showing `saveHeroine` rejects blank `id`, `name`, `description`, `personality`, `speechStyle`, and `appearance`, and that `listHeroines` returns an empty array before any heroine exists.

```js
const emptyLibraryDirectory = join(tempRoot, "EmptyHeroineLibrary.vnmaker");
const emptyLibrary = await useCases.listHeroines({ projectDirectory: emptyLibraryDirectory });
assert.equal(emptyLibrary.ok, true);
assert.deepEqual(emptyLibrary.heroines, []);

await assert.rejects(
  () => useCases.saveHeroine({
    projectDirectory: emptyLibraryDirectory,
    heroine: {
      id: "",
      name: "",
      description: "",
      personality: "",
      speechStyle: "",
      appearance: ""
    }
  }),
  /id|name|description|personality|speechStyle|appearance|비어/
);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs
```

Expected: fail until `id` and whitespace-only required fields are rejected by the shared contract.

- [ ] **Step 3: Implement the shared validation only if needed**

If existing parsing allows omitted `id` or whitespace-only text fields, update `packages/engine-core/src/index.ts` `parseHeroineProfileInput` so SA-101 required fields are non-empty, including explicit `id`.

```ts
hasString(value, "id", "id", issues, { nonEmpty: true });
hasString(value, "name", "name", issues, { nonEmpty: true });
hasString(value, "description", "description", issues, { nonEmpty: true });
hasString(value, "personality", "personality", issues, { nonEmpty: true });
hasString(value, "speechStyle", "speechStyle", issues, { nonEmpty: true });
hasString(value, "appearance", "appearance", issues, { nonEmpty: true });
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs
```

Expected: use-case tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/engine-core/src/index.ts tests/vn-maker-use-cases.test.mjs docs/superpowers/plans/2026-05-22-sa-101-heroine-library.md
git commit -m "test: define SA-101 heroine library contract"
```

### Task 2: SA-120 `/heroines` List And Editor CRUD

**Files:**
- Modify: `apps/web/src/client/App.tsx`
- Replace: `apps/web/src/client/pages/HeroineStartPage.tsx`
- Create: `apps/web/src/client/pages/heroines/heroinePageTypes.ts`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`

- [ ] **Step 1: Write failing source-contract tests**

In `tests/vn-maker-alpha-shell.test.mjs`, replace the older guard that forbids heroine APIs in `HeroineStartPage` with SA-101 assertions:

```js
assert.match(heroineStartSource, /\/api\/heroines\/list/, "HeroineStartPage는 히로인 목록 API를 호출해야 합니다.");
assert.match(heroineStartSource, /\/api\/heroines\/save/, "HeroineStartPage는 히로인 저장 API를 호출해야 합니다.");
assert.match(heroineStartSource, /\/api\/heroines\/delete/, "HeroineStartPage는 히로인 삭제 API를 호출해야 합니다.");
assert.match(appSource, /<Route path="\/heroines\/:heroineId"/, "`/heroines/:heroineId` 상세 라우트가 있어야 합니다.");
[
  "아직 히로인이 없습니다.",
  "히로인 목록을 불러오는 중입니다.",
  "히로인 목록을 불러오지 못했습니다.",
  "히로인을 선택하거나 새로 만드세요.",
  "필수값을 모두 입력해야 저장할 수 있습니다."
].forEach((requiredText) => {
  assert.match(heroineStartSource, new RegExp(requiredText), `HeroineStartPage에 '${requiredText}' 문구가 있어야 합니다.`);
});
assert.doesNotMatch(heroineStartSource, /히로인 검색|태그 필터|히로인 정렬|복제/, "Alpha 히로인 화면은 Beta 기능을 전면 노출하면 안 됩니다.");
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: fail because `HeroineStartPage` is still a placeholder.

- [ ] **Step 3: Implement the route and UI**

Add `/heroines/:heroineId`, type the heroine DTO locally, load list on mount, support empty/loading/error/ready states, select/new/edit/delete, and disable save until all SA-101 fields are filled.

Core behavior:

```ts
const requiredFields: Array<keyof HeroineDraft> = ["id", "name", "description", "personality", "speechStyle", "appearance"];
const missingRequiredFields = requiredFields.filter((field) => !String(draft[field] || "").trim());
const canSave = missingRequiredFields.length === 0 && !busy;
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: Alpha shell/source contract tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/client/App.tsx apps/web/src/client/pages/HeroineStartPage.tsx apps/web/src/client/pages/heroines/heroinePageTypes.ts tests/vn-maker-alpha-shell.test.mjs
git commit -m "feat: add alpha heroine CRUD screen"
```

### Task 3: SA-121 Default Portrait And Codex imageGeneration Status

**Files:**
- Modify: `apps/web/src/client/pages/HeroineStartPage.tsx`
- Modify: `apps/web/src/client/api/types.ts`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`
- Modify: `tests/vn-maker-use-cases.test.mjs`

- [ ] **Step 1: Write failing tests**

Assert that the heroine page reads Codex session state, calls `/api/generation/images`, and uses `imageGeneration` wording instead of API key wording.

```js
assert.match(heroineStartSource, /readCodexSession|refreshSession|session/, "HeroineStartPage는 Codex 연결 상태를 표시해야 합니다.");
assert.match(heroineStartSource, /\/api\/generation\/images/, "HeroineStartPage는 기본 포트레이트 생성 API를 호출해야 합니다.");
assert.match(heroineStartSource, /imageGeneration/, "HeroineStartPage는 imageGeneration 가능 여부를 표시해야 합니다.");
assert.doesNotMatch(heroineStartSource, /API key|API 키|OAuth 로그인처럼/, "API key 흐름을 Codex OAuth 로그인으로 표현하면 안 됩니다.");
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: fail until portrait generation/status UI exists.

- [ ] **Step 3: Implement portrait controls**

Use the existing `POST /api/generation/images` path with `{ projectDirectory, kind: "portrait", heroine: draft }`. On success, update `defaultPortraitAssetId` from `asset.id`, `asset.uri`, `image.uri`, or the existing draft asset id.

```ts
const result = await postAuthedJson<PortraitGenerationResult>("/api/generation/images", {
  projectDirectory,
  kind: "portrait",
  heroine: draft
});
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: Alpha shell/source contract tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/client/pages/HeroineStartPage.tsx apps/web/src/client/api/types.ts tests/vn-maker-alpha-shell.test.mjs
git commit -m "feat: connect heroine default portrait controls"
```

### Task 4: SA-122 Delete Policy And Alpha Scope Cleanup

**Files:**
- Modify: `apps/web/src/client/pages/HeroineStartPage.tsx`
- Modify: `tests/vn-maker-use-cases.test.mjs`
- Modify: `tests/vn-maker-alpha-shell.test.mjs`

- [ ] **Step 1: Write failing tests**

Add assertions that deleting a library heroine does not mutate an already created project snapshot, and that the page includes the snapshot retention copy.

```js
const snapshotProjectDirectory = join(tempRoot, "SnapshotDeletePolicy.vnmaker");
await useCases.saveHeroine({ projectDirectory: snapshotProjectDirectory, heroine });
const fromLibraryForDelete = await useCases.createProjectFromHeroine({
  projectDirectory: snapshotProjectDirectory,
  heroineId: heroine.id,
  title: "스냅샷 유지 검증"
});
await useCases.deleteHeroine({ projectDirectory: snapshotProjectDirectory, heroineId: heroine.id });
const reopenedAfterDelete = await useCases.openProject({ projectDirectory: snapshotProjectDirectory });
assert.equal(reopenedAfterDelete.project.characters[0].sourceHeroineId, heroine.id);
assert.equal(reopenedAfterDelete.project.characters[0].displayName, heroine.name);
assert.equal(fromLibraryForDelete.project.characters[0].displayName, heroine.name);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: fail until the UI/source contract and any missing snapshot guarantee are present.

- [ ] **Step 3: Implement policy copy and cleanup**

Show delete copy near the delete action:

```tsx
<p className="page-muted">
  삭제해도 이미 만든 프로젝트의 히로인 스냅샷은 유지됩니다. 라이브러리 목록에서만 제거됩니다.
</p>
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run build:maker && node tests/vn-maker-use-cases.test.mjs && node tests/vn-maker-alpha-shell.test.mjs
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/client/pages/HeroineStartPage.tsx tests/vn-maker-use-cases.test.mjs tests/vn-maker-alpha-shell.test.mjs
git commit -m "feat: document heroine deletion snapshot policy"
```

### Task 5: SA-123 Acceptance Verification And Review Handoff

**Files:**
- Modify only if verification uncovers gaps.

- [ ] **Step 1: Run required verification**

```bash
npm run typecheck
npm run test:maker
git diff --check
git status -sb
```

- [ ] **Step 2: Run a real CLI/API happy path**

Use a temporary project directory and run at least `list-heroines`, `save-heroine`, `delete-heroine`, and an API request through the web handler or dev server.

- [ ] **Step 3: Browser check**

Start the web app, open `/heroines`, perform create/save/portrait assign/delete happy path once, then check `390x844`, `768x1024`, and `1440x900`.

- [ ] **Step 4: Commit/push/PR**

```bash
git push -u origin feature/sa-101-heroine-library
```

Create a PR for review and move SA-101 to `In Review`.

- [ ] **Step 5: Linear and Gmail report**

Record Acceptance Criteria evidence on SA-101. If Gmail connector is available, send the `/goal` completion report to `zel@kakao.com`.
