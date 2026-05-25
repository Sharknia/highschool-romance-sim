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
