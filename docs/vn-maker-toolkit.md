# VN Maker Toolkit

VN Maker Toolkit은 미연시 플레이 페이지가 아니라, Codex와 이미지 생성 모델을 활용해 미연시를 제작하는 도구 레이어다.

## 목표

- Codex가 외부에서 CLI로 엔진을 호출할 수 있다.
- 웹앱은 사람이 자연어로 지시하고, 서버/API 라우트가 Codex API와 생성 어댑터를 호출한다.
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

apps/
  web/
    Vite 기반 제작 UI
    Node API 라우트
    Codex auth/API 연결 지점
```

기존 `src/engine`은 단일 HTML 데모용 런타임이고, `packages/engine-core`는 제작툴에서 공유하는 코어다. 장기적으로는 두 엔진 모델을 `engine-core` 중심으로 통합한다.

## Engine Core

현재 제공 기능:

- `createStarterProject()`
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
echo '{"job": {...}}' | node packages/cli/dist/index.js create-image-job
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

- 자연어 제작 지시 입력
- 프로젝트 JSON 편집
- 검증 실행
- HTML 빌드 실행
- 이미지 생성 작업 생성
- Codex auth/API 연결 상태 표시

API 라우트:

```txt
GET  /api/codex/session
POST /api/project/starter
POST /api/project/validate
POST /api/project/build
POST /api/generation/jobs
```

`/api/codex/session`은 현재 서버 환경변수 기반 연결 상태만 반환한다. 실제 Codex auth는 다음 단계에서 서버 어댑터가 담당한다.

## Generation Adapters

생성 기능은 엔진 코어에 직접 묶지 않고 작업 스펙으로 분리한다.

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

다음 단계에서 붙일 어댑터:

- Codex 텍스트 생성 어댑터
- 이미지 생성 API 어댑터
- 캐릭터/표정/CG 워크플로 오케스트레이터
- 생성 결과를 `assets`와 `generationJobs`에 반영하는 패치 함수

## 개발 명령

```bash
npm install
npm run build
npm run test:maker
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

1. `engine-core`와 기존 `src/engine` 런타임 모델 통합
2. 프로젝트 파일 로더/저장소 어댑터 추가
3. Codex 텍스트 생성 어댑터 계약 구현
4. 이미지 생성 API 어댑터 계약 구현
5. 웹앱에서 프로젝트 파일 열기/저장 UX 추가
6. CLI 명령에 JSON Schema와 `--input`, `--output` 파일 옵션 추가
