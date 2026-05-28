# Issue 118 Studio UX Regression And Accessibility QA

검토일: 2026-05-28

대상:
- Parent: #108
- Active child issues: #109, #110, #111, #112, #113, #114, #115, #116, #117, #118, #119, #120, #121
- Legacy reconciliation: legacy-linear #12-#16/#18/#19

## Baseline Coverage Matrix

| Notion / issue area | Baseline status | Owner issue | Baseline evidence | Gap before this gate |
| --- | --- | --- | --- | --- |
| Studio shell, desktop breakpoints, unsupported narrow viewport | Ready | #109, #119 | `docs/qa/phase0-studio-screenshot-alignment-2026-05-27.md`, `tests/vn-maker-studio-alignment-metrics.test.mjs` | Layout evidence existed, but it was not tied to final behavior gate. |
| Studio save context, route/scene identity, stale revision guard | Ready | #110 | `tests/vn-maker-studio-save-context.test.mjs`, `tests/vn-maker-regression.test.mjs` stale revision sections | Needed final QA cross-reference with browser save path. |
| Route map, Problems Panel focus, validation stale handling | Ready | #111, #112, #115, #116 | `tests/vn-maker-alpha-shell.test.mjs`, `tests/vn-maker-studio-issue-focus.test.mjs` | Mostly source/use-case assertions; final browser flow was missing. |
| Manual authoring: project open, route, scene, choice target, ending, save, validation, preview | Partial | #113, #114, #118 | Individual regression tests and source contracts | Full browser happy path evidence was missing. |
| Repair preview/apply/undo and repair conflict handling | Ready | #112, #115, #116 | `tests/vn-maker-regression.test.mjs` repair preview/apply/undo/stale checks | Needed one Studio browser pass through Problems Panel. |
| Natural-language patch, fixed prompt replay, Phase 0 decision evidence | Ready | #117 | #117 browser smoke, `tests/vn-maker-alpha-shell.test.mjs`, `docs/vn-maker-toolkit.md` | Needed separation from primary manual flow in final gate. |
| CG/background job lifecycle and asset slot connection | Ready | #120 | #120 browser smoke, `/api/generation/jobs/list`, `/api/generation/jobs/run` | Needed final QA matrix link. |
| Condition/effect candidate review without runtime support | Ready | #121 | #121 browser smoke, `tests/vn-maker-regression.test.mjs` preview preflight condition trace | Needed final QA matrix link. |
| Mock / Actual / Replay Separation in UI, docs, event log | Partial | #117, #118 | Source contracts and #117 smoke | Final event-log evidence was missing. |
| Legacy Project hygiene | Missing | #118 | Project still contained legacy-linear #12-#16/#18/#19 | Active #108 child set and legacy backlog needed explicit reconciliation. |

## Final Gate Coverage Matrix

