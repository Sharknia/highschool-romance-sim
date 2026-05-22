# VN Maker 개발 가이드

이 저장소의 현재 중심 목표는 단일 `index.html` 게임이 아니라 로컬 데스크톱형 미연시 제작 프로그램이다. 기본 작업 경계는 `VN Maker Core + CLI + Web App + Codex OAuth + 생성 어댑터`이며, 루트 `src/engine`과 `index.html`은 레거시 플레이어 런타임으로 분리해서 다룬다.

## VN Maker 구조

새 제작툴 구조는 `packages/engine-core`, `packages/project-store`, `packages/generation-codex`, `packages/use-cases`, `packages/cli`, `apps/web` 워크스페이스로 구성된다. 목표는 Codex가 외부에서 CLI로 호출하든, 웹앱 내부 API로 호출하든 같은 코어와 같은 use case 경계로 미연시 프로젝트를 생성, 검증, 빌드, 이미지 생성 작업화하는 것이다.

```txt
packages/engine-core/       도메인 타입, DTO schema, 순수 검증/빌더/mutation
packages/project-store/     SQLite/파일 저장소, migration, transaction
packages/generation-codex/  Codex app-server, ChatGPT managed OAuth, imageGeneration adapter
packages/use-cases/         CLI와 Web API가 공유하는 제작 use case
packages/cli/               JSON stdin/stdout 자동화 인터페이스
apps/web/                   제작 UI와 Hono 기반 Node API
```

웹앱의 생성 경로는 OpenAI API key 입력이 아니라 Codex app-server의 ChatGPT managed OAuth를 사용한다. `Codex 로그인` 버튼은 `account/login/start`의 ChatGPT 브라우저 플로우를, `디바이스 코드` 버튼은 device-code 플로우를 시작한다. 실제 이미지 생성은 Codex app-server가 `imageGeneration` 기능을 제공하고 OAuth 로그인이 연결되어 있을 때 실행된다.

```bash
npm run test:maker
npm run build -w @vn-maker/web
node packages/cli/dist/index.js inspect
node packages/cli/dist/index.js codex-auth-status
```

상세 구조와 CLI/API 계약은 [docs/vn-maker-toolkit.md](docs/vn-maker-toolkit.md)를 참고한다.

## 웹앱 개발 서버

기본 개발 실행은 Vite UI를 `127.0.0.1:5173`, Node API를 `127.0.0.1:5174`로 띄운다.

```bash
VN_MAKER_ALPHA_SANDBOX=1 npm run dev -w @vn-maker/web
```

포트를 바꿀 때는 UI 포트는 `VITE_PORT`, API 포트는 `API_PORT`, `VITE_API_PORT`, `PORT` 순서로 지정한다. `apps/web/scripts/dev.mjs`와 `apps/web/vite.config.ts`가 같은 계약을 사용하므로 API 포트를 override하면 Vite의 `/api`, `/generated-assets` proxy target도 같은 포트로 동기화된다.

```bash
VN_MAKER_ALPHA_SANDBOX=1 PORT=6174 VITE_PORT=6173 npm run dev -w @vn-maker/web
```

## 레거시 플레이어 구조

아래 구조는 기존 단일 HTML 플레이어 런타임이다. 신규 제작툴 기능의 중심 작업으로 삼지 않고, 회귀 검증이 필요할 때 `legacy:*` 명령으로 다룬다.

```txt
src/engine/
  types.ts        엔진 데이터 타입
  runtime.ts      상태, 조건, 플래그, AP, 일정 처리
  platform.ts     시간, 타이머, 로그, 알림, 저장소, DOM 생성 기본값
  storage.ts      저장소 어댑터 계약과 localStorage 구현
  dom-adapter.ts  HTML DOM 렌더링 어댑터
  validator.ts    장면 연결, 이미지 키, 캐릭터 에셋 검증
  index.ts        브라우저 전역 API export

scripts/
  embed-engine.mjs  dist 번들을 index.html에 삽입

tests/
  engine-regression.test.mjs  엔진 회귀 테스트

dist/
  visual-novel-engine.js  빌드 산출물, git에는 포함하지 않음
```

