---
name: decompose-plan-to-github-project
description: Use when a user provides a planning, PRD, design, UX/UI, product, roadmap, or Notion document and asks to break it into GitHub Project items, parent or child issues, sub-issues, tasks, dependencies, or implementation-ready work.
---

# Decompose Plan To GitHub Project

## Core Rule

Convert a source planning document into implementable GitHub Project work. The tracking unit is the GitHub Project item first; Issues are supporting records connected to that Project item. Do not edit product code while doing breakdown work.

## Access Gate

1. Identify the source document, repository, Project owner, and Project number or URL.
2. Verify GitHub Project access before creating Issues. Use the available GitHub app, `gh project`, or GraphQL to list fields/items and confirm write access.
3. If Project access or `gh project` permission is missing, stop and report the blocker. Do not create standalone Issues as a fallback.
4. If the source document, Project item, and existing Issues conflict, ask the user before narrowing scope.

## Workflow

1. Read the planning document first, then repository instructions such as `AGENTS.md`, product docs, existing plans, and relevant Project items.
2. Extract improvement axes, excluded scope, preserved user flows, affected screens, acceptance signals, screenshots, and dependencies.
3. Search the target GitHub Project for related items using the document title, feature names, screen names, and likely parent titles.
4. Reuse a matching parent Project item when it exists. Otherwise create one. When child/sub-issue relationships are required, the parent must be an issue-backed Project item: create or reuse the parent Issue, add it to the Project, confirm the Project item URL, and only then create child Issues.
5. Break work into cohesive implementation slices. Keep UI consistency work together when splitting smaller would create duplicate styling or conflicting UX decisions.
6. For each child task, create an Issue, add it to the Project, set status to Todo unless instructed otherwise, and connect it to the parent Issue when the tool supports parent/sub-issue relationships.
7. If native parent/sub-issue support is unavailable, put parent links, child links, and dependency links in Issue bodies and a parent Project item comment.
8. Record work order and dependency rationale on the parent Project item or parent Issue, including a dependency map with `Predecessor | Successor | Reason`.
9. Finish with the parent Project item URL, parent Issue URL when used, child Issue URLs, created/reused status, work order, blockers, verification commands, and confirmation that product code was not changed.

## Issue Body Template

Use the user's language for all titles, bodies, and comments unless repository instructions say otherwise.

```markdown
## 목적
[사용자 또는 팀이 이 작업으로 해결할 문제]

## 범위
[화면, 컴포넌트, 상태, UX 변경, 관련 시스템/모듈/API 경계 등 구현할 것]

## 제외 범위
[이번 이슈에서 하지 않을 작업과 명시적으로 제외된 배포/레거시/리팩터링 범위]

## 수용 기준
- [UI 작업이면 데스크톱에서 확인 가능한 사용자 상태/행동]
- [UI 작업이면 모바일 또는 좁은 폭에서 확인 가능한 사용자 상태/행동]
- [비 UI 작업이면 CLI/API/데이터/운영 흐름에서 확인 가능한 동작]
- [기존 기능과 사용자 흐름 유지 조건]
- [오류/빈 상태/로딩 상태 등 필요한 상태 검증]

## 참고 근거
- 기획 문서: [URL]
- 참고 화면/스크린샷: [파일명 또는 없음]
- 관련 코드 경로: [명확할 때만 작성]

## 의존성
- 선행: [없음 또는 이슈 링크]
- 후행: [없음 또는 이슈 링크]
```

## Dependency Map

Add a compact dependency map to the parent Project item or parent Issue whenever there are two or more child Issues.

```markdown
| Predecessor | Successor | Reason |
| --- | --- | --- |
| #[issue] | #[issue] | [why the successor should wait] |
```

## Breakdown Heuristics

- Split by user-facing screen, shared component boundary, or end-to-end workflow.
- Keep each Issue independently reviewable and testable.
- Avoid one Issue per tiny visual tweak unless the tweak belongs to a shared design system task.
- Separate design tokens/shared components from screen adoption when adoption spans many screens.
- Preserve existing behavior unless the source document explicitly changes it.
- Treat screenshots and raw diagnostics as evidence, not implementation scope, unless the document asks to expose them.

## Verification

Run read-only or tracking verification after creation:

- `gh project item-list` or equivalent Project query confirms parent and child items are in the Project.
- `gh issue view` or equivalent issue query confirms body sections, links, and dependencies.
- `git status --short` confirms no product code was modified.

If any command cannot run, report the exact missing permission, command, or connector instead of implying completion.
