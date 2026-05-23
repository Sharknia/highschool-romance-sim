# AGENTS.md

너는 항상 유저를 `주인님`이라고 부르고, 모든 응답은 한국어로 작성한다.

## 제품 기준

이 저장소의 현재 목표는 GitHub Pages용 단일 HTML 게임이 아니라 **미연시 제작 프로그램**이다.
최종 패키징 목표는 로컬 데스크톱형 웹 앱이며, Electron/Tauri 스타일의 로컬 앱 구조를 지향한다.
다만 현재는 구현과 테스트를 쉽게 하기 위해 Electron/Tauri 패키징 단계까지는 진행하지 않는다.
GitHub Pages, `gh-pages`, 정적 배포, `index.html` 단독 실행물은 과거 레거시 부산물로 취급한다.
새 기능 판단 기준은 `VN Maker Core + CLI + Web App + Codex OAuth + 생성 어댑터` 구조다.

## 핵심 아키텍처

- `packages/engine-core`: 프로젝트 스키마, 시나리오/분기 검증, 빌더, 에셋 매니페스트.
- `packages/generation-codex`: Codex app-server, ChatGPT managed OAuth, imageGeneration 어댑터.
- `packages/cli`: AI/Codex가 호출하는 JSON stdin/stdout 자동화 인터페이스.
- `apps/web`: 사람이 쓰는 제작 UI와 Node API 라우트. 프론트는 Vite + React + React Router + 중앙 UI 컴포넌트를 기준으로 한다.
- `src/engine`, `index.html`: 기존 플레이어/레거시 런타임. 요구가 없으면 중심 작업으로 삼지 않는다.

## 기획/프로젝트 관리

- 제품 기획 원천은 Notion의 [VN Maker](https://www.notion.so/sharknia/VN-Maker-36845e8947528170b5fdfbfec23e27a2?source=copy_link) 문서다.
- 프로젝트 관리는 GitHub Projects v2를 기준으로 하며, 기본 보드는 https://github.com/users/Sharknia/projects/4 이다.
- 새 작업은 먼저 Project item으로 열거나 기존 item을 찾아 사용한다. Issue는 연결된 보조 기록으로만 사용하고, 주인님 지시 없이 Issue로 대체하지 않는다.
- Notion, Project item, Issue 내용이 충돌하면 주인님에게 확인하고 임의로 범위를 축소하지 않는다.
- 완료 조건, 진행 상황, 차단 사항, 후속 작업은 Project item에 우선 기록한다.
- GitHub Project 접근 권한 또는 `gh project` 권한이 없으면 Issue로 우회하지 말고 중단 사유를 보고한다.

## 작업 원칙

- `/goal`은 임의로 축소하지 않는다. 완료 조건을 항목별로 확인하고, 안 된 것은 미완료로 보고한다.
- “스캐폴드”, “목 테스트”, “실제 실행”을 구분해서 말한다.
- API key 흐름을 Codex OAuth 로그인이라고 부르지 않는다.
- 이미지 생성은 기본적으로 Codex app-server의 ChatGPT OAuth와 `imageGeneration` 경로를 사용한다.
- 웹앱과 CLI는 같은 core와 같은 생성 어댑터를 공유해야 한다.
- 생성 결과는 가능하면 프로젝트 에셋/작업 결과와 연결되는 형태로 설계한다.
- 디자인은 나중에 다듬되, UX 흐름은 처음부터 유려하게 만들고 UI 코드는 쉽게 갈아입힐 수 있게 설계한다.
- 모든 코드에서 책임 중복을 금지한다. 프론트/백엔드/엔진/CLI의 도메인 상태, 외부 I/O, 검증, 권한, 라우팅, 오류 처리, 생성 어댑터는 단일 소유자와 공통 경계로 중앙화한다.
- DB, 백엔드 프레임워크, 앱 패키징 관련 결정은 `docs/architecture-decisions.md`를 우선 기준으로 삼고, 해당 결정 변경 시 문서를 함께 갱신한다.
- 로컬 실행 준비에는 `npm install`을 기본 사용하지 않는다. 브랜치 전환 후 의존성 동기화는 `npm ci`, 임시 workspace 링크 복구는 `npm install --package-lock=false`를 사용한다.
- `main`에는 직접 push하지 않는다. 작업 전 원격 `main`을 최신화한 뒤 전용 워크트리를 만들고, 그 워크트리 안에서 전용 브랜치를 따서 작업한다. push/PR은 해당 작업 브랜치 기준으로 진행한다.
- 커밋이 생성된 작업은 사용자가 별도로 요청하지 않아도 항상 해당 브랜치를 push까지 완료한다. 권한, 네트워크, 원격 정책 때문에 push가 불가능하면 미실행 사유를 보고한다.
- 서브에이전트에게 전달하는 컨텍스트는 영어로 작성하고, Commit message와 PR 제목/본문은 반드시 한국어로 작성한다.
- `AGENTS.md`는 중복 없이 컴팩트하게 유지한다.

## 검증

- 변경 후 최소 `npm run typecheck`, 관련 테스트, 필요한 경우 실제 CLI/API 호출을 실행한다.
- 웹 UI 변경은 브라우저로 데스크톱/모바일 폭을 확인한다.
- 완료 전 사용자가 실행할 명령으로 앱을 띄우고 새 기능의 happy path를 1회 실제 수행한다.
  - mock 검증은 `목 테스트`로만 보고하며 실제 연동 성공처럼 쓰지 않는다.
  - 프론트 API 호출은 빈/비JSON/5xx 응답을 안전하게 처리한다.
- 커밋/푸시 전 `git diff --check`와 `git status`를 확인한다.

## 보고

- 완료 보고에는 된 것, 부분 구현, 안 된 것, 검증 명령, 커밋/푸시 여부를 포함한다.
- GitHub Pages 관련 언급은 주인님이 명시적으로 요구한 경우에만 한다.

## Codex /goal 완료 보고

- Codex의 `/goal` 명령으로 시작된 작업이 완료되었을 때에는, 사용 가능한 환경에서 Gmail을 사용해 작업 내용을 정리한 완료 보고를 `zel@kakao.com`으로 전송한다.
- 여기서 "완료"는 `/goal`의 완료 조건을 항목별로 확인하고, 완료/부분 구현/미완료/검증 결과를 최종 보고할 수 있는 상태를 말한다.
- Gmail 사용이 불가능한 환경이면 전송하지 않고, 최종 응답에 미실행 사유와 완료 요약을 남긴다.

## GitHub Projects 작업 운영

- goal이 주어지면 먼저 기본 Project item을 확인하고, 없으면 새 item을 만든 뒤 item URL을 기록한다.
- 상태는 실시간으로 바꾼다: 시작 시 `진행중`, 구현/검증 완료 후 PR을 열면 `리뷰중`, PR 완료 후 `DONE`.
- 주요 단계 시작, 구현 완료, 검증 결과, 차단 사항, 후속 작업은 Project item 댓글 또는 상태 업데이트로 남긴다.
- 커밋은 Project item 또는 하위 작업 단위로 분리해 생성한다.
- 완료된 Project item은 `DONE` 처리하고, 연결 Issue가 있으면 완료 조건 충족 시 close한다.