## 이번 엔진 강화 범위

미연시 전문 게임 기획 관점에서 즉시 가치가 큰 기능을 먼저 탑재했다.

- 저장/불러오기: 플레이어가 중간 진행을 유지하고, 작가가 특정 분기를 반복 테스트하기 쉽다.
- 백로그: 이전 대사와 감정선을 다시 확인할 수 있다.
- 장면 검증기: 없는 `next` 대상, 잘못된 이미지 키, 누락된 캐릭터 표정 에셋을 배포 전에 찾는다.
- 플랫폼 옵션: 웹 전용 전역 객체 의존을 한 곳으로 모아 비웹 런타임에서도 주입 가능하게 한다.

타이핑/스킵/오토, 오디오, 캐릭터 DOM 렌더링 완전 일반화, 갤러리/회상은 다음 단계 후보로 남겨둔다.

## 빌드

```bash
npm install
npm run build:maker
npm run build:legacy
```

`npm run build:maker`는 VN Maker 워크스페이스를 빌드한다. `npm run build:legacy`는 레거시 플레이어 엔진 번들과 `index.html` 삽입물을 만든다. 통합 확인이 필요할 때만 `npm run build`를 사용한다.

```txt
maker: engine-core -> project-store -> generation-codex -> use-cases -> cli -> web
legacy: TypeScript 타입 검사 -> 엔진 번들 생성 -> index.html의 VN_ENGINE_BUNDLE 영역에 번들 삽입
```

## 엔진 생성

HTML 쪽 게임 데이터는 `imageAssets`, `gameState`, `characterAssetMap`, `scenes`, `elements`를 준비한 뒤 엔진을 생성한다.

```js
const visualNovelEngine = window.VisualNovelEngine.createVisualNovelDomApp({
  state: gameState,
  scenes,
  imageAssets,
  characterAssetMap,
  elements,
  routeStageCharacter: "haru",
  saveStorageKey: "after-school-promise:v1",
  quickSaveSlotId: "quick",
  validateOnStart: true
});
```

`saveStorageKey`는 브라우저 기본값이다. 이 값을 넣으면 DOM 어댑터가 내부에서 `createLocalStorageSaveStorage()`를 만들어 `localStorage`에 저장한다. 같은 도메인에 여러 게임을 올릴 경우 서로 다른 키를 써야 저장 데이터가 섞이지 않는다.

## 플랫폼 옵션

엔진이 웹 전용 전역 객체에 직접 묶이지 않도록 플랫폼 의존성은 `platform` 옵션으로 중앙화한다.

웹 전용이었고 중앙화한 부분:

- 시간: `Date.now()`, `new Date().toISOString()`
- 타이머: `window.setTimeout`
- 로그: `console.error`, `console.warn`, `console.info`
- 알림: `window.alert`
- 저장소: `globalThis.localStorage`
- DOM 생성: `document.createElement`

브라우저에서는 `createDefaultVisualNovelPlatform()`이 위 기본값을 자동 연결한다. 비웹 런타임에서는 필요한 부분만 주입한다.

```js
const platform = window.VisualNovelEngine.createDefaultVisualNovelPlatform({
  now: () => Date.now(),
  createSaveTimestamp: () => new Date().toISOString(),
  logger: {
    error: (...data) => customLogger.error(...data),
    warn: (...data) => customLogger.warn(...data),
    info: (...data) => customLogger.info(...data)
  },
  setTimeout: (callback, delayMs) => scheduler.delay(callback, delayMs),
  alert: (message) => customDialog.show(message),
  getStorage: () => keyValueStorage
});
```

