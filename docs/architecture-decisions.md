# Architecture Decisions

이 문서는 VN Maker 제작 프로그램으로 전환하기 위한 현재 아키텍처 결정을 기록한다.

## 현재 기준

- 제품 목표는 GitHub Pages용 단일 HTML 게임이 아니라 로컬 데스크톱형 미연시 제작 프로그램이다.
- 중심 구조는 `VN Maker Core + CLI + Web App + Codex ChatGPT OAuth + 생성 어댑터`다.
- 프론트, 백엔드, 엔진, CLI의 도메인 상태, 외부 I/O, 검증, 권한, 라우팅, 오류 처리, 생성 어댑터는 단일 소유자와 공통 경계로 중앙화한다.

## 아키텍처 리뷰 기준

이 프로젝트의 리팩토링 방향은 반복을 줄이고 도메인 규칙을 중심으로 묶는 DDD Lite를 지향한다. 과한 계층화로 코드가 길어지는 구조는 피하되, 확장에 열려 있고 유지보수가 쉬우며 테스트와 AX가 쉬운 반복 구조를 우선한다.

1. 도메인 규칙은 `engine-core` 또는 해당 도메인 패키지에 둔다.
2. 웹, CLI, API는 직접 도메인 결정을 만들지 않는다.
3. 외부 입력은 DTO schema로 검증한다.
4. DB 접근은 `project-store`만 소유한다.
5. 생성 provider 세부사항은 generation adapter 밖으로 새지 않는다.
6. 공통 use case는 웹과 CLI가 같이 쓴다.
7. 추상화는 세 번째 반복 또는 명확한 정책 중복이 보일 때 도입한다.
8. 테스트는 순수 도메인 함수부터 빠르게 붙인다.

## 결정 1: 프로젝트 저장소

**선택:** SQLite + 파일시스템 에셋 저장소.

```txt
MyGame.vnmaker/
  project.sqlite
  assets/
    source/
    generated/
  exports/
  cache/
```

`project.sqlite`는 시나리오, 캐릭터, 씬, 분기, 검증 결과, 생성 작업, 에셋 manifest를 소유한다. 이미지, 오디오, 대형 생성 결과물은 DB에 BLOB로 저장하지 않고 파일로 저장한다. DB에는 상대 경로, 해시, mime, 크기, 생성 작업 id, adapter, prompt hash, mock/dummy provenance 같은 메타데이터만 저장한다.

패키징된 목 이미지 fallback은 `packages/generation-codex/mock-image-pack` 아래의 manifest와 PNG/WebP 파일로 둔다. core는 pack schema와 provenance 검증만 소유하고, generation adapter는 해당 pack 파일 경로를 해석해 프로젝트 `assets/generated` 또는 project-store 관리 경로로 복사/링크하는 책임을 가진다. alpha sandbox fixture, 패키징 목 이미지 fallback, 실제 Codex `imageGeneration` 성공은 generation job provider와 provenance로 구분한다.

**이유:** SQLite는 로컬 단일 사용자 제작툴, CLI 자동화, 작업 큐, 검색, 검증 결과 저장에 충분한 트랜잭션과 쿼리 능력을 제공한다. JSON 파일은 export/import와 AI 리뷰용 스냅샷으로 유지하되 canonical storage로 쓰지 않는다.

## 결정 2: DB 접근 경계

**선택:** `packages/project-store`를 새 단일 소유자로 둔다.

`packages/project-store`는 SQLite schema, migrations, repositories, transactions, import/export, backup을 소유한다. `apps/web`, `packages/cli`, `packages/generation-codex`는 직접 SQL을 갖지 않고 이 패키지를 통해 접근한다. `packages/engine-core`는 계속 순수 스키마, 검증, 빌더 역할을 유지한다.

초기 쿼리 계층은 `better-sqlite3 + Kysely`를 우선 후보로 둔다. Electron 런타임과 `node:sqlite` 안정성이 충분히 검증되면 driver 교체만 재평가한다.

## 결정 3: 백엔드 프레임워크

**선택:** Hono를 HTTP adapter로 도입한다.

Hono는 라우팅, 요청 파싱, 응답 포맷, 오류 경계, 정적 파일 서빙만 소유한다. 도메인 상태, DB 접근, 생성 어댑터, 검증, 권한 판단은 services, `project-store`, `engine-core`, `generation-codex` 경계에 둔다.

순수 Node 서버는 단기 유지 비용이 낮지만, OAuth, SQLite, 생성 작업, 에셋 API가 늘면 수제 미니 프레임워크가 될 가능성이 높다. Express는 생태계가 크지만 TypeScript contract와 중앙 검증 경계가 약하다. Fastify는 2순위 후보로 두되 현재 규모에서는 Hono보다 무겁다.

## 결정 4: 앱 패키징

**선택:** 개발 단계는 Web + Node를 유지하고, 첫 데스크톱 패키징은 Electron thin shell + Node API child process 구조로 간다.

Electron main process는 창, 메뉴, single-instance, 포트 선택, child process lifecycle만 담당한다. Node API 서버는 `127.0.0.1:<random-port>`에서 실행하고 SQLite 저장소와 Codex app-server 어댑터를 소유한다. React UI는 해당 local URL을 로드한다.

Tauri는 설치 크기와 보안 모델이 장점이지만, 현재 프로젝트의 Node API, Codex app-server stdio, CLI JSON 인터페이스, 생성 에셋 파일 I/O를 유지하려면 Node sidecar가 사실상 필요하다. 순수 Tauri 전환은 Rust backend와 IPC 재작성 비용이 크므로, 설치 크기나 메모리가 실제 제품 요구로 확정될 때 별도 스파이크로 검증한다.

## 다음 구현 순서

1. `packages/project-store` 추가.
2. SQLite schema, migrations, repository, transaction 경계 작성.
3. `apps/web` 서버를 Hono HTTP adapter로 점진 전환.
4. Web API와 CLI가 같은 project-store를 호출하게 정리.
5. Electron thin shell 스파이크 추가.
6. 코드 서명, updater, crash/log 경로, DB backup 정책 확정.

## 금지할 방향

- 프론트, 백엔드, CLI가 각각 다른 저장소 모델을 소유하지 않는다.
- 생성 에셋 바이너리를 SQLite BLOB에 직접 누적하지 않는다.
- Hono route 안에 도메인 로직, DB SQL, 생성 adapter 세부 구현을 섞지 않는다.
- Electron renderer에 Node 권한을 열지 않는다.
- API key 입력 흐름을 Codex OAuth 로그인이라고 부르지 않는다.
