# UI/UX Audit Workflow

Use this reference when the user asks for a Notion planning document based on existing VN Maker screens or wants the previous UX/UI planning goal reproduced.

## Audit Steps

1. Create or reuse the GitHub Project #4 item and set it to in-progress.
2. Write a short plan before auditing. Include screens, viewport sizes, evidence to collect, and completion review criteria.
3. Run the app with the local sandbox when the request involves current UI behavior:

```bash
VN_MAKER_ALPHA_SANDBOX=1 npm run dev -w @vn-maker/web
```

4. Capture desktop and mobile evidence. Minimum viewports:
   - Desktop: `1440x900`
   - Mobile: `390x844`
   - Add tablet `768x1024` when layout density or tab behavior is part of the question.
5. Store screenshots under `artifacts/ux-ui-audit-YYYY-MM-DD/` when screenshots are produced.
6. Audit the relevant happy paths and state coverage:
   - Heroine list, detail, create, edit, delete, portrait generation.
   - Project list, create from heroine, detail entry, delete or restore.
   - Project detail tabs: overview, heroine, background, studio, preview, export.
   - Empty, loading, blocked, failed, stale, and success states when they exist.
   - Frontend API failure handling for empty, non-JSON, 4xx, 5xx, network error, and request cancellation when the request scope includes resilience.
7. Record evidence as file references, browser observations, screenshots, CLI/API output, or explicit blocked notes.
8. Map representative screenshots to the Notion sections they support. Do not leave screenshots only in artifacts without referencing them in the document.
9. Write the Notion planning document with `notion-planning-template.md`.
10. Review the document before final reporting:
    - It answers the user's original idea or audit request.
    - It separates user-facing UX problems from implementation tasks.
    - It distinguishes planning, mock checks, sandbox checks, and real execution.
    - It respects the VN Maker architecture and does not revive static GitHub Pages framing.
    - It contains acceptance criteria and implementation-ready work slices.
    - It names unresolved blockers instead of treating them as done.
11. Update the Project item with Notion URL, screenshots or evidence path, validation notes, blockers, and follow-up work.
12. Final-report only after the review is complete. Summarize the document content, not just the URL.

## Notion Evidence Block

Include this block or equivalent when screenshots or browser audit were part of the work:

```markdown
## 화면 근거

- 실행 환경:
- 데스크톱 캡처:
- 모바일 캡처:
- 태블릿 캡처:
- 대표 스크린샷 매핑:
- 실제 실행:
- 목 테스트:
- 확인하지 못한 항목:
```

## Common Failures

- Reporting "Notion created" without summarizing what the plan says.
- Skipping plan review before final report.
- Calling sandbox/mock image generation real Codex app-server success.
- Auditing only desktop and missing mobile density, CTA order, and overflowing text.
- Leaving Project item stale after the Notion page is updated.