`runtime.ts`와 `storage.ts`는 DOM을 몰라도 동작한다. `dom-adapter.ts`만 `HTMLElement`를 받는 웹 렌더러 경계로 남겨둔다. 다른 UI 런타임을 붙일 때는 `runtime.ts`를 직접 사용하고 해당 런타임용 어댑터를 새로 만들면 된다.

## 장면 데이터

기본 장면은 다음 형태를 사용한다.

```js
introScene: {
  label: "방과 후",
  background: "classroom",
  speaker: "하루",
  text: "오늘은 어떤 선택을 저장할까?",
  hud: { name: "HARU", chapter: "INTRO" },
  routeStages: { haru: "intro" },
  characters: [{ name: "haru", position: "center", expression: "happy", active: true }],
  next: "nextScene"
}
```

`text`, `speaker`, `label`, `next`는 함수도 받을 수 있다.

```js
text: (state) => `현재 BUG는 ${state.route.glitch}입니다.`
```

## 선택지 효과

선택지는 호감도, 스탯, 플래그, 기억 태그, 일정/AP를 동시에 변경할 수 있다.

```js
{
  text: "하루와 대사 리허설을 한다.",
  next: "rehearsalScene",
  actionPointCost: 1,
  scheduleAction: "rehearsal",
  stats: { courage: 2 },
  effects: {
    flags: ["rehearsedConfession"],
    memoryTags: { haru: ["rehearsedConfession", "sharedCreativeTime"] },
    schedule: { slot: "저녁" },
    toast: "AP -1, BRAVE +2"
  }
}
```

## 조건과 잠금

`requires`를 사용하면 선택지를 잠그거나 숨길 수 있다.

```js
{
  text: "하루가 직접 발표하게 믿는다.",
  next: "festivalJudge",
  requires: {
    flags: ["honestApology"],
    anyMemoryTags: { haru: ["rehearsedConfession", "stabilizedFinalBuild"] },
    minActionPoints: 0
  },
  lockedReason: "사과 또는 전날 준비 기억이 필요하다."
}
```

지원 조건:

- `flags`, `anyFlags`, `notFlags`
- `minStats`, `maxStats`
- `minAffinity`, `maxAffinity`
- `routeStages`
- `memoryTags`, `anyMemoryTags`, `notMemoryTags`
- `minActionPoints`, `maxActionPoints`
- `usedActions`, `notUsedActions`
- `timeSlot`
- `all`, `any`, `none`

## 일정과 AP

시간대는 모든 장면을 강제로 순회시키는 장치가 아니다. 장면을 분류하고, 특정 일정 허브에서만 선택 비용을 만들기 위한 메타데이터다.

```js
scheduleScene: {
  label: "문화제 전날 일정",
  schedule: { id: "haruFestivalEve", slot: "문화제 전날", actionPoints: 2 },
  choices: [
    { text: "리허설", actionPointCost: 1, scheduleAction: "rehearsal", next: "rehearsalScene" },
    { text: "마감", requires: { maxActionPoints: 0 }, next: "festivalMorning" }
  ]
}
```

일반 선형 장면에는 AP가 영향을 주지 않는다. `actionPointCost`가 있는 선택지에서만 AP가 차감된다.

## 장면 검증기

브라우저 콘솔이나 빌드 검수 스크립트에서 검증기를 호출할 수 있다.

```js
const issues = window.VisualNovelEngine.validateVisualNovelProject({
  scenes,
  imageAssets,
  characterAssetMap
});

console.table(issues);
```

DOM 앱 생성 시 `validateOnStart: true`를 설정하면 문제를 콘솔에 자동 출력한다. 현재 검증 대상은 다음과 같다.

- `scene.next`, `choice.next`, `variant.next`가 존재하는 장면을 가리키는지
- `background`, `cg` 이미지 키가 `imageAssets`에 있는지
- `characters[].expression`이 `characterAssetMap`과 `imageAssets`에 연결되는지
- 잠긴 선택지가 화면에 보이는데 `lockedReason`이 없는지

