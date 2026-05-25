# Project Notion UI/UX Planner Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repository-scoped Codex skill that turns the user's product or feature idea into a Notion UI/UX planning document for VN Maker.

**Architecture:** Store the skill under `.codex/skills/vn-maker-notion-uiux-planner` so it is versioned with this project, not installed as a global personal skill. Keep `SKILL.md` focused on invocation, workflow, project rules, and reporting, and put the reusable planning document structure in `references/notion-planning-template.md`.

**Tech Stack:** Codex Skills (`SKILL.md`, `agents/openai.yaml`, `references/`), GitHub Projects v2 via `gh project`, Notion connector instructions, repository docs in `AGENTS.md` and `docs/vn-maker-toolkit.md`.

---

### Task 1: Initialize the Project Skill Skeleton

**Files:**
- Create: `.codex/skills/vn-maker-notion-uiux-planner/SKILL.md`
- Create: `.codex/skills/vn-maker-notion-uiux-planner/agents/openai.yaml`
- Create: `.codex/skills/vn-maker-notion-uiux-planner/references/`

- [ ] **Step 1: Run the skill initializer**

Run:

```bash
python /data/system/codex-home-new/skills/.system/skill-creator/scripts/init_skill.py vn-maker-notion-uiux-planner --path .codex/skills --resources references --interface display_name="VN Maker Notion UI/UX Planner" --interface short_description="Draft VN Maker UI/UX plans in Notion" --interface default_prompt='Use $vn-maker-notion-uiux-planner to turn my VN Maker idea into a Notion UI/UX planning document.'
```

Expected: `.codex/skills/vn-maker-notion-uiux-planner` exists with `SKILL.md`, `agents/openai.yaml`, and `references/`.

- [ ] **Step 2: Verify skeleton files**

Run:

```bash
find .codex/skills/vn-maker-notion-uiux-planner -maxdepth 3 -type f -print | sort
```

Expected:

```text
.codex/skills/vn-maker-notion-uiux-planner/SKILL.md
.codex/skills/vn-maker-notion-uiux-planner/agents/openai.yaml
```

### Task 2: Write the Skill Workflow

**Files:**
- Modify: `.codex/skills/vn-maker-notion-uiux-planner/SKILL.md`

- [ ] **Step 1: Replace `SKILL.md` with repository-specific instructions**

Write `SKILL.md` with this content:

```markdown
---
name: vn-maker-notion-uiux-planner
description: Create or update Notion UI/UX planning documents for this VN Maker repository when the user describes a product idea, feature idea, UX improvement, screen flow, maker workflow, or asks Codex to turn an idea into a planning document. Use for project-scoped planning work that should respect AGENTS.md, GitHub Projects #4, the VN Maker Core + CLI + Web App + Codex OAuth + generation adapter architecture, and Notion as the planning source of truth.
---

# VN Maker Notion UI/UX Planner

## Workflow

1. Read the local project rules first: `AGENTS.md`, then `docs/vn-maker-toolkit.md`, and `docs/architecture-decisions.md` only if DB, backend, packaging, or app-shell decisions are involved.
2. Use GitHub Project #4 before writing the document. Find a matching item or create a draft item; do not substitute an Issue unless the user explicitly asks for it.
3. Treat the user's idea as a planning request, not an implementation request. Do not edit app code unless the user separately asks for implementation.
4. If the idea is underspecified, make conservative product assumptions and record them in the Notion document. Ask the user only when a missing decision changes the product direction or architecture boundary.
5. Gather evidence from the repo when the plan touches existing UI or flows. Prefer `rg`, targeted file reads, and browser screenshots when visual audit is part of the request.
6. Write the Notion document under the VN Maker planning context. Use the template in `references/notion-planning-template.md`.
7. Keep the document implementation-ready: include goals, non-goals, user journey, information architecture, screen states, data/API boundaries, generation behavior, acceptance criteria, validation plan, risks, and follow-up work.
8. Update the Project item with the Notion URL, progress, blockers, and verification notes.
9. Report in Korean to `주인님` with what was created, what is partial, what was not done, validation performed, and whether any commit/push happened.

## Project Rules

- Use the product frame from this repository: VN Maker is a local desktop-style web app, not a single static GitHub Pages game.
- Preserve the architecture boundary: `engine-core` owns schema and validation, `use-cases` owns workflow orchestration, `generation-codex` owns Codex app-server and ChatGPT managed OAuth generation, `cli` owns JSON stdin/stdout automation, and `apps/web` owns human maker UI and Node API routes.
- Do not call an API key flow "Codex OAuth login".
- Treat image generation as Codex app-server ChatGPT OAuth with the `imageGeneration` path unless the user explicitly chooses a different future architecture.
- Separate UX planning evidence from implementation status. Label mock checks as mock checks and real CLI/API/browser execution as real execution.

## Notion Output

Load `references/notion-planning-template.md` before drafting the Notion document.

For small ideas, keep the Notion document compact but preserve the section order. For large ideas, split implementation work into GitHub Project items after the plan is approved or when the user asks.
```

