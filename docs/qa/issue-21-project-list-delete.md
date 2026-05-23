# Issue 21 Project List QA

실행 환경:
- Dev server: `VN_MAKER_ALPHA_SANDBOX=1 npm run dev -w @vn-maker/web`
- Browser verification: `npx playwright screenshot` + Chromium CDP smoke checks
- `agent-browser` CLI는 현재 환경에서 설치되어 있지 않아 Playwright/Chromium CDP로 대체했다.
- Seed project: `/tmp/vn-maker-qa-project-NcAfbN.vnmaker`, projectId `qa-issue21`

## Viewports
| Width | `/projects` | `/heroines` comparison | Result |
| --- | --- | --- | --- |
| 390x844 | `/tmp/vn-maker-issue21-qa/projects-390-final.png` | `/tmp/vn-maker-issue21-qa/heroines-390-final.png` | pass |
| 768x1024 | `/tmp/vn-maker-issue21-qa/projects-768-final.png` | `/tmp/vn-maker-issue21-qa/heroines-768-final.png` | pass |
| 1440x900 | `/tmp/vn-maker-issue21-qa/projects-1440-final.png` | `/tmp/vn-maker-issue21-qa/heroines-1440-final.png` | pass |

## Required Checks
- pass: Project list cards use `ContentList` density like heroine list.
- pass: Loading, empty, error, and success states are represented in source/tests; success state was visually checked in all viewports.
- pass: Every project card shows 저장 위치, 현재 상태, 상태 요약, 최근 수정, and 마지막 작업 시각.
- pass: `상세보기 버튼` is the primary visible action.
- pass: Delete action is visually lower priority behind the menu, keyboard reachable, and opens the shared confirmation dialog.
- pass: Mobile project controls measured at minimum 40px high; delete summary measured 44px high.
- pass: Long titles and project directories wrap within the card bounds at 390px, 768px, and 1440px.
- pass: Focus moves into the delete dialog input and returns to the triggering delete control after Escape close.
- pass: Browser runtime console had no errors; the only HTTP 404 observed was `http://127.0.0.1:5173/favicon.ico`.

## CDP Evidence
- Field layout: `.recent-project-field` computed `display: block`; field top positions increased line by line.
- Focus: delete dialog `role="dialog"` opened, active element was the 프로젝트 제목 input, Escape closed the dialog, active element returned to the delete trigger.
- Mobile touch sample: 새 프로젝트 만들기 40px, 새로고침 40px, 상세보기 40px, 재연결 40px, 삭제 메뉴 44px, 삭제 40px.