## 저장소 어댑터

저장 기능은 특정 저장소에 고정하지 않고 `VisualNovelSaveStorage` 계약에 의존한다. 브라우저에서는 현재 `localStorage` 어댑터만 제공하지만, 같은 계약으로 서버 API나 DB 어댑터를 붙일 수 있다.

```ts
interface VisualNovelSaveStorage {
  save(saveSlot: SaveSlot): SaveSlot | Promise<SaveSlot>;
  load(slotId: string): SaveSlot | null | Promise<SaveSlot | null>;
  list(): SaveSlot[] | Promise<SaveSlot[]>;
  remove(slotId: string): void | Promise<void>;
}
```

로컬 스토리지 어댑터를 명시적으로 만들 수도 있다.

```js
const saveStorage = window.VisualNovelEngine.createLocalStorageSaveStorage({
  storageKey: "after-school-promise:v1",
  platform
});

const visualNovelEngine = window.VisualNovelEngine.createVisualNovelDomApp({
  state: gameState,
  scenes,
  imageAssets,
  characterAssetMap,
  elements,
  saveStorage
});
```

서버나 DB를 쓰고 싶다면 `saveStorage`에 직접 어댑터를 주입한다.

```js
const saveStorage = {
  async save(saveSlot) {
    await fetch(`/api/saves/${saveSlot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saveSlot)
    });
    return saveSlot;
  },
  async load(slotId) {
    const response = await fetch(`/api/saves/${slotId}`);
    return response.ok ? response.json() : null;
  },
  async list() {
    const response = await fetch("/api/saves");
    return response.ok ? response.json() : [];
  },
  async remove(slotId) {
    await fetch(`/api/saves/${slotId}`, { method: "DELETE" });
  }
};
```

엔진은 `saveStorage`만 호출하므로 저장 대상이 `localStorage`, IndexedDB, 서버 API, DB인지 알 필요가 없다.

## 저장/불러오기

DOM 앱은 빠른 저장 슬롯을 기본으로 제공한다.

```js
await visualNovelEngine.save();          // quick 슬롯 저장
await visualNovelEngine.load();          // quick 슬롯 불러오기
await visualNovelEngine.listSaves();     // 현재 저장소의 저장 목록
await visualNovelEngine.clearSave();     // quick 슬롯 삭제
```

다중 슬롯이 필요하면 슬롯 id와 라벨을 직접 넘긴다.

```js
await visualNovelEngine.save("beforeConfession", "고백 직전");
await visualNovelEngine.load("beforeConfession");
```

저장 데이터에는 현재 장면, `GameState`, 백로그가 포함된다.

## 백로그

장면이 렌더링될 때 대사가 자동으로 백로그에 기록된다. 같은 장면을 단순 재렌더링할 때는 같은 대사가 중복 저장되지 않는다.

```js
visualNovelEngine.getBacklog();
```

현재 `index.html`에는 플레이어용 `백로그`, `저장`, `불러오기` 버튼이 연결되어 있다.

## 감정 기억 태그

감정 기억 태그는 호감도 숫자를 대체하지 않는다. 호감도는 “얼마나 가까운가”를 나타내고, 기억 태그는 “무슨 일이 있었는가”를 남긴다.

좋은 사용 예:

- `rehearsedConfession`
- `isolatedFinalWork`
- `protectedHaruCondition`
- `sharedCreativeTime`

나쁜 사용 예:

- `likesPlayer`
- `veryHappy`
- `goodMood`

이런 값은 호감도나 스탯으로 처리하는 편이 낫다.

## 디버그

브라우저 콘솔에서 현재 상태를 확인할 수 있다.

```js
visualNovelEngine.debugSnapshot()
```

반환값에는 현재 장면, 호감도, 루트 스탯, 플래그, 일정/AP, 캐릭터별 진행도와 기억 태그가 포함된다.
