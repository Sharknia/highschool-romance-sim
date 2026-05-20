# 비주얼노벨 엔진 사용 가이드

이 프로젝트는 최종 배포물을 단일 `index.html`로 유지하면서, 엔진 코드는 TypeScript로 작성해 컴파일 후 HTML에 내장한다.

## 구조

```txt
src/engine/
  types.ts        엔진 데이터 타입
  runtime.ts      상태, 조건, 플래그, AP, 일정 처리
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

타이핑/스킵/오토, 오디오, 캐릭터 DOM 렌더링 완전 일반화, 갤러리/회상은 다음 단계 후보로 남겨둔다.

## 빌드

```bash
npm install
npm run build
```

`npm run build`는 다음 순서로 실행된다.

```txt
TypeScript 타입 검사
엔진 번들 생성
index.html의 VN_ENGINE_BUNDLE 영역에 번들 삽입
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

`saveStorageKey`를 넣으면 DOM 어댑터가 `localStorage` 기반 저장/불러오기를 제공한다. 같은 도메인에 여러 게임을 올릴 경우 서로 다른 키를 써야 저장 데이터가 섞이지 않는다.

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

## 저장/불러오기

DOM 앱은 빠른 저장 슬롯을 기본으로 제공한다.

```js
visualNovelEngine.save();          // quick 슬롯 저장
visualNovelEngine.load();          // quick 슬롯 불러오기
visualNovelEngine.listSaves();     // 현재 게임 키의 저장 목록
visualNovelEngine.clearSave();     // quick 슬롯 삭제
```

다중 슬롯이 필요하면 슬롯 id와 라벨을 직접 넘긴다.

```js
visualNovelEngine.save("beforeConfession", "고백 직전");
visualNovelEngine.load("beforeConfession");
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
