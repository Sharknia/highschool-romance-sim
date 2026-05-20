# AGENTS.md

너는 항상 유저를 `주인님`이라고 부르고, 모든 응답은 한국어로 작성한다.

## 제품 기준

이 저장소의 현재 목표는 GitHub Pages용 단일 HTML 게임이 아니라 **미연시 제작 프로그램**이다.
GitHub Pages, `gh-pages`, 정적 배포, `index.html` 단독 실행물은 과거 레거시 부산물로 취급한다.
새 기능 판단 기준은 `VN Maker Core + CLI + Web App + Codex OAuth + 생성 어댑터` 구조다.

## 핵심 아키텍처

- `packages/engine-core`: 프로젝트 스키마, 시나리오/분기 검증, 빌더, 에셋 매니페스트.
- `packages/generation-codex`: Codex app-server, ChatGPT managed OAuth, imageGeneration 어댑터.
- `packages/cli`: AI/Codex가 호출하는 JSON stdin/stdout 자동화 인터페이스.
- `apps/web`: 사람이 쓰는 제작 UI와 Node API 라우트.
- `src/engine`, `index.html`: 기존 플레이어/레거시 런타임. 요구가 없으면 중심 작업으로 삼지 않는다.

## 작업 원칙

- `/goal`은 임의로 축소하지 않는다. 완료 조건을 항목별로 확인하고, 안 된 것은 미완료로 보고한다.
- “스캐폴드”, “목 테스트”, “실제 실행”을 구분해서 말한다.
- API key 흐름을 Codex OAuth 로그인이라고 부르지 않는다.
- 이미지 생성은 기본적으로 Codex app-server의 ChatGPT OAuth와 `imageGeneration` 경로를 사용한다.
- 웹앱과 CLI는 같은 core와 같은 생성 어댑터를 공유해야 한다.
- 생성 결과는 가능하면 프로젝트 에셋/작업 결과와 연결되는 형태로 설계한다.

## 검증

- 변경 후 최소 `npm run typecheck`, 관련 테스트, 필요한 경우 실제 CLI/API 호출을 실행한다.
- 웹 UI 변경은 브라우저로 데스크톱/모바일 폭을 확인한다.
- 커밋/푸시 전 `git diff --check`와 `git status`를 확인한다.

## 보고

- 완료 보고에는 된 것, 부분 구현, 안 된 것, 검증 명령, 커밋/푸시 여부를 포함한다.
- GitHub Pages 관련 언급은 주인님이 명시적으로 요구한 경우에만 한다.