- [ ] **Step 2: Check frontmatter trigger coverage**

Run:

```bash
sed -n '1,80p' .codex/skills/vn-maker-notion-uiux-planner/SKILL.md
```

Expected: frontmatter has only `name` and `description`, and the description covers Notion planning, UI/UX planning, user ideas, and this repository's architecture.

### Task 3: Add the Notion Planning Template Reference

**Files:**
- Create: `.codex/skills/vn-maker-notion-uiux-planner/references/notion-planning-template.md`

- [ ] **Step 1: Create the reusable template**

Write `references/notion-planning-template.md` with this content:

```markdown
# Notion Planning Template

Use this structure when creating or updating a Notion planning document for VN Maker. Keep headings in Korean unless the user asks otherwise.

## Document Shape

# [기능/흐름 이름] UI/UX 기획서

## 1. 기획 요약
- 한 문장 목표
- 대상 사용자
- 사용자가 얻게 되는 결과
- 현재 확정/가정/미정 구분

## 2. 문제와 기회
- 사용자가 지금 겪는 문제
- 기존 화면 또는 흐름이 있다면 관찰 근거
- 제품 기준과 충돌하는 레거시 해석
- 이번 기획으로 해결하지 않는 것

## 3. 사용자 여정
- 진입 전 맥락
- 첫 화면에서 이해해야 하는 것
- 주요 행동 순서
- 성공 상태
- 실패/빈/차단/로딩 상태
- 다시 돌아왔을 때 복원되어야 하는 것

## 4. 정보 구조와 화면 흐름
- IA 또는 탭/페이지 구조
- 화면별 책임
- primary action과 secondary action
- 위험 행동의 확인 방식
- 모바일과 데스크톱에서 우선순위가 달라지는 부분

## 5. 화면별 UX 요구사항
For each screen or state:
- 목적
- 표시 정보
- 사용 가능 액션
- 차단 사유와 복구 액션
- 오류 문장
- 빈 상태 문장
- 모바일 주의점

## 6. 도메인과 데이터 경계
- `engine-core` 책임
- `use-cases` 책임
- `generation-codex` 책임
- `cli` 책임
- `apps/web` 책임
- 프론트가 중복 판단하면 안 되는 규칙

## 7. 생성과 에셋 연결
- Codex app-server ChatGPT OAuth 필요 여부
- `imageGeneration` 사용 여부
- 생성 결과가 프로젝트 에셋, 작업 결과, 씬, 히로인, 배경 중 어디에 연결되는지
- 목 테스트와 실제 실행을 구분해야 하는 검증 지점

## 8. 수용 기준
- 사용자가 완료할 수 있는 happy path
- 차단/오류/빈 상태 기준
- 반응형 기준
- 접근성 또는 문구 기준
- 회귀하면 안 되는 레거시 흐름

## 9. 구현 작업 분해
- Project item 또는 Issue로 분리할 단위
- 선행 관계
- 각 작업의 완료 조건
- 검증 명령 또는 브라우저 QA

## 10. 리스크와 미정 사항
- 제품 결정이 필요한 사항
- 기술 결정이 필요한 사항
- 실제 연동 검증이 필요한 사항
- 후속 기획으로 넘길 사항

## Evidence Rules

- Existing UI claims need file references, screenshots, browser observations, or Notion/GitHub Project references.
- Do not report mock generation, mocked API responses, or sandbox data as real Codex app-server success.
- If Notion, GitHub Project, CLI, API, or browser access is unavailable, write the planning document as far as possible and record the blocked step explicitly.
```