| Area | Final status | Owner issue | Evidence | Remaining gap |
| --- | --- | --- | --- | --- |
| Desktop shell and layout | Ready | #109, #119 | Playwright smoke rendered `루트 맵`, `스테이지 미리보기`, `스크립트 편집기`, `인스펙터`, `문제 패널` at 1280x720, 1366x768, 1440x900, 1920x1080 with `scrollWidth == viewport width`. | Exhaustive OS/browser matrix is outside #118. |
| Below-minimum and mobile policy | Ready | #109, #118 | Playwright smoke at 390x844 showed `studio-unsupported`, no `studio-workspace`, and `1280x720 이상` copy. | None for active scope. |
| Browser E2E Primary Happy Path | Ready | #118 | Project `smoke-118-final-1779965524954`, `/tmp/vn-maker-smoke-118-final-1779965524954.vnmaker`: open Studio, route `haru-route`, scene `scene-opening`, create choice target `scene---1779965528721`, set text/background/ending, save, validate, preview `/projects/smoke-118-final-1779965524954/preview?route=haru-route&scene=scene---1779965528721`. | None for active scope. |
| Failure Path Evidence | Ready | #110, #112, #115, #116, #118 | Browser overlay showed `validation stale`; intercepted non-JSON 5xx save showed `API 실패: 서버 응답을 해석하지 못했습니다.` `tests/vn-maker-regression.test.mjs` covers `STALE_PROJECT_REVISION`, repair stale/conflict paths, `PREVIEW_BLOCKED`, `background-required`, empty/non-JSON/5xx client response contracts. | Browser only rechecked representative non-JSON 5xx save and stale validation. |
| Repair preview/apply/undo | Ready | #112, #114, #115, #118 | Browser flow cleared a choice target, opened missing-target repair diff, applied `create-target-scene`, then used `마지막 수리 되돌리기`. UX event log includes `repair_action_used`, `repaired`, `undo_used`. | None for active scope. |
| Current selected scene preview startSceneId | Ready | #116, #118 | Playwright preview URL preserved selected scene `scene---1779965528721` as query `scene=scene---1779965528721`. | None for active scope. |
| Keyboard And Accessibility Evidence | Ready | #111, #112, #115, #118 | `Ctrl+K` focused `aria-label="루트 맵 씬 검색"`, route splitter `ArrowRight` changed `aria-valuenow` 300 -> 324, Delete shortcut opened scene deletion confirmation, command buttons exposed names `저장`, `검증`, `프리뷰`. | Escape behavior remains covered by shared dialog source contract, not re-exercised in this browser smoke. |
| Optional/Diagnostic Flow Evidence | Ready | #117, #120, #118 | Validation tab drawer `생성 보조 / QA` opened; `목 재생` active badge confirmed `mockReplay` / `목 replay`; `이벤트 로그 export` and `Phase 0 리포트` completed. #120 remains CG job lifecycle evidence for planned/run/connect. | Natural-language patch quality is outside this gate. |
| UX Event Log Evidence | Ready | #117, #118 | Event log count 10; names: `started`, `help_opened`, `recipe_used`, `generated`, `previewed`, `repair_action_used`, `repaired`, `undo_used`; at least one event carried `preflightResult`. Repair events carried `missing-target`, `create-target-scene`, `success/undone`. | None for active scope. |
| Mock / Actual / Replay Separation | Ready | #117, #118 | Primary authoring stayed manual; generation drawer was optional. Active `mockReplay` badge was verified after `목 재생`. #117 evidence keeps actual patch, protocol replay, unavailable state separated from Problems Panel. | None for active scope. |
| Legacy-linear Reconciliation | Ready | #118 | legacy-linear #12-#16/#18/#19 are documented as legacy backlog, not active #108 child completion. They are not closed by this gate and are not counted as blockers for #109-#121 completion. | Product owner can later decide superseded/keep-open state per legacy scope. |

## Browser E2E Primary Happy Path

실행 증거:
- Browser: Playwright smoke with cached module `/home/ubuntu/.npm/_npx/eb7983f9b02fb67f/node_modules/playwright`
- Project: `smoke-118-final-1779965524954`
- Project directory: `/tmp/vn-maker-smoke-118-final-1779965524954.vnmaker`
- Flow: Studio open -> route context `haru-route` -> `분기 target 만들기` -> `DialogueBlock 본문` 입력 -> `배경` 연결 -> `엔딩 제목`/`엔딩 종류` 설정 -> `엔딩 적용` -> `저장` -> `검증` -> `Play Preview` -> `현재 씬에서 플레이`
- Result: preview route `/projects/smoke-118-final-1779965524954/preview?route=haru-route&scene=scene---1779965528721`

## Optional/Diagnostic Flow Evidence

- `생성 보조 / QA` drawer는 Validation tab 안에서 열렸고 primary authoring 영역 밖에 있었다.
- `목 재생` 버튼 실행 후 active badge selector `[data-generation-source-type="mockReplay"][aria-current="true"]`가 `목 replay`를 표시했다.
- `이벤트 로그 export` 후 이벤트 로그 ID가 표시되었고, `Phase 0 리포트`는 `Phase 0 판정` 결과를 계산했다.
- #120의 Studio Assets browser smoke가 `StudioAssetJobLifecycle`, planned job run, scene slot connection, `Audio unsupported` placeholder를 별도 보조 흐름으로 검증했다.

