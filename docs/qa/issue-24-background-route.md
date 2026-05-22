# Issue 24 Background Route QA

## Browser Flow
| Viewport | Direct `/projects/:projectId/background` | Reload stays on background | Tab click URL sync | Target project shown | Result |
| --- | --- | --- | --- | --- | --- |
| 390x844 | pass | pass | pass | pass | pass |
| 768x1024 | pass | pass | pass | pass | pass |
| 1440x900 | pass | pass | pass | pass | pass |

## Project
- Project ID: `issue-24-qa-20260522203516`
- Project directory: `/tmp/issue-24-qa-20260522203516.vnmaker`
- Final URL: `/projects/issue-24-qa-20260522203516/background`

## Checks
- The route opens directly on the `배경 화면 생성` tab.
- Reload keeps the `background` tab active.
- Clicking another tab and then `배경 화면 생성` updates the URL back to `/projects/:projectId/background`.
- The tab shows `대상 프로젝트`, project title/id, storage location, one-background limit, retry action, and `backgroundAssetId`/scene linkage.
- The desktop `1440x900` pass clicked `배경 생성` once under `VN_MAKER_ALPHA_SANDBOX=1`; this is a `목 테스트` browser happy path.
- Console errors, runtime page errors, and non-favicon HTTP errors: none.

## Screenshots
- `/tmp/vn-maker-issue24-background/background-390.png`
- `/tmp/vn-maker-issue24-background/background-768.png`
- `/tmp/vn-maker-issue24-background/background-1440.png`