- [ ] **Step 2: Check template completeness**

Run:

```bash
rg -n "Codex app-server|imageGeneration|engine-core|수용 기준|리스크" .codex/skills/vn-maker-notion-uiux-planner/references/notion-planning-template.md
```

Expected: each key planning concern appears in the template.

### Task 4: Validate and Review the Skill

**Files:**
- Validate: `.codex/skills/vn-maker-notion-uiux-planner/SKILL.md`
- Validate: `.codex/skills/vn-maker-notion-uiux-planner/agents/openai.yaml`
- Validate: `.codex/skills/vn-maker-notion-uiux-planner/references/notion-planning-template.md`

- [ ] **Step 1: Run the skill validator**

Run:

```bash
python /data/system/codex-home-new/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/vn-maker-notion-uiux-planner
```

Expected: validation passes.

- [ ] **Step 2: Self-review the skill against the request**

Check:

```bash
rg -n "Notion|UI/UX|Project #4|AGENTS.md|VN Maker|주인님|imageGeneration|목 테스트|실제 실행" .codex/skills/vn-maker-notion-uiux-planner
```

Expected: the skill explicitly covers project-scoped Notion UI/UX planning, repository rules, Korean reporting, mock vs real execution, and generation boundaries.

- [ ] **Step 3: Remove template placeholders**

Run:

```bash
rg -n "TODO|TBD|fill in|placeholder|Replace" .codex/skills/vn-maker-notion-uiux-planner
```

Expected: no matches.

### Task 5: Repository Verification, Commit, and Project Update

**Files:**
- Modify: Project item `PVTI_lAHOAylLDM4BYfrWzgtwCE8`
- Commit: `.codex/skills/vn-maker-notion-uiux-planner/**`
- Commit: `docs/superpowers/plans/2026-05-25-project-notion-uiux-planner-skill.md`

- [ ] **Step 1: Run repository verification**

Run:

```bash
npm run typecheck
```

Expected: typecheck passes. If it fails for unrelated baseline reasons, capture the exact failure and do not report it as passing.

- [ ] **Step 2: Check whitespace and status**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` passes and status shows only the planned skill and plan files.

- [ ] **Step 3: Commit in Korean**

Run:

```bash
git add .codex/skills/vn-maker-notion-uiux-planner docs/superpowers/plans/2026-05-25-project-notion-uiux-planner-skill.md
git commit -m "프로젝트 전용 Notion UI/UX 기획 스킬 추가"
```

Expected: commit succeeds.

- [ ] **Step 4: Push the branch**

Run:

```bash
git push -u origin chore/project-uiux-planner-skill
```

Expected: branch is pushed to origin. If push is blocked by credentials or remote policy, report the reason.

- [ ] **Step 5: Update the Project item**

Update Project item `PVTI_lAHOAylLDM4BYfrWzgtwCE8` with:

```markdown
## 진행 기록
- 계획 작성 및 자체 리뷰 완료: `docs/superpowers/plans/2026-05-25-project-notion-uiux-planner-skill.md`
- 구현 완료: `.codex/skills/vn-maker-notion-uiux-planner`
- 검증: skill quick_validate, `npm run typecheck`, `git diff --check`, `git status`
- 브랜치: `chore/project-uiux-planner-skill`
```

Set Status to `Done` only after validation and push finish.

---

## Self-Review

Spec coverage: 이 계획은 개인 글로벌 스킬이 아니라 저장소 내부 `.codex/skills`에 프로젝트 전용 스킬을 만드는 요구를 다룬다. 구현 전 계획 작성, 리뷰, 스킬 완성 판단, 최종 보고, Project item 사용, 커밋/푸시 검증까지 포함한다.

Placeholder scan: `TODO`, `TBD`, `fill in`, `implement later` 같은 미완성 지시를 사용하지 않았다. 템플릿의 빈 항목은 Notion 문서 작성 시 채워야 하는 구조로, 구현 계획의 미완성 표기가 아니다.

Type consistency: 스킬 이름은 모든 경로와 frontmatter에서 `vn-maker-notion-uiux-planner`로 통일했다. Project item ID는 현재 생성된 `PVTI_lAHOAylLDM4BYfrWzgtwCE8`을 사용한다.
