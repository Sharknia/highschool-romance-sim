# SA-68 Alpha Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an env-gated alpha sandbox generation workflow that lets CLI and Web API run the VN Maker happy path without Codex OAuth while preserving the normal OAuth-required path when disabled.

**Architecture:** Put reusable fixture generation in a new `@vn-maker/alpha-sandbox` package so `generation-codex` remains real Codex-only. CLI and Web API select adapters through the same env gate, then continue using the existing use-case and project-store paths for create/save/expand/approve/generation/preview/export/smoke.

**Tech Stack:** TypeScript workspaces, `engine-core`, `use-cases`, `project-store`, Hono Web API, Node CLI, ESM regression tests.

---

### Task 1: Failing Regression Coverage

**Files:**
- Create: `tests/vn-maker-alpha-sandbox.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";

const webHandlers = await import("../apps/web/dist/server/handlers.js");

const authRequiredApi = webHandlers.createApiRequestHandler({
  codex: {
    async readSession() {
      return { connected: false, mode: null, account: null, requiresOpenaiAuth: true, capabilities: null };
    },
    async startLogin() {
      return { type: "chatgpt", loginId: "login", authUrl: "https://chatgpt.com/auth" };
    },
    async logout() {},
    async generateImageAsset() {
      throw new Error("Codex ChatGPT OAuth 로그인이 필요합니다.");
    },
    async generateEventExpansionPlan() {
      throw new Error("Codex ChatGPT OAuth 로그인이 필요합니다.");
    }
  }
});

const offResult = await authRequiredApi({
  method: "POST",
  path: "/api/events/expand",
  body: {
    projectDirectory: "/tmp/sa68-off.vnmaker",
    starter: { id: "sa68-off", title: "SA68 Off", premise: "sandbox off" },
    userEvent: "OAuth 없는 일반 경로는 성공하면 안 된다."
  }
});
assert.equal(offResult.status, 401);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build:maker && node tests/vn-maker-alpha-sandbox.test.mjs`
Expected: FAIL because the API still falls back to deterministic expansion instead of the Codex text adapter.

### Task 2: Reusable Sandbox Pack

**Files:**
- Create: `packages/alpha-sandbox/package.json`
- Create: `packages/alpha-sandbox/tsconfig.json`
- Create: `packages/alpha-sandbox/src/index.ts`

- [ ] **Step 1: Implement pack exports**

Export `ALPHA_SANDBOX_PACK_ID`, `ALPHA_SANDBOX_PACK_VERSION`, `ALPHA_SANDBOX_PROVENANCE`, `createAlphaSandboxHeroine`, `createAlphaSandboxEventTextAdapter`, `createAlphaSandboxImageAdapter`, and `createAlphaSandboxSession`.

- [ ] **Step 2: Keep fixture output deterministic**

The event adapter returns `createDeterministicEventExpansionPlan(request)` plus raw provenance. The image adapter writes a tiny deterministic PNG to `input.outputDirectory`, returns `job.provider = "mock-adapter"`, `asset.source = "generated"`, and `raw.provenance = ALPHA_SANDBOX_PROVENANCE`.

### Task 3: Shared Env Gate

**Files:**
- Modify: `packages/cli/src/index.ts`
- Modify: `apps/web/src/server/handlers.ts`
- Modify: `apps/web/src/client/auth/AuthProvider.tsx`

- [ ] **Step 1: Wire CLI adapters**

When `VN_MAKER_ALPHA_SANDBOX=1`, CLI uses sandbox text/image adapters. Otherwise it uses `sharedCodexAppServerClient` for both text and image adapters.

- [ ] **Step 2: Wire Web API adapters**

When `VN_MAKER_ALPHA_SANDBOX=1`, Web API reports a sandbox session and injects sandbox text/image adapters. Otherwise it reports and uses the existing Codex app-server adapter.

- [ ] **Step 3: Keep UI wording honest**

`describeSession()` must display `Alpha Sandbox` for sandbox sessions and keep `Codex OAuth` wording only for real OAuth status.

### Task 4: Provenance and Full Path Verification

**Files:**
- Modify: `tests/vn-maker-alpha-sandbox.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add API happy path assertions**

Under `VN_MAKER_ALPHA_SANDBOX=1`, create a project from the sandbox heroine, expand, approve, run the planned CG job, preview, export, smoke-test export, and assert sandbox provenance in raw output/job provider.

- [ ] **Step 2: Add CLI happy path assertions**

Run the same path through `packages/cli/dist/index.js` commands with `VN_MAKER_ALPHA_SANDBOX=1`, using actual project-store directories and exported smoke checks.

- [ ] **Step 3: Add script coverage**

Include `node tests/vn-maker-alpha-sandbox.test.mjs` in `npm run test:maker`.

### Task 5: Verification and Integration

**Files:**
- All modified files

- [ ] **Step 1: Run verification**

Run: `npm run typecheck`, `npm run test:maker`, actual CLI/API sandbox commands, and Web UI browser checks for desktop/mobile widths.

- [ ] **Step 2: Finish Linear/GitHub flow**

Run: `git diff --check`, `git status --short`, commit the task branch, push it, update SA-68 and subissues with verification evidence, and mark issues done only after completion audit passes.