## Failure Path Evidence

- Browser stale validation: 저장 전 draft 변경 후 StagePreviewOverlay에 `validation stale`이 표시되었다.
- Browser save failure: `/api/project/studio/mutate`를 non-JSON 5xx로 응답시켰고 command bar가 `API 실패: 서버 응답을 해석하지 못했습니다.`를 표시했다.
- Automated coverage:
  - `tests/vn-maker-regression.test.mjs`: `STALE_PROJECT_REVISION`, repair stale before confirm, missing target, `PREVIEW_BLOCKED`, `background-required`, empty response, `NON_JSON_RESPONSE`, JSON 5xx retryability.
  - `tests/vn-maker-studio-contract.test.mjs`: Studio mutation stale revision contract.
  - `tests/vn-maker-alpha-shell.test.mjs`: dirty validation stale guard and stale DTO clearing source contracts.

## Keyboard And Accessibility Evidence

- `Ctrl+K`: active element became `루트 맵 씬 검색`.
- Route splitter: `aria-label="루트 맵 폭 조절"`, keyboard `ArrowRight` updated `aria-valuenow` from 300 to 324.
- Delete shortcut: selected scene delete confirmation opened with impact copy and was dismissed in the smoke.
- Buttons: command bar names `저장`, `검증`, `프리뷰`; Problems rows expose `ProblemRow ...` accessible names in source contract.
- Shared dialog focus/Escape handling remains centralized in `DeleteConfirmDialog.tsx` and covered by source-contract tests.

## Mock / Actual / Replay Separation

- Manual authoring is the primary flow and does not require natural-language patch, fixed prompt replay, or CG job execution.
- Generation diagnostics live in `생성 보조 / QA`; raw envelopes live under `원문 API envelope`, not in the Problems Panel.
- Current #118 smoke verified `mockReplay`; #117 verified actual patch, protocol replay, unavailable generation source badges, and event-log export separation.
- Reports distinguish actual browser execution, mock replay, and protocol replay. Mock evidence is never reported as actual model-quality success.

## UX Event Log Evidence

Project `smoke-118-final-1779965524954` produced:

| Event | Evidence |
| --- | --- |
| `started` | Studio mounted with local browser session. |
| `help_opened` | Validation/help recovery path opened. |
| `recipe_used`, `generated` | Fixed prompt replay path used as optional diagnostic flow. |
| `previewed` | Preview launched with selected `startSceneId`. |
| `repair_action_used` | missing-target repair diff requested and succeeded. |
| `repaired` | `create-target-scene` applied. |
| `undo_used` | Last repair was undone. |

The log included `preflightResult`, `issueCode`, `repairActionId`, `revisionBefore`, and `revisionAfter` where the event type requires them.

## Legacy-linear Reconciliation

legacy-linear #12-#16/#18/#19 remain separate legacy backlog records. They are not treated as active #108 child issues and were not closed by this gate. The active Studio UX completion set for this branch is #109-#121, with #118 as the final QA gate.

This avoids mixing older linear task state with the Project v2 child issue set while preserving the legacy records for a later owner decision.

## Verification Results

| Command | Result | Evidence |
| --- | --- | --- |
| `node tests/vn-maker-alpha-shell.test.mjs` | Passed | #118 QA document contract and Studio source contracts passed. |
| `npm run typecheck` | Passed | Legacy typecheck and maker package typechecks passed. |
| `npm run test:maker` | Passed | Maker build plus domain/use-case/web/source/UX quality suites passed. |
| Playwright smoke | Passed | Desktop 4 viewport, mobile unsupported, primary happy path, diagnostics, repair/undo, non-JSON 5xx failure path passed. |
| `git diff --check` | Passed | No whitespace errors. |
