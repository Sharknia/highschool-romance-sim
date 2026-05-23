# Issue 27 Alpha Project Management QA

## Scope
- Parent: #27
- Sub-issues: #20, #21, #22, #23, #24, #25, #26
- This file is the evidence artifact for #26 and the consolidated verification record for #27.
- #44 project-management audit supersedes the `/projects` acceptance rows that were tied to the old recent-project implementation. Rows marked `superseded` are historical evidence only and are not current completion criteria.

## Acceptance Checklist
| Requirement | Evidence | Result |
| --- | --- | --- |
| #20 safe API envelope covers JSON, empty, nonJSON, network, abort, 4xx, and 5xx | `tests/vn-maker-regression.test.mjs`, `tests/vn-maker-alpha-shell.test.mjs` | pass |
| #20 Web/API/CLI share project deletion and generation use cases | `packages/use-cases`, `apps/web/src/server/handlers.ts`, `packages/cli/src/index.ts` | pass |
| Existing app project menu entry is kept and no extra project-management menu entry is added | `tests/vn-maker-alpha-shell.test.mjs`, browser screenshots | pass |
| `/projects` opens on a project list using central list UI | Superseded by #44 project-management audit; current checks live in #45-#63 | superseded |
| Project list cards show storage/status/summary/recent timestamps | Superseded by #44 project-management audit; do not treat old screenshots as current acceptance evidence | superseded |
| Project list delete confirmation uses shared `DeleteConfirmDialog` | source assertions | pass |
| Delete confirmation shows impact, reversibility, retry/failure state | source assertions, use-case/API tests | pass |
| Recent-list removal is reversible and does not delete local files | `tests/vn-maker-use-cases.test.mjs`, `tests/vn-maker-alpha-sandbox.test.mjs` | pass |
| Local project delete is confirmed by title and irreversible | `tests/vn-maker-use-cases.test.mjs` | pass |
| `/projects/:projectId` lands on overview | source assertions, browser overview screenshots | pass |
| Detail tabs are overview, heroine, background, studio, preview, export | source assertions, browser tab screenshots | pass |
| Project detail uses central `TabList` | source assertions | pass |
| Heroine tab edits project snapshot only, not library original | `tests/vn-maker-use-cases.test.mjs`, browser heroine tab screenshots | pass |
| Background generation enforces one generated background per project | use-case/API/CLI tests | pass |
| Generated background asset is linked through scene `backgroundAssetId` | use-case/API/CLI/actual imageGeneration evidence | pass |
| `/projects/:projectId/background` direct URL, reload, and tab URL sync work | `docs/qa/issue-24-background-route.md` | pass |
| Studio shows under-construction state without fake buttons/progress | `docs/qa/issue-23-studio.md`, source assertions | pass |
| Preview happy path is prepared/ready and shows blockers when blocked | use-case/API/CLI tests, browser preview screenshots | pass |
| Preview/export errors keep header and tab bar visible | source assertions, browser preview/export screenshots | pass |
| Export happy path includes target, data/assets, and validation summary | use-case/API/CLI tests, browser export screenshots | pass |
| Export blocked/failed states are not displayed as complete | use-case/API/CLI tests, browser export screenshots | pass |
| Legacy static deployment target is excluded as current target | export DTO target `localDesktopWebApp`, `githubPagesTarget: false` | pass |
| CLI happy path uses temp directory and JSON stdin with `ok: true` outputs | CLI run below | pass |
| API happy path is verified through local HTTP routes | HTTP run below | pass |
| Browser QA compares `/projects` and `/heroines` at 390x844, 768x1024, 1440x900 | screenshots below | pass |
| Frontend empty, nonJSON, and 5xx API error states render retry/next action without throwing | regression test + shell source assertions | pass |
| Actual Codex app-server ChatGPT managed OAuth `imageGeneration` is verified | actual run below | pass |

## Completed Sub-Issues
- #20 common contracts: pass, commit `4de0a37`
- #21 project list/delete: pass, commit `617e595`
- #22 detail tabs overview/heroine: pass, commit `3717a47`
- #23 studio under construction: pass, commit `26808de`
- #24 background generation: pass, commit `0d1978c`
- #25 preview/export safety: pass, commit `5bdba1c`
- #26 integration QA: this document

