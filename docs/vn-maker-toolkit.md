# VN Maker Toolkit

VN Maker Toolkit은 미연시 플레이 페이지가 아니라, Codex와 이미지 생성 모델을 활용해 미연시를 제작하는 도구 레이어다.

DB, 백엔드 프레임워크, 앱 패키징 결정은 [architecture-decisions.md](architecture-decisions.md)에 기록한다.

## 목표

- Codex가 외부에서 CLI로 엔진을 호출할 수 있다.
- 웹앱은 사람이 자연어로 지시하고, 서버/API 라우트가 Codex app-server의 ChatGPT OAuth와 생성 어댑터를 호출한다.
- CLI와 웹앱은 같은 `@vn-maker/engine-core`를 사용한다.
- 게임 엔진, 제작 툴, Codex 호출, 이미지 생성, 저장소를 분리한다.

## 패키지 구조

```txt
packages/
  engine-core/
    프로젝트 스키마
    시나리오/분기 검증
    에셋 매니페스트
    HTML 빌더
    이미지 생성 작업 스펙

  cli/
    Codex/AI가 호출하는 JSON stdin/stdout 명령 인터페이스

  generation-codex/
    Codex app-server JSON-RPC 클라이언트
    ChatGPT managed OAuth 로그인
    Codex imageGeneration 결과를 VN 에셋으로 변환

apps/
  web/
    Vite 기반 제작 UI
    Node API 라우트
    Codex OAuth 로그인과 이미지 생성 실행 지점
```

기존 `src/engine`은 단일 HTML 데모용 런타임이고, `packages/engine-core`는 제작툴에서 공유하는 코어다. 장기적으로는 두 엔진 모델을 `engine-core` 중심으로 통합한다.

## Engine Core

현재 제공 기능:

- `createStarterProject()`
- `createHeroineProfile()`
- `createProjectFromHeroine()`
- `createEventExpansionRequest()`
- `createDeterministicEventExpansionPlan()`
- `validateEventExpansionPlan()`
- `applyProjectPatch()`
- `createPlayerRuntimeData()`
- `validateProject(project)`
- `createAssetManifest(project)`
- `buildProjectHtml(project)`
- `createImageGenerationJob(input)`

프로젝트는 `vn-maker/v1` 버전 스키마를 사용한다.

```ts
interface VnMakerProject {
  version: "vn-maker/v1";
  id: string;
  title: string;
  premise: string;
  characters: VnMakerCharacter[];
  routes: VnMakerRoute[];
  scenes: VnMakerScene[];
  assets: VnMakerAsset[];
  generationJobs: VnMakerGenerationJob[];
  settings: VnMakerProjectSettings;
}
```

## CLI Adapter

CLI는 사람이 쓰는 대화형 UI가 아니라 Codex/AI가 안정적으로 호출하는 기계용 인터페이스다. 모든 명령은 JSON을 stdin으로 받고 JSON을 stdout으로 반환한다.

```bash
echo '{}' | node packages/cli/dist/index.js create-starter
echo '{"project": {...}}' | node packages/cli/dist/index.js validate
echo '{"project": {...}}' | node packages/cli/dist/index.js manifest
echo '{"project": {...}}' | node packages/cli/dist/index.js build-html
echo '{"projectDirectory":"/tmp/Haru.vnmaker","heroine":{...}}' | node packages/cli/dist/index.js create-project-from-heroine
echo '{"projectDirectory":"/tmp/Haru.vnmaker","userEvent":"하루와 도서관 이벤트"}' | node packages/cli/dist/index.js expand-event
echo '{"projectDirectory":"/tmp/Haru.vnmaker","request":{...},"plan":{...}}' | node packages/cli/dist/index.js approve-event
echo '{"projectDirectory":"/tmp/Haru.vnmaker"}' | node packages/cli/dist/index.js preview
echo '{"projectDirectory":"/tmp/Haru.vnmaker"}' | node packages/cli/dist/index.js export-web
echo '{"job": {...}}' | node packages/cli/dist/index.js create-image-job
echo '{}' | node packages/cli/dist/index.js codex-auth-status
echo '{"login":{"flow":"device"}}' | node packages/cli/dist/index.js codex-login
echo '{"image":{"kind":"cg","targetId":"scene-opening","prompt":"방과 후 교실의 고백 CG"}}' | node packages/cli/dist/index.js generate-image
```

반환 형식:

```json
{
  "ok": true,
  "issues": []
}
```

오류도 JSON으로 반환한다.

```json
{
  "ok": false,
  "error": "project 입력이 필요합니다."
}
```

## Web App

웹앱은 사람이 쓰는 제작 UI다. 지금은 디자인 커스터마이징 전 단계라 기능 위주의 최소 UX만 제공한다.

