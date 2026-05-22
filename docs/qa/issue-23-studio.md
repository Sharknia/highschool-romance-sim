# Issue 23 Studio QA

## Browser Flow
| Viewport | Final URL | Header/tab visible | No fake button/progress | Text fits | Console |
| --- | --- | --- | --- | --- | --- |
| 390x900 | `/projects/issue-22-qa-20260522191716/studio` | pass | pass | pass | pass |
| 768x900 | `/projects/issue-22-qa-20260522191716/studio` | pass | pass | pass | pass |
| 1440x950 | `/projects/issue-22-qa-20260522191716/studio` | pass | pass | pass | pass |

## Commands
- Dev server: `VN_MAKER_ALPHA_SANDBOX=1 npm run dev -w @vn-maker/web`
- Browser QA: Chromium CDP script at `390x900`, `768x900`, `1440x950`

## Checks
- `/projects/:projectId/studio` loads with the `제작` tab selected.
- The studio body shows `제작 탭은 준비 중입니다.` and future directions for `시나리오 작성`, `분기 편집`, and `장면 구성`.
- The studio body does not show `이벤트 제안 받기`, `제안 승인`, `가짜 진행`, `완료율`, or `제작 시작`.
- CDP QA reported no console errors, runtime page errors, or non-favicon HTTP errors.

## Screenshots
- `/tmp/vn-maker-issue23-studio/studio-390.png`
- `/tmp/vn-maker-issue23-studio/studio-768.png`
- `/tmp/vn-maker-issue23-studio/studio-1440.png`