## Verification Commands
| Command | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | pass | full legacy + maker typecheck |
| `npm run test:maker` | pass | domain/use-case/beta/regression/alpha sandbox/shell/ui-state |
| `node tests/vn-maker-use-cases.test.mjs` | pass | #25 focused rerun before full suite |
| `node tests/vn-maker-alpha-sandbox.test.mjs` | pass | API/CLI alpha sandbox happy path |
| `node tests/vn-maker-alpha-shell.test.mjs` | pass | source UI contracts |
| `git diff --check` | pass | checked before #25 commit and will be rerun before #26 commit |

## CLI Happy Path
Command family: `create-project-from-heroine`, `expand-event`, `approve-event`, `generate-image`, `create-image-job`, `run-generation-jobs`, `preview`, `export-web`, `smoke-export`.

Result:
```json
{
  "projectDirectory": "/tmp/vn-maker-issue26-cli-6lCX4v/Issue26Cli.vnmaker",
  "projectId": "issue-26-cli-ready",
  "cgAssetId": "asset-cg-issue26-cli-heroine-863b530e-library",
  "backgroundAssetId": "asset-issue-26-cli-background",
  "linkedBackground": true,
  "previewCanRun": true,
  "previewState": "prepared",
  "exportTarget": "localDesktopWebApp",
  "exportValidationOk": true,
  "exportState": "complete",
  "smokeOk": true
}
```

Alpha sandbox image calls in this CLI run are counted as `목 테스트`.

## HTTP API Happy Path
Server: `VN_MAKER_ALPHA_SANDBOX=1 npm run dev -w @vn-maker/web`, API `http://127.0.0.1:5174`.

Route family: `/api/projects/from-heroine`, `/api/events/expand`, `/api/events/approve`, `/api/generation/images`, `/api/generation/jobs`, `/api/generation/jobs/run`, `/api/project/preview`, `/api/project/export`.

Result:
```json
{
  "projectDirectory": "/tmp/vn-maker-issue26-http-5JkcrS/Issue26Http.vnmaker",
  "projectId": "issue-26-http-ready",
  "cgAssetId": "asset-cg-issue26-http-heroine-863b530e-library",
  "backgroundAssetId": "asset-issue-26-http-background",
  "linkedBackground": true,
  "previewCanRun": true,
  "previewState": "prepared",
  "exportTarget": "localDesktopWebApp",
  "exportValidationOk": true,
  "exportState": "complete",
  "smokeOk": true
}
```

## Browser QA
| Viewport | `/heroines` | `/projects` | Detail tabs | Result |
| --- | --- | --- | --- | --- |
| 390x844 | `/tmp/vn-maker-issue26-qa/heroines-390.png` | `/tmp/vn-maker-issue26-qa/projects-390.png` | `overview`, `heroine`, `background`, `studio`, `preview`, `export` screenshots captured | pass |
| 768x1024 | `/tmp/vn-maker-issue26-qa/heroines-768.png` | `/tmp/vn-maker-issue26-qa/projects-768.png` | `overview`, `heroine`, `background`, `studio`, `preview`, `export` screenshots captured | pass |
| 1440x900 | `/tmp/vn-maker-issue26-qa/heroines-1440.png` | `/tmp/vn-maker-issue26-qa/projects-1440.png` | `overview`, `heroine`, `background`, `studio`, `preview`, `export` screenshots captured | pass |

Detail screenshot directory: `/tmp/vn-maker-issue26-qa/`.

## Image Generation
Actual Codex app-server imageGeneration: pass.

Fresh status:
```json
{
  "connected": true,
  "mode": "chatgpt",
  "capabilities": {
    "imageGeneration": true
  }
}
```

Actual generation result inspected from the generated project store:
```json
{
  "projectDirectory": "/tmp/vn-maker-issue26-actual-YAfAM2/Issue26Actual.vnmaker",
  "projectId": "issue-26-actual-image",
  "jobStatus": "completed",
  "jobProvider": "image-generation-adapter",
  "assetId": "asset-issue-26-actual-background",
  "assetKind": "background",
  "assetSource": "generated",
  "assetUriKind": "data-url",
  "linkedBackground": true,
  "backgroundAssetCount": 1
}
```

Note: the CLI command itself succeeded, but the raw stdout included the generated image data URL and exceeded the parent Node script buffer. The project store inspection above is the small-field verification of the successful actual run.

## Gaps
- No product acceptance gaps found.
- Playwright Test runner click spec could not run in this environment because the transient npx runner could not resolve `@playwright/test` from a repo-local temporary spec. Browser evidence was captured with Playwright screenshot CLI instead; CLI/API happy paths cover execution.
