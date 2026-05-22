# Issue 22 Detail Tabs QA

## Browser Flow
| Viewport | Final URL | Detail before recent list | Tab switch retains header | Heroine labels visible | Background tab ready | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 390x900 | `/projects/issue-22-qa-20260522191716/overview` | pass | pass | pass | pass | pass |
| 768x900 | `/projects/issue-22-qa-20260522191716/overview` | pass | pass | pass | pass | pass |
| 1440x950 | `/projects/issue-22-qa-20260522191716/overview` | pass | pass | pass | pass | pass |

## Visual Checks
- Actual API setup: created heroine `issue-22-qa-20260522191716` and project `issue-22-qa-20260522191716` through the running alpha sandbox API.
- Detail route starts on the project detail panel before the recent-project list.
- Route-first screenshots were captured before calling `scrollIntoView`.
- Header density matches heroine detail page spacing and keeps the active tab badge compact.
- Tab labels, badges, and status text align without wrapping over neighboring tabs.
- Heroine tab exposes user-facing Korean labels: `원본 히로인 ID`, `스냅샷 생성 시각`, `프로젝트 캐릭터 ID`; internal labels such as `sourceHeroineId` are not shown.
- ArrowRight from heroine moves to `background`, where `배경 화면 및 CG 작업` and `배경 작업 준비` are visible.
- Primary overview buttons use the shared `Button` hierarchy.
- Status badges use existing detail/status classes rather than one-off styles.
- CDP QA reported no console errors, runtime page errors, or non-favicon HTTP errors.

## Commands
- Dev server: `VN_MAKER_ALPHA_SANDBOX=1 npm run dev -w @vn-maker/web`
- API setup: POST `/api/heroines/create`, POST `/api/projects/from-heroine`
- Browser QA: Chromium CDP script at `390x900`, `768x900`, `1440x950`

## Screenshots
- `/tmp/vn-maker-issue22-qa/route-first-overview-390.png`
- `/tmp/vn-maker-issue22-qa/detail-overview-390.png`
- `/tmp/vn-maker-issue22-qa/detail-heroine-390.png`
- `/tmp/vn-maker-issue22-qa/route-first-overview-768.png`
- `/tmp/vn-maker-issue22-qa/detail-overview-768.png`
- `/tmp/vn-maker-issue22-qa/detail-heroine-768.png`
- `/tmp/vn-maker-issue22-qa/route-first-overview-1440.png`
- `/tmp/vn-maker-issue22-qa/detail-overview-1440.png`
- `/tmp/vn-maker-issue22-qa/detail-heroine-1440.png`
