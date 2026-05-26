# Issue 88 Alpha API Fallback QA

## 요약

Issue #88은 설정 화면 연결 상태, 로그인 게이트 제거, 패키징 목 이미지 fallback, Web/CLI 공통 오케스트레이션, dummy UX, 문서 용어를 한 번에 회귀 검증한다.

## Actual Codex `imageGeneration`

현재 환경의 Codex app-server는 ChatGPT managed OAuth로 연결되어 있고 `imageGeneration` capability를 반환했다. 이 경로는 `목 테스트`가 아니다.

| 표면 | 결과 | 근거 |
| --- | --- | --- |
| CLI `codex-auth-status` | pass | `connected: true`, `mode: chatgpt`, `capabilities.imageGeneration: true` |
| CLI `generate-image` | pass | `provider: image-generation-adapter`, `dummy: false`, `assetSource: generated`, `sceneLinked: true`, `uriPrefix: data:image/png;base64` |
| Web API `/api/generation/images` | pass | `provider: image-generation-adapter`, `dummy: false`, `assetSource: generated`, `sceneLinked: true`, `session.connected: true` |

Actual CLI output was summarized to avoid printing the generated base64 image. The final CLI run wrote `/tmp/issue88-cli-actual-safe-v8ytDo/Issue88Actual.vnmaker/assets/generated/asset-issue-88-actual-cli-background.png`.

Actual API output was summarized the same way. The clean API run wrote `/tmp/issue88-api-actual-clean-Fpx0V2/Issue88ApiActual.vnmaker/assets/generated/asset-issue-88-actual-api-background.png`.

## 미연결 Fallback

The machine was already connected to Codex, so the global auth state was not mutated. Instead, verification used a temporary fake `codex` binary under `/tmp/issue88-fallback-entrypoints-0JbNX2/fake-codex-bin` that returns `account: null` from `account/read`. This is an entrypoint regression test for the disconnected app-server response, not an actual logout.

| 표면 | 결과 | 근거 |
| --- | --- | --- |
| CLI `generate-image` | pass | `dummy: true`, `provider: mock-image-pack-adapter`, `fallbackReason: OAUTH_REQUIRED`, `assetSource: mock`, `sceneLinked: true` |
| Web API `/api/generation/images` | pass | `dummy: true`, `provider: mock-image-pack-adapter`, `fallbackReason: OAUTH_REQUIRED`, `assetSource: mock`, `sceneLinked: true` |

This confirms Web and CLI share the same packaged fallback orchestration instead of separate fallback behavior.

## Browser QA

Browser QA ran with `VN_MAKER_ALPHA_SANDBOX=1`, so image generation in this section is `목 테스트`. It verifies UI flow, dummy/fallback display, preview, export, routing, and responsive layout.

| Viewport | Routes checked |
| --- | --- |
| 390x844 | `/settings`, `/projects/:projectId/background`, `/projects/:projectId/preview`, `/projects/:projectId/export` |
| 768x1024 | `/settings`, `/projects/:projectId/background`, `/projects/:projectId/preview`, `/projects/:projectId/export` |
| 1440x900 | `/settings`, `/projects/:projectId/background`, `/projects/:projectId/preview`, `/projects/:projectId/export` |

Flow result:

- `/settings` loaded without redirecting to a login gate.
- Background replacement generation displayed dummy fallback UI with `목 이미지`.
- Preview completed with the dummy asset included.
- Export completed with smoke checks passing after the background visual smoke fix.
- Console errors: 0.
- Page errors: 0.
- Screenshots: `/tmp/issue88-browser-qa-et3Hpd/screenshots` (12 viewport route captures plus 3 flow captures).

## 발견한 회귀와 수정

During browser export QA, export initially failed with `export smoke check failed: cg`. The project had a generated background visual but no scene-level CG asset, and the legacy smoke key named `cg` only accepted `scene.cgAsset.uri`.

수정:

- `smokeTestWebExport()` now treats either `scene.cgAsset.uri` or `scene.backgroundAsset.uri` as a valid visual asset for the legacy `cg` smoke key.
- `tests/vn-maker-use-cases.test.mjs` now verifies starter background replacement can export successfully and keep `smoke.checks.cg === true`.

## 문서 정합성

갱신:

- `docs/vn-maker-toolkit.md`: settings-based Codex connection, ChatGPT managed OAuth, actual `imageGeneration`, packaged mock fallback, dummy/provenance fields, and alpha sandbox as `목 테스트`.
- `docs/architecture-decisions.md`: core architecture wording now uses `Codex ChatGPT OAuth`.

용어 확인:

- API key flow is not described as Codex OAuth login.
- `/api/codex/login` is documented as settings connection start, not an app entry gate.
- Actual Codex `imageGeneration`, packaged fallback, and alpha sandbox `목 테스트` are separated.

## 검증 명령

| 명령 | 결과 |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run test:maker` | pass |
| `npm run build -w @vn-maker/project-store && node tests/vn-maker-use-cases.test.mjs` | pass |
| `git diff --check` | pass |

