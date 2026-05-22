# Issue 25 Preview / Export QA

## Browser Flow
| Viewport | Preview tab renders readiness | Export tab renders plan | Header/tab visible | Result |
| --- | --- | --- | --- | --- |
| 390x844 | pass | pass | pass | pass |
| 768x1024 | pass | pass | pass | pass |
| 1440x900 | pass | pass | pass | pass |

## Project
- Project ID: `issue-25-qa-20260522210902`
- Project directory: `/tmp/issue-25-qa-20260522210902.vnmaker`
- Preview URL: `/projects/issue-25-qa-20260522210902/preview`
- Export URL: `/projects/issue-25-qa-20260522210902/export`

## Checks
- The preview tab shows readiness, required data status, missing items, failure cause, retryability, next action, and the common header/tab bar note.
- The export tab shows local desktop web app target, core validation summary, included project data, included assets, blockers, failure cause, retryability, and the failed/blocked-not-complete note.
- Frontend API client source includes safe handling for empty responses, non-JSON responses, 5xx retryability, and network failures.
- Web/API/CLI happy path is covered by alpha sandbox tests; browser screenshots validate the rendered UI at mobile/tablet/desktop widths.

## Screenshots
- `/tmp/vn-maker-issue25-preview-export/preview-cli-390.png`
- `/tmp/vn-maker-issue25-preview-export/preview-cli-768.png`
- `/tmp/vn-maker-issue25-preview-export/preview-cli-1440.png`
- `/tmp/vn-maker-issue25-preview-export/export-cli-390.png`
- `/tmp/vn-maker-issue25-preview-export/export-cli-768.png`
- `/tmp/vn-maker-issue25-preview-export/export-cli-1440.png`