현재 화면:

- 히로인 라이브러리 추가/목록/삭제
- 히로인 1명 기준 프로젝트 생성
- 자연어 제작 지시 입력
- EventExpansion 패치 제안, diff/검증 표시, 승인/취소
- 승인 후 SQLite 저장
- 플레이 프리뷰
- 웹 플레이어 export와 smoke 결과 확인
- 프로젝트 JSON 편집
- 검증 실행
- HTML 빌드 실행
- 이미지 생성 작업 생성
- Codex ChatGPT OAuth 연결 상태 표시
- Codex OAuth 로그인 시작
- Codex imageGeneration을 통한 실제 이미지 생성 요청
- 생성 결과 미리보기

API 라우트:

```txt
GET  /api/codex/session
POST /api/codex/login
POST /api/codex/logout
POST /api/project/starter
POST /api/project/validate
POST /api/project/build
POST /api/project/preview
POST /api/project/export
POST /api/heroines/list
POST /api/heroines/save
POST /api/heroines/delete
POST /api/projects/from-heroine
POST /api/events/expand
POST /api/events/approve
POST /api/generation/jobs
POST /api/generation/images
```

`/api/codex/session`은 `codex app-server`의 `account/read`와 `modelProvider/capabilities/read`를 호출한다. API key 입력은 기본 경로에서 제거했다.

`/api/codex/login`은 다음 두 흐름을 지원한다.

- `{ "flow": "browser" }`: `account/login/start`에 `{ "type": "chatgpt" }`를 보내고 `authUrl`을 반환한다. 브라우저에서 ChatGPT 로그인 후 Codex가 로컬 콜백으로 토큰을 수신한다.
- `{ "flow": "device" }`: `account/login/start`에 `{ "type": "chatgptDeviceCode" }`를 보내고 `verificationUrl`, `userCode`를 반환한다.

`/api/generation/images`는 ChatGPT OAuth로 연결된 Codex app-server에서 새 ephemeral thread를 만들고, 이미지 생성을 요구하는 turn을 실행한다. Codex가 `imageGeneration` item을 반환하면 그 base64 결과를 `generated-assets/`에 저장하고 `VnMakerAsset`으로 변환한다.

필요 조건:

- 로컬에 `codex` CLI가 설치되어 있어야 한다.
- 웹 서버를 실행하는 머신에서 `codex app-server --listen stdio://`를 실행할 수 있어야 한다.
- Codex 계정이 ChatGPT managed OAuth로 로그인되어 있어야 한다. 웹앱의 로그인 버튼으로 시작할 수 있다.
- `modelProvider/capabilities/read` 결과에서 `imageGeneration: true`여야 한다.

참고한 공식 문서:

- [Codex Authentication](https://developers.openai.com/codex/auth)
- [Codex App Server](https://developers.openai.com/codex/app-server)

## Generation Adapters

생성 기능은 엔진 코어에 직접 묶지 않고 작업 스펙과 어댑터로 분리한다.

```ts
interface VnMakerGenerationJob {
  id: string;
  kind: "character" | "route" | "scene" | "dialogue" | "portrait" | "expression" | "cg";
  targetId: string;
  prompt: string;
  style?: string;
  provider: "codex-text-adapter" | "image-generation-adapter" | "mock-adapter";
  status: "planned" | "running" | "completed" | "failed";
  outputAssetId?: string;
}
```

현재 탑재된 어댑터:

- `@vn-maker/generation-codex`: Codex app-server ChatGPT OAuth, auth 상태 조회, 로그인 시작, 로그아웃, imageGeneration 실행

다음 단계에서 붙일 어댑터:

- 캐릭터/표정/CG 일괄 생성 오케스트레이터
- Codex 텍스트 생성 전용 워크플로를 현재 `EventTextGenerationAdapter` 계약 뒤에 연결

## 개발 명령

```bash
npm install
npm run build
npm run test:maker
npm run start -w @vn-maker/web
```

웹앱만 빌드:

```bash
npm run build -w @vn-maker/web
```

CLI만 빌드:

```bash
npm run build -w @vn-maker/cli
```

## 다음 구현 우선순위

1. `EventTextGenerationAdapter`를 실제 Codex 텍스트 생성 호출에 연결
2. 포트레이트 생성 결과를 히로인 라이브러리 메타데이터에 직접 반영
3. 프리뷰/export 런타임을 기존 `src/engine` 모델과 통합
4. 캐릭터/표정/CG 배치 생성 워크플로 추가
5. 웹앱에서 프로젝트 파일 선택/최근 작업 목록 UX 추가
6. CLI 명령에 JSON Schema와 `--input`, `--output` 파일 옵션 추가
